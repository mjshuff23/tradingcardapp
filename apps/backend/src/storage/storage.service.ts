import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { StorageTarget } from "./storage-ops.util";

export type StoredImage = {
  originalKey: string;
  thumbnailKey: string;
};

export type StoredImageContent = {
  buffer: Buffer;
  contentType: string;
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly profileBucket: string;
  private readonly cardBucket: string;
  private readonly endpoint?: string;
  private readonly region: string;
  private readonly allowLocalFallback: boolean;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>("S3_ENDPOINT") ?? undefined;
    const region = this.configService.get<string>("S3_REGION") ?? "garage";
    const accessKeyId =
      this.configService.get<string>("S3_ACCESS_KEY") ?? "tradingcards";
    const secretAccessKey =
      this.configService.get<string>("S3_SECRET_KEY") ?? "tradingcardssecret";
    const defaultBucket =
      this.configService.get<string>("S3_BUCKET") ?? "trading-cards";
    this.profileBucket =
      this.configService.get<string>("S3_PROFILE_BUCKET") ?? defaultBucket;
    this.cardBucket =
      this.configService.get<string>("S3_CARD_BUCKET") ?? defaultBucket;
    this.endpoint = endpoint;
    this.region = region;
    this.allowLocalFallback = this.shouldAllowLocalFallback(endpoint, region);

    this.s3Client = new S3Client({
      endpoint,
      region,
      forcePathStyle: Boolean(endpoint),
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  getStorageConfiguration() {
    return {
      endpoint: this.endpoint ?? null,
      region: this.region,
      allowLocalFallback: this.allowLocalFallback,
      buckets: {
        profile: this.profileBucket,
        card: this.cardBucket,
      },
    };
  }

  async uploadScanImage(
    buffer: Buffer,
    sourceFilename: string,
  ): Promise<StoredImage> {
    return this.uploadImageToBucket({
      buffer,
      sourceFilename,
      target: "card",
      keyPrefix: "user-cards/scans",
    });
  }

  async uploadCardImage(
    buffer: Buffer,
    sourceFilename: string,
  ): Promise<StoredImage> {
    return this.uploadImageToBucket({
      buffer,
      sourceFilename,
      target: "card",
      keyPrefix: "user-cards/catalog",
    });
  }

  async uploadCanonicalCardImage(
    buffer: Buffer,
    sourceFilename: string,
  ): Promise<StoredImage> {
    return this.uploadImageToBucket({
      buffer,
      sourceFilename,
      target: "card",
      keyPrefix: "canonical-cards",
    });
  }

  async uploadProfileImage(
    buffer: Buffer,
    sourceFilename: string,
  ): Promise<StoredImage> {
    return this.uploadImageToBucket({
      buffer,
      sourceFilename,
      target: "profile",
      keyPrefix: "profiles",
    });
  }

  async readImage(key: string): Promise<StoredImageContent> {
    return this.readStoredImage(key, "card");
  }

  async readCardImage(key: string): Promise<StoredImageContent> {
    return this.readStoredImage(key, "card");
  }

  async readProfileImage(key: string): Promise<StoredImageContent> {
    return this.readStoredImage(key, "profile");
  }

  async readCanonicalCardImage(key: string): Promise<StoredImageContent> {
    return this.readStoredImage(key, "card");
  }

  async deleteCardImage(key: string | null | undefined) {
    await this.deleteStoredImage(key, "card");
  }

  async deleteProfileImage(key: string | null | undefined) {
    await this.deleteStoredImage(key, "profile");
  }

  async objectExists(key: string, target: StorageTarget): Promise<boolean> {
    if (!key) {
      return false;
    }

    if (key.startsWith("local/")) {
      const localRoot = path.resolve(process.cwd(), ".local-storage");
      const relativePath = key.replace(/^local\//, "");
      const filePath = path.join(localRoot, relativePath);

      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    }

    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.resolveBucket(target),
          Key: key,
        }),
      );
      return true;
    } catch (error) {
      if (this.isMissingObjectError(error)) {
        return false;
      }

      throw error;
    }
  }

  private async uploadImageToBucket(input: {
    buffer: Buffer;
    sourceFilename: string;
    target: StorageTarget;
    keyPrefix: string;
  }): Promise<StoredImage> {
    const extension = this.getExtension(input.sourceFilename);
    const id = randomUUID();
    const originalKey = `${input.keyPrefix}/original/${id}.${extension}`;
    const thumbnailKey = `${input.keyPrefix}/thumb/${id}.jpg`;
    const bucket = this.resolveBucket(input.target);

    const thumbnailBuffer = await sharp(input.buffer)
      .resize({
        width: 600,
        height: 600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    try {
      await Promise.all([
        this.s3Client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: originalKey,
            Body: input.buffer,
            ContentType: this.detectMimeType(extension),
          }),
        ),
        this.s3Client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: thumbnailKey,
            Body: thumbnailBuffer,
            ContentType: "image/jpeg",
          }),
        ),
      ]);

      return { originalKey, thumbnailKey };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!this.allowLocalFallback) {
        this.logger.error(`S3 upload failed without local fallback: ${message}`);
        throw error;
      }

      this.logger.warn(
        `Falling back to local image storage because S3 upload failed: ${message}`,
      );
      return this.writeLocally(
        input.keyPrefix,
        id,
        extension,
        input.buffer,
        thumbnailBuffer,
      );
    }
  }

  private async readStoredImage(
    key: string,
    target: StorageTarget,
  ): Promise<StoredImageContent> {
    if (!key) {
      throw new Error("Image key is required.");
    }

    if (key.startsWith("local/")) {
      const localRoot = path.resolve(process.cwd(), ".local-storage");
      const relativePath = key.replace(/^local\//, "");
      const filePath = path.join(localRoot, relativePath);
      const buffer = await fs.readFile(filePath);
      const extension = path.extname(filePath).replace(".", "").toLowerCase();
      return {
        buffer,
        contentType: this.detectMimeType(extension),
      };
    }

    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.resolveBucket(target),
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error("Image object not found.");
    }

    const bytes = await response.Body.transformToByteArray();
    return {
      buffer: Buffer.from(bytes),
      contentType: response.ContentType ?? "application/octet-stream",
    };
  }

  private async deleteStoredImage(
    key: string | null | undefined,
    target: StorageTarget,
  ) {
    if (!key) {
      return;
    }

    if (key.startsWith("http://") || key.startsWith("https://")) {
      return;
    }

    if (key.startsWith("local/")) {
      const localRoot = path.resolve(process.cwd(), ".local-storage");
      const relativePath = key.replace(/^local\//, "");
      const filePath = path.join(localRoot, relativePath);
      await fs.rm(filePath, { force: true });
      return;
    }

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.resolveBucket(target),
        Key: key,
      }),
    );
  }

  private resolveBucket(target: StorageTarget) {
    return target === "profile" ? this.profileBucket : this.cardBucket;
  }

  private shouldAllowLocalFallback(
    endpoint: string | undefined,
    region: string,
  ) {
    if (!endpoint) {
      return region === "garage";
    }

    try {
      const url = new URL(endpoint);
      return ["localhost", "127.0.0.1", "garage"].includes(url.hostname);
    } catch {
      return endpoint.includes("garage") || endpoint.includes("localhost");
    }
  }

  private isMissingObjectError(error: unknown) {
    const code =
      typeof error === "object" && error !== null
        ? String(
            (error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } })
              .Code ??
              (error as { name?: string }).name ??
              "",
          )
        : "";
    const httpStatusCode =
      typeof error === "object" &&
      error !== null &&
      "$metadata" in error &&
      typeof (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode === "number"
        ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata
            ?.httpStatusCode
        : undefined;

    return (
      code === "NotFound" ||
      code === "NoSuchKey" ||
      code === "UnknownError" ||
      httpStatusCode === 404
    );
  }

  private getExtension(sourceFilename: string): string {
    const extension = path
      .extname(sourceFilename)
      .replace(".", "")
      .toLowerCase();
    if (!extension) {
      return "jpg";
    }

    if (["jpg", "jpeg", "png", "webp"].includes(extension)) {
      return extension;
    }

    return "jpg";
  }

  private detectMimeType(extension: string): string {
    if (extension === "png") {
      return "image/png";
    }

    if (extension === "webp") {
      return "image/webp";
    }

    return "image/jpeg";
  }

  private async writeLocally(
    keyPrefix: string,
    id: string,
    extension: string,
    originalBuffer: Buffer,
    thumbnailBuffer: Buffer,
  ): Promise<StoredImage> {
    const localRoot = path.resolve(process.cwd(), ".local-storage");
    const originalDir = path.join(localRoot, keyPrefix, "original");
    const thumbDir = path.join(localRoot, keyPrefix, "thumb");

    await Promise.all([
      fs.mkdir(originalDir, { recursive: true }),
      fs.mkdir(thumbDir, { recursive: true }),
    ]);

    const originalFile = `${id}.${extension}`;
    const thumbFile = `${id}.jpg`;

    await Promise.all([
      fs.writeFile(path.join(originalDir, originalFile), originalBuffer),
      fs.writeFile(path.join(thumbDir, thumbFile), thumbnailBuffer),
    ]);

    return {
      originalKey: `local/${keyPrefix}/original/${originalFile}`,
      thumbnailKey: `local/${keyPrefix}/thumb/${thumbFile}`,
    };
  }
}
