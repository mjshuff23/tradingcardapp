import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_LOCAL_USER,
  CatalogDraftInput,
  deriveCatalogDraft,
  normalizeNullableText,
} from '../common/catalog-normalization.util';

@Injectable()
export class CatalogIndexService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultLocalUser() {
    return this.prisma.user.upsert({
      where: { id: DEFAULT_LOCAL_USER.id },
      update: {
        username: DEFAULT_LOCAL_USER.username,
        email: DEFAULT_LOCAL_USER.email,
        passwordHash: DEFAULT_LOCAL_USER.passwordHash,
        pfpUrl: DEFAULT_LOCAL_USER.pfpUrl,
      },
      create: DEFAULT_LOCAL_USER,
    });
  }

  async upsertCatalogNodes(input: CatalogDraftInput) {
    const draft = deriveCatalogDraft(input);

    const cardSet = draft.normalizedSetKey
      ? await this.prisma.cardSet.upsert({
          where: { normalizedSetKey: draft.normalizedSetKey },
          update: {
            brand: draft.brand ?? undefined,
            setName: draft.setName ?? undefined,
            yearManufactured: draft.yearManufactured ?? undefined,
            sport: draft.sport ?? undefined,
            season: draft.season ?? undefined,
          },
          create: {
            normalizedSetKey: draft.normalizedSetKey,
            brand: draft.brand,
            setName: draft.setName,
            yearManufactured: draft.yearManufactured,
            sport: draft.sport,
            season: draft.season,
          },
        })
      : null;

    const definition = await this.prisma.cardDefinition.upsert({
      where: { normalizedCardKey: draft.normalizedCardKey },
      update: {
        cardSetId: cardSet?.id ?? undefined,
        cardNumber: draft.cardNumber ?? undefined,
        name: input.name,
        player: draft.player ?? undefined,
        variant: draft.variant ?? undefined,
        legacySetText: normalizeNullableText(input.set) ?? undefined,
      },
      create: {
        normalizedCardKey: draft.normalizedCardKey,
        cardSetId: cardSet?.id ?? null,
        cardNumber: draft.cardNumber,
        name: input.name,
        player: draft.player,
        variant: draft.variant,
        legacySetText: normalizeNullableText(input.set),
      },
    });

    return {
      cardSet,
      cardDefinition: definition,
      draft,
    };
  }
}
