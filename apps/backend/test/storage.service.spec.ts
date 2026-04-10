import { S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { StorageService } from "../src/storage/storage.service";

describe("StorageService", () => {
  function createConfigService(values: Record<string, string | undefined>) {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  }

  async function createImageBuffer() {
    return sharp({
      create: {
        width: 24,
        height: 24,
        channels: 3,
        background: { r: 200, g: 30, b: 30 },
      },
    })
      .png()
      .toBuffer();
  }

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.rm(path.resolve(process.cwd(), ".local-storage"), {
      recursive: true,
      force: true,
    });
  });

  it("exposes the configured profile and card buckets", () => {
    const service = new StorageService(
      createConfigService({
        S3_REGION: "us-east-1",
        S3_ACCESS_KEY: "key",
        S3_SECRET_KEY: "secret",
        S3_PROFILE_BUCKET: "profile-bucket",
        S3_CARD_BUCKET: "card-bucket",
      }),
    );

    expect(service.getStorageConfiguration()).toMatchObject({
      buckets: {
        profile: "profile-bucket",
        card: "card-bucket",
      },
      allowLocalFallback: false,
    });
  });

  it("falls back to local storage when Garage-style uploads fail", async () => {
    jest
      .spyOn(S3Client.prototype, "send")
      .mockRejectedValue(new Error("garage unavailable"));
    const service = new StorageService(
      createConfigService({
        S3_ENDPOINT: "http://garage:3900",
        S3_REGION: "garage",
        S3_ACCESS_KEY: "key",
        S3_SECRET_KEY: "secret",
        S3_CARD_BUCKET: "trading-cards",
        S3_PROFILE_BUCKET: "trading-profiles",
      }),
    );

    const stored = await service.uploadCardImage(
      await createImageBuffer(),
      "front.png",
    );

    expect(stored.originalKey).toMatch(
      /^local\/user-cards\/catalog\/original\/.+\.png$/,
    );
    expect(stored.thumbnailKey).toMatch(
      /^local\/user-cards\/catalog\/thumb\/.+\.jpg$/,
    );
  });

  it("throws on deployed S3 upload failures when local fallback is disabled", async () => {
    jest.spyOn(S3Client.prototype, "send").mockRejectedValue(new Error("s3 down"));
    const service = new StorageService(
      createConfigService({
        S3_REGION: "us-east-1",
        S3_ACCESS_KEY: "key",
        S3_SECRET_KEY: "secret",
        S3_CARD_BUCKET: "trading-cards",
        S3_PROFILE_BUCKET: "trading-profiles",
      }),
    );

    await expect(
      service.uploadCardImage(await createImageBuffer(), "front.png"),
    ).rejects.toThrow("s3 down");
  });

  it("treats 404 object checks as missing objects", async () => {
    jest.spyOn(S3Client.prototype, "send").mockRejectedValue({
      name: "NotFound",
      $metadata: { httpStatusCode: 404 },
    });
    const service = new StorageService(
      createConfigService({
        S3_REGION: "us-east-1",
        S3_ACCESS_KEY: "key",
        S3_SECRET_KEY: "secret",
        S3_CARD_BUCKET: "trading-cards",
        S3_PROFILE_BUCKET: "trading-profiles",
      }),
    );

    await expect(
      service.objectExists("user-cards/catalog/thumb/missing.jpg", "card"),
    ).resolves.toBe(false);
  });
});
