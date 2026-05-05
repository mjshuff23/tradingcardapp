// @ts-nocheck
import {
  groupMediaReferences,
  migrateGroupedMedia,
} from '../src/storage/storage-ops.util';
import {
  createPrismaClient,
  createSourceStorageConfig,
  createTargetStorageConfig,
  loadMediaReferences,
  objectExists,
  readObject,
  writeObject,
} from './storage-media';

async function main() {
  const prisma = createPrismaClient();
  const target = createTargetStorageConfig();
  const source = createSourceStorageConfig();

  try {
    const references = await loadMediaReferences(prisma);
    const groups = groupMediaReferences(references);
    const migration = await migrateGroupedMedia(groups, {
      hasSourceConfig: Boolean(source),
      targetExists: async (group) => objectExists(target, group.target, group.key),
      readSource: async (group) => {
        if (!source) {
          throw new Error('Source storage config missing.');
        }

        return readObject(source, group.target, group.key);
      },
      writeTarget: async (group, payload) =>
        writeObject(target, group.target, group.key, payload),
    });

    const payload = {
      source: source
        ? {
            endpoint: source.endpoint,
            region: source.region,
            buckets: source.buckets,
          }
        : null,
      target: {
        endpoint: target.endpoint,
        region: target.region,
        buckets: target.buckets,
      },
      totalReferences: references.length,
      totalUniqueObjects: groups.length,
      counts: migration.counts,
      missingSource: migration.results
        .filter((result) => result.status === 'missing-source')
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
