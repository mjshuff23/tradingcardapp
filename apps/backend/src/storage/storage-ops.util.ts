export type StorageTarget = "card" | "profile";

export type MediaReference = {
  target: StorageTarget;
  ownerType: string;
  ownerId: string;
  field: string;
  key: string | null;
};

export type VerificationStatus =
  | "present"
  | "missing"
  | "skipped-http"
  | "skipped-local"
  | "skipped-empty";

export type MigrationStatus =
  | "migrated"
  | "already-present"
  | "missing-source"
  | "skipped-http"
  | "skipped-local"
  | "skipped-empty"
  | "source-config-missing";

export type MediaObjectGroup = {
  target: StorageTarget;
  key: string;
  references: MediaReference[];
};

export function isHttpStorageKey(value: string | null | undefined): boolean {
  return Boolean(
    value && (value.startsWith("http://") || value.startsWith("https://")),
  );
}

export function isLocalStorageKey(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith("local/"));
}

export function classifyMediaReference(
  reference: Pick<MediaReference, "key">,
): VerificationStatus | null {
  if (!reference.key) {
    return "skipped-empty";
  }

  if (isHttpStorageKey(reference.key)) {
    return "skipped-http";
  }

  if (isLocalStorageKey(reference.key)) {
    return "skipped-local";
  }

  return null;
}

export function groupMediaReferences(
  references: MediaReference[],
): MediaObjectGroup[] {
  const groups = new Map<string, MediaObjectGroup>();

  for (const reference of references) {
    if (!reference.key) {
      continue;
    }

    const groupKey = `${reference.target}:${reference.key}`;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.references.push(reference);
      continue;
    }

    groups.set(groupKey, {
      target: reference.target,
      key: reference.key,
      references: [reference],
    });
  }

  return [...groups.values()];
}

export async function verifyGroupedMedia(
  groups: MediaObjectGroup[],
  exists: (group: MediaObjectGroup) => Promise<boolean>,
) {
  const results: Array<{
    target: StorageTarget;
    key: string;
    status: VerificationStatus;
    referenceCount: number;
  }> = [];

  for (const group of groups) {
    const skippedStatus = classifyMediaReference({ key: group.key });
    if (skippedStatus) {
      results.push({
        target: group.target,
        key: group.key,
        status: skippedStatus,
        referenceCount: group.references.length,
      });
      continue;
    }

    const present = await exists(group);
    results.push({
      target: group.target,
      key: group.key,
      status: present ? "present" : "missing",
      referenceCount: group.references.length,
    });
  }

  return {
    results,
    counts: summarizeStatuses(results.map((item) => item.status)),
  };
}

export async function migrateGroupedMedia(
  groups: MediaObjectGroup[],
  input: {
    hasSourceConfig: boolean;
    targetExists: (group: MediaObjectGroup) => Promise<boolean>;
    readSource: (group: MediaObjectGroup) => Promise<{
      body: Buffer;
      contentType: string | null;
    }>;
    writeTarget: (
      group: MediaObjectGroup,
      payload: { body: Buffer; contentType: string | null },
    ) => Promise<void>;
  },
) {
  const results: Array<{
    target: StorageTarget;
    key: string;
    status: MigrationStatus;
    referenceCount: number;
  }> = [];

  for (const group of groups) {
    const skippedStatus = classifyMediaReference({ key: group.key });
    if (skippedStatus) {
      results.push({
        target: group.target,
        key: group.key,
        status:
          skippedStatus === "skipped-http"
            ? "skipped-http"
            : skippedStatus === "skipped-local"
              ? "skipped-local"
              : "skipped-empty",
        referenceCount: group.references.length,
      });
      continue;
    }

    if (!input.hasSourceConfig) {
      results.push({
        target: group.target,
        key: group.key,
        status: "source-config-missing",
        referenceCount: group.references.length,
      });
      continue;
    }

    if (await input.targetExists(group)) {
      results.push({
        target: group.target,
        key: group.key,
        status: "already-present",
        referenceCount: group.references.length,
      });
      continue;
    }

    try {
      const payload = await input.readSource(group);
      await input.writeTarget(group, payload);
      results.push({
        target: group.target,
        key: group.key,
        status: "migrated",
        referenceCount: group.references.length,
      });
    } catch {
      results.push({
        target: group.target,
        key: group.key,
        status: "missing-source",
        referenceCount: group.references.length,
      });
    }
  }

  return {
    results,
    counts: summarizeStatuses(results.map((item) => item.status)),
  };
}

export function summarizeStatuses<T extends string>(statuses: T[]) {
  return statuses.reduce<Record<string, number>>((acc, status) => {
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
}
