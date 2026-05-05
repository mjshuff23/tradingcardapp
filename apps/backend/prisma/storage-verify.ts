// @ts-nocheck
import {
  groupMediaReferences,
  verifyGroupedMedia,
} from '../src/storage/storage-ops.util';
import {
  createPrismaClient,
  createTargetStorageConfig,
  loadMediaReferences,
  objectExists,
} from './storage-media';

async function main() {
  const prisma = createPrismaClient();
  const storage = createTargetStorageConfig();

  try {
    const references = await loadMediaReferences(prisma);
    const groups = groupMediaReferences(references);
    const verification = await verifyGroupedMedia(groups, async (group) =>
      objectExists(storage, group.target, group.key),
    );

    const payload = {
      target: {
        endpoint: storage.endpoint,
        region: storage.region,
        buckets: storage.buckets,
      },
      totalReferences: references.length,
      totalUniqueObjects: groups.length,
      counts: verification.counts,
      missing: verification.results
        .filter((result) => result.status === 'missing')
        .slice(0, 25),
    };

    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
