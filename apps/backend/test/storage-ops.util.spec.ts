import {
  groupMediaReferences,
  migrateGroupedMedia,
  verifyGroupedMedia,
} from "../src/storage/storage-ops.util";

describe("storage-ops.util", () => {
  it("groups duplicate object references and classifies verification results", async () => {
    const groups = groupMediaReferences([
      {
        target: "card",
        ownerType: "UserCard",
        ownerId: "1",
        field: "frontImageKey",
        key: "user-cards/catalog/thumb/a.jpg",
      },
      {
        target: "card",
        ownerType: "UserCard",
        ownerId: "2",
        field: "thumbnailImageKey",
        key: "user-cards/catalog/thumb/a.jpg",
      },
      {
        target: "card",
        ownerType: "UserCard",
        ownerId: "3",
        field: "imageUrl",
        key: "https://example.com/card.jpg",
      },
      {
        target: "profile",
        ownerType: "User",
        ownerId: "user-1",
        field: "pfpThumbnailImageKey",
        key: "local/profiles/thumb/a.jpg",
      },
      {
        target: "card",
        ownerType: "ScanJob",
        ownerId: "4",
        field: "originalImageKey",
        key: "user-cards/scans/original/missing.jpg",
      },
    ]);

    expect(groups).toHaveLength(4);

    const verification = await verifyGroupedMedia(groups, async (group) =>
      group.key !== "user-cards/scans/original/missing.jpg",
    );

    expect(verification.counts).toMatchObject({
      present: 1,
      missing: 1,
      "skipped-http": 1,
      "skipped-local": 1,
    });
  });

  it("reports migration outcomes for present, migrated, missing, and skipped objects", async () => {
    const groups = groupMediaReferences([
      {
        target: "card",
        ownerType: "UserCard",
        ownerId: "1",
        field: "frontImageKey",
        key: "user-cards/catalog/thumb/already-present.jpg",
      },
      {
        target: "card",
        ownerType: "UserCard",
        ownerId: "2",
        field: "frontImageKey",
        key: "user-cards/catalog/thumb/to-copy.jpg",
      },
      {
        target: "card",
        ownerType: "UserCard",
        ownerId: "3",
        field: "frontImageKey",
        key: "user-cards/catalog/thumb/missing-source.jpg",
      },
      {
        target: "card",
        ownerType: "UserCard",
        ownerId: "4",
        field: "imageUrl",
        key: "https://example.com/card.jpg",
      },
    ]);

    const writes: string[] = [];
    const migration = await migrateGroupedMedia(groups, {
      hasSourceConfig: true,
      targetExists: async (group) => group.key.includes("already-present"),
      readSource: async (group) => {
        if (group.key.includes("missing-source")) {
          throw new Error("missing");
        }

        return {
          body: Buffer.from(group.key),
          contentType: "image/jpeg",
        };
      },
      writeTarget: async (group) => {
        writes.push(group.key);
      },
    });

    expect(writes).toEqual(["user-cards/catalog/thumb/to-copy.jpg"]);
    expect(migration.counts).toMatchObject({
      "already-present": 1,
      migrated: 1,
      "missing-source": 1,
      "skipped-http": 1,
    });
  });
});
