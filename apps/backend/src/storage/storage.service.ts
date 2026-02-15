import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

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
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT') ?? 'http://localhost:3900';
    const region = this.configService.get<string>('S3_REGION') ?? 'garage';
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY') ?? 'tradingcards';
    const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY') ?? 'tradingcardssecret';
    this.bucket = this.configService.get<string>('S3_BUCKET') ?? 'trading-cards';

    this.s3Client = new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async uploadScanImage(buffer: Buffer, sourceFilename: string): Promise<StoredImage> {
    const extension = this.getExtension(sourceFilename);
    const id = randomUUID();
    const originalKey = `scans/original/${id}.${extension}`;
    const thumbnailKey = `scans/thumb/${id}.jpg`;

    const thumbnailBuffer = await sharp(buffer)
      .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    try {
      await Promise.all([
        this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: originalKey,
            Body: buffer,
            ContentType: this.detectMimeType(extension),
          }),
        ),
        this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: thumbnailKey,
            Body: thumbnailBuffer,
            ContentType: 'image/jpeg',
          }),
        ),
      ]);

      return { originalKey, thumbnailKey };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Falling back to local image storage because S3 upload failed: ${message}`);
      return this.writeLocally(id, extension, buffer, thumbnailBuffer);
    }
  }

  async readImage(key: string): Promise<StoredImageContent> {
    if (!key) {
      throw new Error('Image key is required.');
    }

    if (key.startsWith('local/')) {
      const localRoot = path.resolve(process.cwd(), '.local-storage');
      const relativePath = key.replace(/^local\//, '');
      const filePath = path.join(localRoot, relativePath);
      const buffer = await fs.readFile(filePath);
      const extension = path.extname(filePath).replace('.', '').toLowerCase();
      return {
        buffer,
        contentType: this.detectMimeType(extension),
      };
    }

    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error('Image object not found.');
    }

    const bytes = await response.Body.transformToByteArray();
    return {
      buffer: Buffer.from(bytes),
      contentType: response.ContentType ?? 'application/octet-stream',
    };
  }

  private getExtension(sourceFilename: string): string {
    const extension = path.extname(sourceFilename).replace('.', '').toLowerCase();
    if (!extension) {
      return 'jpg';
    }

    if (['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
      return extension;
    }

    return 'jpg';
  }

  private detectMimeType(extension: string): string {
    if (extension === 'png') {
      return 'image/png';
    }

    if (extension === 'webp') {
      return 'image/webp';
    }

    return 'image/jpeg';
  }

  private async writeLocally(
    id: string,
    extension: string,
    originalBuffer: Buffer,
    thumbnailBuffer: Buffer,
  ): Promise<StoredImage> {
    const localRoot = path.resolve(process.cwd(), '.local-storage');
    const originalDir = path.join(localRoot, 'scans', 'original');
    const thumbDir = path.join(localRoot, 'scans', 'thumb');

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
      originalKey: `local/scans/original/${originalFile}`,
      thumbnailKey: `local/scans/thumb/${thumbFile}`,
    };
  }
}
