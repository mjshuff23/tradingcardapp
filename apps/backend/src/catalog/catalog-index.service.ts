import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CatalogDraftInput,
  deriveCatalogDraft,
  normalizeNullableText,
} from '../common/catalog-normalization.util';

@Injectable()
export class CatalogIndexService {
  constructor(private readonly prisma: PrismaService) {}

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
            metadata: undefined,
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
        category: draft.category ?? undefined,
        subcategory: draft.subcategory ?? undefined,
        hasAutographVariant: draft.hasAutographVariant,
        originalOrReprint: draft.originalOrReprint ?? undefined,
        parallelOrVariety: draft.parallelOrVariety ?? undefined,
        setType: draft.setType ?? undefined,
        insertSetName: draft.insertSetName ?? undefined,
        cardType: draft.cardType ?? undefined,
        isVintage: draft.isVintage,
      },
      create: {
        normalizedCardKey: draft.normalizedCardKey,
        cardSetId: cardSet?.id ?? null,
        cardNumber: draft.cardNumber,
        name: input.name,
        player: draft.player,
        variant: draft.variant,
        legacySetText: normalizeNullableText(input.set),
        category: draft.category,
        subcategory: draft.subcategory,
        hasAutographVariant: draft.hasAutographVariant,
        originalOrReprint: draft.originalOrReprint,
        parallelOrVariety: draft.parallelOrVariety,
        setType: draft.setType,
        insertSetName: draft.insertSetName,
        cardType: draft.cardType,
        isVintage: draft.isVintage,
      },
    });

    return {
      cardSet,
      cardDefinition: definition,
      draft,
    };
  }
}
