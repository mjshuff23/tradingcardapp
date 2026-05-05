import { Injectable, NotFoundException } from "@nestjs/common";
import { CatalogDraftInput } from "../common/catalog-normalization.util";
import { UploadedFile } from "../common/uploaded-file.type";
import { CollectionStatus, Prisma } from "../prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { CatalogIndexService } from "./catalog-index.service";
import {
  CatalogQueryService,
  CatalogSearchFilters,
} from "./catalog-query.service";
import {
  CardCollectionRecordDto,
  CardDetailDto,
  CardImageSourceDto,
  CardListItemDto,
} from "./dto/card-response.dto";
import {
  CardQueryMode,
  CardSortBy,
  SortDirection,
} from "./dto/list-cards-query.dto";
import { NormalizeTitleFieldsDto } from "./dto/normalize-title.dto";
import { UpdateCardDto } from "./dto/update-card.dto";
import type { NormalizedTitleFields } from "./title-normalization.service";
import { TitleNormalizationService } from "./title-normalization.service";
import { getTaxonomyForResponse } from "./card-taxonomy";

const userCardInclude = {
  cardDefinition: {
    include: {
      cardSet: true,
    },
  },
} satisfies Prisma.UserCardInclude;

const userWishlistInclude = {
  cardDefinition: {
    include: {
      cardSet: true,
    },
  },
} satisfies Prisma.UserWishlistInclude;

type UserCardRow = Prisma.UserCardGetPayload<{
  include: typeof userCardInclude;
}>;
type UserWishlistRow = Prisma.UserWishlistGetPayload<{
  include: typeof userWishlistInclude;
}>;
type TransactionReader = Pick<PrismaService, "userCard" | "userWishlist">;

type CardSource =
  | { kind: typeof CollectionStatus.OWNED; row: UserCardRow }
  | { kind: typeof CollectionStatus.WANTED; row: UserWishlistRow };

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly catalogIndexService: CatalogIndexService,
    private readonly catalogQueryService: CatalogQueryService,
    private readonly titleNormalizationService: TitleNormalizationService,
  ) {}

  async listCards(params: {
    userId: string;
    q?: string;
    queryMode?: CardQueryMode;
    collectionStatus?: CollectionStatus;
    page?: number;
    pageSize?: number;
    sortBy?: CardSortBy;
    sortDirection?: SortDirection;
  }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize =
      params.pageSize && params.pageSize > 0
        ? Math.min(params.pageSize, 100)
        : 25;
    const interpreted = this.catalogQueryService.interpret(
      params.q,
      params.queryMode,
    );
    const effectiveStatus =
      params.collectionStatus ?? interpreted.collectionStatus;

    const [owned, wanted] = await Promise.all([
      effectiveStatus === CollectionStatus.WANTED
        ? Promise.resolve([] as UserCardRow[])
        : this.prisma.userCard.findMany({
            where: this.buildUserCardWhere(params.userId, interpreted),
            include: userCardInclude,
            orderBy: { createdAt: "desc" },
          }),
      effectiveStatus === CollectionStatus.OWNED
        ? Promise.resolve([] as UserWishlistRow[])
        : this.prisma.userWishlist.findMany({
            where: this.buildUserWishlistWhere(params.userId, interpreted),
            include: userWishlistInclude,
            orderBy: { createdAt: "desc" },
          }),
    ]);

    const combined = [
      ...owned.map((row) =>
        this.toCardListItem({ kind: CollectionStatus.OWNED, row }),
      ),
      ...wanted.map((row) =>
        this.toCardListItem({ kind: CollectionStatus.WANTED, row }),
      ),
    ].sort((left, right) =>
      this.compareCardItems(
        left,
        right,
        params.sortBy ?? CardSortBy.UPDATED_AT,
        params.sortDirection ?? SortDirection.DESC,
      ),
    );

    const total = combined.length;
    const items = combined.slice((page - 1) * pageSize, page * pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getCard(cardId: number, userId: string): Promise<CardDetailDto> {
    const card = await this.findCardSource(userId, cardId);
    if (!card) {
      throw new NotFoundException("Card not found.");
    }

    return this.toCardDetail(card);
  }

  async normalizeTitle(
    rawTitle: string,
    fields: NormalizeTitleFieldsDto | NormalizedTitleFields = {},
  ) {
    return this.titleNormalizationService.normalize(rawTitle, fields);
  }

  getTaxonomy() {
    return getTaxonomyForResponse();
  }

  async updateCard(
    cardId: number,
    userId: string,
    dto: UpdateCardDto,
  ): Promise<CardDetailDto> {
    const current = await this.findCardSource(userId, cardId);
    if (!current) {
      throw new NotFoundException("Card not found.");
    }

    const nextDraft = this.buildCatalogDraftInput(current, dto);
    const { cardDefinition } =
      await this.catalogIndexService.upsertCatalogNodes(nextDraft);
    const nextStatus = dto.collectionStatus ?? current.kind;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (
        current.kind === CollectionStatus.OWNED &&
        nextStatus === CollectionStatus.WANTED
      ) {
        const existingWishlist = await tx.userWishlist.findFirst({
          where: {
            userId: current.row.userId,
            cardDefinitionId: cardDefinition.id,
            NOT: { id: current.row.id },
          },
        });

        if (existingWishlist) {
          await tx.userWishlist.delete({ where: { id: existingWishlist.id } });
        }

        await tx.userWishlist.create({
          data: {
            id: current.row.id,
            userId: current.row.userId,
            cardDefinitionId: cardDefinition.id,
            priority: dto.priority !== undefined ? dto.priority : null,
            notes: dto.notes !== undefined ? dto.notes : current.row.notes,
            imageUrl: current.row.imageUrl,
            originalImageKey: current.row.originalImageKey,
            thumbnailImageKey: current.row.thumbnailImageKey,
            frontImageKey: current.row.frontImageKey,
            backImageKey: current.row.backImageKey,
            confidence: current.row.confidence,
            scanJobId: current.row.scanJobId,
            createdAt: current.row.createdAt,
            updatedAt: current.row.updatedAt,
          },
        });
        await this.syncCardRecordSequence(tx, "UserWishlist");
        await tx.userCard.delete({ where: { id: current.row.id } });
      } else if (
        current.kind === CollectionStatus.WANTED &&
        nextStatus === CollectionStatus.OWNED
      ) {
        const existingOwned = await tx.userCard.findFirst({
          where: {
            userId: current.row.userId,
            cardDefinitionId: cardDefinition.id,
            NOT: { id: current.row.id },
          },
          orderBy: { id: "asc" },
        });

        if (existingOwned) {
          await tx.userCard.delete({ where: { id: existingOwned.id } });
        }

        await tx.userCard.create({
          data: {
            id: current.row.id,
            userId: current.row.userId,
            cardDefinitionId: cardDefinition.id,
            condition: dto.condition !== undefined ? dto.condition : null,
            isAutographed: dto.isAutographed ?? false,
            autographFormat:
              dto.autographFormat !== undefined ? dto.autographFormat : null,
            imageUrl: current.row.imageUrl,
            originalImageKey: current.row.originalImageKey,
            thumbnailImageKey: current.row.thumbnailImageKey,
            frontImageKey: current.row.frontImageKey,
            backImageKey: current.row.backImageKey,
            isForTrade: dto.isForTrade ?? false,
            isForSale: dto.isForSale ?? false,
            askingPriceCents:
              dto.askingPriceCents !== undefined ? dto.askingPriceCents : null,
            notes: dto.notes !== undefined ? dto.notes : current.row.notes,
            gradeEstimate:
              dto.gradeEstimate !== undefined
                ? dto.gradeEstimate
                : current.row.gradeEstimate,
            confidence: current.row.confidence,
            scanJobId: current.row.scanJobId,
            createdAt: current.row.createdAt,
            updatedAt: current.row.updatedAt,
          },
        });
        await this.syncCardRecordSequence(tx, "UserCard");
        await tx.userWishlist.delete({ where: { id: current.row.id } });
      } else if (current.kind === CollectionStatus.OWNED) {
        await tx.userCard.update({
          where: { id: current.row.id },
          data: {
            cardDefinitionId: cardDefinition.id,
            condition:
              dto.condition !== undefined
                ? dto.condition
                : current.row.condition,
            isAutographed:
              dto.isAutographed !== undefined
                ? dto.isAutographed
                : current.row.isAutographed,
            autographFormat:
              dto.autographFormat !== undefined
                ? dto.autographFormat
                : current.row.autographFormat,
            isForTrade:
              dto.isForTrade !== undefined
                ? dto.isForTrade
                : current.row.isForTrade,
            isForSale:
              dto.isForSale !== undefined
                ? dto.isForSale
                : current.row.isForSale,
            askingPriceCents:
              dto.askingPriceCents !== undefined
                ? dto.askingPriceCents
                : current.row.askingPriceCents,
            notes: dto.notes !== undefined ? dto.notes : current.row.notes,
            gradeEstimate:
              dto.gradeEstimate !== undefined
                ? dto.gradeEstimate
                : current.row.gradeEstimate,
          },
        });
      } else {
        await tx.userWishlist.update({
          where: { id: current.row.id },
          data: {
            cardDefinitionId: cardDefinition.id,
            priority:
              dto.priority !== undefined ? dto.priority : current.row.priority,
            notes: dto.notes !== undefined ? dto.notes : current.row.notes,
            frontImageKey: current.row.frontImageKey,
            backImageKey: current.row.backImageKey,
          },
        });
      }

      return this.findCardSourceWithin(tx, userId, cardId);
    });

    if (!updated) {
      throw new NotFoundException("Card not found after update.");
    }

    return this.toCardDetail(updated);
  }

  async getCardImage(
    cardId: number,
    userId: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    return this.getCardImageByKind(cardId, userId, "primary");
  }

  async getCardImageByKind(
    cardId: number,
    userId: string,
    kind: "primary" | "front" | "back" | "canonical",
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const card = await this.findCardSource(userId, cardId);
    if (!card) {
      throw new NotFoundException("Card not found.");
    }

    const imageTarget = this.resolveImageTarget(card, kind);

    if (!imageTarget) {
      throw new NotFoundException("Card image not found.");
    }

    if (imageTarget.type === "remote") {
      return this.fetchExternalImage(imageTarget.url);
    }

    if (imageTarget.bucket === "canonical") {
      return this.storageService.readCanonicalCardImage(imageTarget.key);
    }

    return this.storageService.readCardImage(imageTarget.key);
  }

  async uploadCardImage(
    cardId: number,
    userId: string,
    kind: "front" | "back" | "canonical",
    file: UploadedFile,
  ): Promise<CardDetailDto> {
    const current = await this.findCardSource(userId, cardId);
    if (!current) {
      throw new NotFoundException("Card not found.");
    }

    if (kind === "canonical") {
      const stored = await this.storageService.uploadCanonicalCardImage(
        file.buffer,
        file.originalname,
      );
      await this.prisma.cardDefinition.update({
        where: { id: current.row.cardDefinition.id },
        data: {
          canonicalImageUrl: null,
          canonicalOriginalImageKey: stored.originalKey,
          canonicalThumbnailImageKey: stored.thumbnailKey,
          canonicalSourceUserId: userId,
          canonicalSelectedAt: new Date(),
          canonicalSelectedByUserId: userId,
        },
      });
    } else {
      const stored = await this.storageService.uploadCardImage(
        file.buffer,
        file.originalname,
      );
      const commonData =
        kind === "front"
          ? {
              imageUrl: stored.thumbnailKey,
              originalImageKey: stored.originalKey,
              thumbnailImageKey: stored.thumbnailKey,
              frontImageKey: stored.thumbnailKey,
            }
          : {
              backImageKey: stored.thumbnailKey,
            };

      if (current.kind === CollectionStatus.OWNED) {
        await this.prisma.userCard.update({
          where: { id: current.row.id },
          data: commonData,
        });
      } else {
        await this.prisma.userWishlist.update({
          where: { id: current.row.id },
          data: commonData,
        });
      }
    }

    const updated = await this.findCardSource(userId, cardId);
    if (!updated) {
      throw new NotFoundException("Card not found after image update.");
    }

    return this.toCardDetail(updated);
  }

  async clearCardImage(
    cardId: number,
    userId: string,
    kind: "front" | "back" | "canonical",
  ): Promise<CardDetailDto> {
    const current = await this.findCardSource(userId, cardId);
    if (!current) {
      throw new NotFoundException("Card not found.");
    }

    if (kind === "canonical") {
      await Promise.all([
        this.storageService.deleteCardImage(
          current.row.cardDefinition.canonicalOriginalImageKey,
        ),
        this.storageService.deleteCardImage(
          current.row.cardDefinition.canonicalThumbnailImageKey,
        ),
      ]);
      await this.prisma.cardDefinition.update({
        where: { id: current.row.cardDefinition.id },
        data: {
          canonicalImageUrl: null,
          canonicalOriginalImageKey: null,
          canonicalThumbnailImageKey: null,
          canonicalSourceUserId: null,
          canonicalSelectedAt: null,
          canonicalSelectedByUserId: null,
        },
      });
    } else if (current.kind === CollectionStatus.OWNED) {
      if (kind === "front") {
        await Promise.all([
          this.storageService.deleteCardImage(current.row.originalImageKey),
          this.storageService.deleteCardImage(current.row.thumbnailImageKey),
        ]);
        await this.prisma.userCard.update({
          where: { id: current.row.id },
          data: {
            imageUrl: null,
            originalImageKey: null,
            thumbnailImageKey: null,
            frontImageKey: null,
          },
        });
      } else {
        await this.storageService.deleteCardImage(current.row.backImageKey);
        await this.prisma.userCard.update({
          where: { id: current.row.id },
          data: {
            backImageKey: null,
          },
        });
      }
    } else if (kind === "front") {
      await Promise.all([
        this.storageService.deleteCardImage(current.row.originalImageKey),
        this.storageService.deleteCardImage(current.row.thumbnailImageKey),
      ]);
      await this.prisma.userWishlist.update({
        where: { id: current.row.id },
        data: {
          imageUrl: null,
          originalImageKey: null,
          thumbnailImageKey: null,
          frontImageKey: null,
        },
      });
    } else {
      await this.storageService.deleteCardImage(current.row.backImageKey);
      await this.prisma.userWishlist.update({
        where: { id: current.row.id },
        data: {
          backImageKey: null,
        },
      });
    }

    const updated = await this.findCardSource(userId, cardId);
    if (!updated) {
      throw new NotFoundException("Card not found after image clear.");
    }

    return this.toCardDetail(updated);
  }

  private buildUserCardWhere(
    userId: string,
    filters: CatalogSearchFilters,
  ): Prisma.UserCardWhereInput {
    const where: Prisma.UserCardWhereInput = {
      userId,
    };
    const definition = this.buildDefinitionSearchWhere(filters);
    if (definition) {
      where.cardDefinition = { is: definition };
    }
    if (filters.isForTrade !== undefined) {
      where.isForTrade = filters.isForTrade;
    }
    if (filters.isForSale !== undefined) {
      where.isForSale = filters.isForSale;
    }
    if (filters.isAutographed !== undefined) {
      where.isAutographed = filters.isAutographed;
    }
    return where;
  }

  private buildUserWishlistWhere(
    userId: string,
    filters: CatalogSearchFilters,
  ): Prisma.UserWishlistWhereInput {
    const where: Prisma.UserWishlistWhereInput = {
      userId,
    };
    const definition = this.buildDefinitionSearchWhere(filters);
    if (definition) {
      where.cardDefinition = { is: definition };
    }
    if (filters.priority !== undefined) {
      where.priority = filters.priority;
    }
    return where;
  }

  private buildDefinitionSearchWhere(
    filters: CatalogSearchFilters,
  ): Prisma.CardDefinitionWhereInput | null {
    const clauses: Prisma.CardDefinitionWhereInput[] = [];

    if (filters.searchText?.trim()) {
      const q = filters.searchText.trim();
      clauses.push({
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { player: { contains: q, mode: "insensitive" } },
          { variant: { contains: q, mode: "insensitive" } },
          { legacySetText: { contains: q, mode: "insensitive" } },
          { cardNumber: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
          { subcategory: { contains: q, mode: "insensitive" } },
          { originalOrReprint: { contains: q, mode: "insensitive" } },
          { parallelOrVariety: { contains: q, mode: "insensitive" } },
          { setType: { contains: q, mode: "insensitive" } },
          { insertSetName: { contains: q, mode: "insensitive" } },
          { cardType: { contains: q, mode: "insensitive" } },
          {
            cardSet: {
              is: {
                OR: [
                  { brand: { contains: q, mode: "insensitive" } },
                  { setName: { contains: q, mode: "insensitive" } },
                  { season: { contains: q, mode: "insensitive" } },
                  { sport: { contains: q, mode: "insensitive" } },
                  { language: { contains: q, mode: "insensitive" } },
                  { material: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      });
    }

    if (filters.cardNumber) {
      clauses.push({
        cardNumber: {
          contains: filters.cardNumber,
          mode: "insensitive",
        },
      });
    }

    if (filters.brand) {
      clauses.push({
        cardSet: {
          is: {
            brand: {
              contains: filters.brand,
              mode: "insensitive",
            },
          },
        },
      });
    }

    if (filters.setName) {
      clauses.push({
        cardSet: {
          is: {
            OR: [
              {
                setName: {
                  contains: filters.setName,
                  mode: "insensitive",
                },
              },
              {
                brand: {
                  contains: filters.setName,
                  mode: "insensitive",
                },
              },
            ],
          },
        },
      });
    }

    if (filters.season) {
      clauses.push({
        cardSet: {
          is: {
            season: {
              contains: filters.season,
              mode: "insensitive",
            },
          },
        },
      });
    }

    if (filters.year !== undefined) {
      clauses.push({
        cardSet: {
          is: {
            yearManufactured: filters.year,
          },
        },
      });
    }

    if (filters.sport) {
      clauses.push({
        cardSet: {
          is: {
            sport: {
              equals: filters.sport,
              mode: "insensitive",
            },
          },
        },
      });
    }

    if (filters.isVintage !== undefined) {
      clauses.push({
        isVintage: filters.isVintage,
      });
    }

    if (!clauses.length) {
      return null;
    }

    return clauses.length === 1 ? clauses[0] : { AND: clauses };
  }

  private async findCardSource(
    userId: string,
    cardId: number,
  ): Promise<CardSource | null> {
    return this.findCardSourceWithin(this.prisma, userId, cardId);
  }

  private async findCardSourceWithin(
    prisma: TransactionReader,
    userId: string,
    cardId: number,
  ): Promise<CardSource | null> {
    const [owned, wanted] = await Promise.all([
      prisma.userCard.findFirst({
        where: { id: cardId, userId },
        include: userCardInclude,
      }),
      prisma.userWishlist.findFirst({
        where: { id: cardId, userId },
        include: userWishlistInclude,
      }),
    ]);

    if (owned) {
      return { kind: CollectionStatus.OWNED, row: owned };
    }

    if (wanted) {
      return { kind: CollectionStatus.WANTED, row: wanted };
    }

    return null;
  }

  private buildCatalogDraftInput(
    source: CardSource,
    dto: UpdateCardDto,
  ): CatalogDraftInput {
    const definition = source.row.cardDefinition;
    const cardSet = definition.cardSet;

    return {
      name: dto.name ?? definition.name,
      brand: dto.brand !== undefined ? dto.brand : (cardSet?.brand ?? null),
      set:
        dto.legacySetText !== undefined
          ? dto.legacySetText
          : definition.legacySetText,
      setName:
        dto.setName !== undefined
          ? dto.setName
          : (cardSet?.setName ?? definition.legacySetText),
      yearManufactured:
        dto.yearManufactured !== undefined
          ? dto.yearManufactured
          : (cardSet?.yearManufactured ?? null),
      player: dto.player !== undefined ? dto.player : definition.player,
      variant: dto.variant !== undefined ? dto.variant : definition.variant,
      sport: dto.sport !== undefined ? dto.sport : (cardSet?.sport ?? null),
      season: dto.season !== undefined ? dto.season : (cardSet?.season ?? null),
      cardNumber:
        dto.cardNumber !== undefined ? dto.cardNumber : definition.cardNumber,
      category: dto.category !== undefined ? dto.category : definition.category,
      subcategory:
        dto.subcategory !== undefined
          ? dto.subcategory
          : definition.subcategory,
      hasAutographVariant:
        dto.hasAutographVariant !== undefined
          ? dto.hasAutographVariant
          : definition.hasAutographVariant,
      originalOrReprint:
        dto.originalOrReprint !== undefined
          ? dto.originalOrReprint
          : definition.originalOrReprint,
      parallelOrVariety:
        dto.parallelOrVariety !== undefined
          ? dto.parallelOrVariety
          : definition.parallelOrVariety,
      setType: dto.setType !== undefined ? dto.setType : definition.setType,
      insertSetName:
        dto.insertSetName !== undefined
          ? dto.insertSetName
          : definition.insertSetName,
      cardType: dto.cardType !== undefined ? dto.cardType : definition.cardType,
      isVintage:
        dto.isVintage !== undefined ? dto.isVintage : definition.isVintage,
    };
  }

  private toCardListItem(source: CardSource): CardListItemDto {
    const definition = source.row.cardDefinition;
    const cardSet = definition.cardSet;
    const title = [
      cardSet?.yearManufactured ?? null,
      definition.player,
      definition.name,
    ]
      .filter(Boolean)
      .join(" · ");
    const subtitleParts = [
      cardSet?.brand,
      cardSet?.setName ?? definition.legacySetText,
      definition.cardNumber ? `#${definition.cardNumber}` : null,
      definition.variant,
      cardSet?.season,
    ].filter(Boolean);
    const imageMeta = this.resolveCardImageMeta(source);

    return {
      id: source.row.id,
      title,
      subtitle: subtitleParts.join(" · "),
      imageUrl: imageMeta.imageUrl,
      imageSource: imageMeta.imageSource,
      canonicalImageUrl: imageMeta.canonicalImageUrl,
      personalImageUrl: imageMeta.personalImageUrl,
      frontImageUrl: imageMeta.frontImageUrl,
      backImageUrl: imageMeta.backImageUrl,
      collectionStatus: source.kind,
      definition: {
        id: definition.id,
        normalizedCardKey: definition.normalizedCardKey,
        cardNumber: definition.cardNumber,
        name: definition.name,
        player: definition.player,
        variant: definition.variant,
        legacySetText: definition.legacySetText,
        category: definition.category,
        subcategory: definition.subcategory,
        hasAutographVariant: definition.hasAutographVariant,
        features:
          (definition.features as Record<string, unknown> | null) ?? null,
        originalOrReprint: definition.originalOrReprint,
        parallelOrVariety: definition.parallelOrVariety,
        setType: definition.setType,
        insertSetName: definition.insertSetName,
        cardType: definition.cardType,
        isVintage: definition.isVintage,
        metadata:
          (definition.metadata as Record<string, unknown> | null) ?? null,
        cardSet: cardSet
          ? {
              id: cardSet.id,
              brand: cardSet.brand,
              setName: cardSet.setName,
              yearManufactured: cardSet.yearManufactured,
              sport: cardSet.sport,
              season: cardSet.season,
              cardConditionScale: cardSet.cardConditionScale,
              cardSize: cardSet.cardSize,
              cardThicknessPt: cardSet.cardThicknessPt,
              countryOfOrigin: cardSet.countryOfOrigin,
              language: cardSet.language,
              material: cardSet.material,
              metadata:
                (cardSet.metadata as Record<string, unknown> | null) ?? null,
            }
          : null,
      },
      record: this.toCardCollectionRecord(source, imageMeta),
    };
  }

  private toCardDetail(source: CardSource): CardDetailDto {
    return this.toCardListItem(source);
  }

  private compareCardItems(
    left: CardListItemDto,
    right: CardListItemDto,
    sortBy: CardSortBy,
    sortDirection: SortDirection,
  ) {
    const primary = this.compareSortValues(
      this.readSortValue(left, sortBy),
      this.readSortValue(right, sortBy),
      sortDirection,
    );

    if (primary !== 0) {
      return primary;
    }

    const updatedTieBreak = this.compareSortValues(
      left.record.updatedAt,
      right.record.updatedAt,
      SortDirection.DESC,
    );

    if (updatedTieBreak !== 0) {
      return updatedTieBreak;
    }

    const titleTieBreak = this.compareSortValues(
      left.title,
      right.title,
      SortDirection.ASC,
    );
    if (titleTieBreak !== 0) {
      return titleTieBreak;
    }

    return left.id - right.id;
  }

  private readSortValue(
    card: CardListItemDto,
    sortBy: CardSortBy,
  ): string | number | boolean | Date | null {
    switch (sortBy) {
      case CardSortBy.TITLE:
        return card.title;
      case CardSortBy.PLAYER:
        return card.definition.player;
      case CardSortBy.BRAND:
        return card.definition.cardSet?.brand ?? null;
      case CardSortBy.SET_NAME:
        return (
          card.definition.cardSet?.setName ?? card.definition.legacySetText
        );
      case CardSortBy.YEAR_MANUFACTURED:
        return card.definition.cardSet?.yearManufactured ?? null;
      case CardSortBy.SEASON:
        return card.definition.cardSet?.season ?? null;
      case CardSortBy.CARD_NUMBER:
        return card.definition.cardNumber;
      case CardSortBy.SPORT:
        return card.definition.cardSet?.sport ?? null;
      case CardSortBy.CATEGORY:
        return card.definition.category;
      case CardSortBy.SUBCATEGORY:
        return card.definition.subcategory;
      case CardSortBy.CARD_TYPE:
        return card.definition.cardType;
      case CardSortBy.COLLECTION_STATUS:
        return card.collectionStatus;
      case CardSortBy.CONDITION:
        return card.record.condition;
      case CardSortBy.GRADE_ESTIMATE:
        return card.record.gradeEstimate;
      case CardSortBy.IS_AUTOGRAPHED:
        return card.record.isAutographed;
      case CardSortBy.IS_FOR_TRADE:
        return card.record.isForTrade;
      case CardSortBy.IS_FOR_SALE:
        return card.record.isForSale;
      case CardSortBy.ASKING_PRICE_CENTS:
        return card.record.askingPriceCents;
      case CardSortBy.PRIORITY:
        return card.record.priority;
      case CardSortBy.CONFIDENCE:
        return card.record.confidence;
      case CardSortBy.CREATED_AT:
        return card.record.createdAt;
      case CardSortBy.UPDATED_AT:
        return card.record.updatedAt;
      default:
        return card.record.updatedAt;
    }
  }

  private compareSortValues(
    left: string | number | boolean | Date | null,
    right: string | number | boolean | Date | null,
    direction: SortDirection,
  ) {
    const leftEmpty =
      left === null ||
      left === undefined ||
      (typeof left === "string" && !left.trim());
    const rightEmpty =
      right === null ||
      right === undefined ||
      (typeof right === "string" && !right.trim());

    if (leftEmpty && rightEmpty) {
      return 0;
    }

    if (leftEmpty) {
      return 1;
    }

    if (rightEmpty) {
      return -1;
    }

    let compared = 0;

    if (left instanceof Date && right instanceof Date) {
      compared = left.getTime() - right.getTime();
    } else if (typeof left === "boolean" && typeof right === "boolean") {
      compared = Number(left) - Number(right);
    } else if (typeof left === "number" && typeof right === "number") {
      compared = left - right;
    } else {
      compared = String(left).localeCompare(String(right), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    }

    if (compared === 0) {
      return 0;
    }

    return direction === SortDirection.ASC ? compared : -compared;
  }

  private async syncCardRecordSequence(
    tx: Prisma.TransactionClient,
    table: "UserCard" | "UserWishlist",
  ) {
    const quotedTable = `"${table}"`;
    await tx.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('${quotedTable}', 'id'), COALESCE((SELECT MAX("id") FROM ${quotedTable}), 0) + 1, false);`,
    );
  }

  private async fetchExternalImage(
    url: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new NotFoundException("Card image fetch failed.");
      }

      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      const bytes = await response.arrayBuffer();
      return {
        buffer: Buffer.from(bytes),
        contentType,
      };
    } catch {
      throw new NotFoundException("Card image not reachable.");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private toCardCollectionRecord(
    source: CardSource,
    imageMeta: ReturnType<CatalogService["resolveCardImageMeta"]>,
  ): CardCollectionRecordDto {
    if (source.kind === CollectionStatus.OWNED) {
      return {
        collectionStatus: source.kind,
        personalImageUrl: imageMeta.personalImageUrl,
        frontImageUrl: imageMeta.frontImageUrl,
        backImageUrl: imageMeta.backImageUrl,
        condition: source.row.condition ?? null,
        isAutographed: source.row.isAutographed,
        autographFormat: source.row.autographFormat ?? null,
        isForTrade: source.row.isForTrade,
        isForSale: source.row.isForSale,
        askingPriceCents: source.row.askingPriceCents ?? null,
        priority: null,
        notes: source.row.notes ?? null,
        gradeEstimate: source.row.gradeEstimate ?? null,
        confidence: source.row.confidence ?? null,
        scanJobId: source.row.scanJobId ?? null,
        createdAt: source.row.createdAt,
        updatedAt: source.row.updatedAt,
      };
    }

    return {
      collectionStatus: source.kind,
      personalImageUrl: imageMeta.personalImageUrl,
      frontImageUrl: imageMeta.frontImageUrl,
      backImageUrl: imageMeta.backImageUrl,
      condition: null,
      isAutographed: false,
      autographFormat: null,
      isForTrade: false,
      isForSale: false,
      askingPriceCents: null,
      priority: source.row.priority ?? null,
      notes: source.row.notes ?? null,
      gradeEstimate: source.row.gradeEstimate ?? null,
      confidence: source.row.confidence ?? null,
      scanJobId: source.row.scanJobId ?? null,
      createdAt: source.row.createdAt,
      updatedAt: source.row.updatedAt,
    };
  }

  private resolveCardImageMeta(source: CardSource) {
    const personalImageKey = this.resolvePersonalStoredImageKey(source);
    const canonicalImageTarget = this.resolveCanonicalImageTarget(source);
    const legacyImageUrl = this.resolveLegacyRemoteImageUrl(source);
    const backImageTarget = this.resolveBackImageTarget(source);

    const hasPrimaryImage = Boolean(
      personalImageKey || canonicalImageTarget || legacyImageUrl,
    );
    const imageSource = personalImageKey
      ? CardImageSourceDto.USER
      : canonicalImageTarget
        ? CardImageSourceDto.CANONICAL
        : legacyImageUrl
          ? CardImageSourceDto.LEGACY
          : CardImageSourceDto.NONE;

    return {
      imageUrl: hasPrimaryImage
        ? this.buildCardImageUrl(source.row.id, "image")
        : null,
      imageSource,
      canonicalImageUrl: canonicalImageTarget
        ? this.buildCardImageUrl(source.row.id, "images/canonical")
        : null,
      personalImageUrl: personalImageKey
        ? this.buildCardImageUrl(source.row.id, "images/front")
        : null,
      frontImageUrl: personalImageKey
        ? this.buildCardImageUrl(source.row.id, "images/front")
        : null,
      backImageUrl: backImageTarget
        ? this.buildCardImageUrl(source.row.id, "images/back")
        : null,
    };
  }

  private buildCardImageUrl(cardId: number, suffix: string) {
    return `/api/v1/cards/${cardId}/${suffix}`;
  }

  private resolveImageTarget(
    source: CardSource,
    kind: "primary" | "front" | "back" | "canonical",
  ) {
    if (kind === "canonical") {
      return this.resolveCanonicalImageTarget(source);
    }

    if (kind === "back") {
      return this.resolveBackImageTarget(source);
    }

    if (kind === "front") {
      const personalImageKey = this.resolvePersonalStoredImageKey(source);
      return personalImageKey
        ? {
            type: "stored" as const,
            bucket: "card" as const,
            key: personalImageKey,
          }
        : null;
    }

    const personalImageKey = this.resolvePersonalStoredImageKey(source);
    if (personalImageKey) {
      return {
        type: "stored" as const,
        bucket: "card" as const,
        key: personalImageKey,
      };
    }

    const canonicalImageTarget = this.resolveCanonicalImageTarget(source);
    if (canonicalImageTarget) {
      return canonicalImageTarget;
    }

    const legacyImageUrl = this.resolveLegacyRemoteImageUrl(source);
    if (legacyImageUrl) {
      return {
        type: "remote" as const,
        url: legacyImageUrl,
      };
    }

    return null;
  }

  private resolvePersonalStoredImageKey(source: CardSource) {
    const imageUrl = source.row.imageUrl ?? null;
    return (
      source.row.frontImageKey ??
      source.row.thumbnailImageKey ??
      (!isHttpUrl(imageUrl) ? imageUrl : null) ??
      source.row.originalImageKey ??
      null
    );
  }

  private resolveBackImageTarget(source: CardSource) {
    const backImageKey = source.row.backImageKey ?? null;
    if (!backImageKey) {
      return null;
    }

    return {
      type: isHttpUrl(backImageKey) ? ("remote" as const) : ("stored" as const),
      bucket: "card" as const,
      key: backImageKey,
      url: backImageKey,
    };
  }

  private resolveCanonicalImageTarget(source: CardSource) {
    const definition = source.row.cardDefinition;
    const storedKey =
      definition.canonicalThumbnailImageKey ??
      definition.canonicalOriginalImageKey ??
      (!isHttpUrl(definition.canonicalImageUrl)
        ? definition.canonicalImageUrl
        : null) ??
      null;

    if (storedKey) {
      return {
        type: "stored" as const,
        bucket: "canonical" as const,
        key: storedKey,
      };
    }

    if (
      definition.canonicalImageUrl &&
      isHttpUrl(definition.canonicalImageUrl)
    ) {
      return {
        type: "remote" as const,
        url: definition.canonicalImageUrl,
      };
    }

    return null;
  }

  private resolveLegacyRemoteImageUrl(source: CardSource) {
    return source.row.imageUrl && isHttpUrl(source.row.imageUrl)
      ? source.row.imageUrl
      : null;
  }
}

function isHttpUrl(value: string | null | undefined) {
  return Boolean(
    value && (value.startsWith("http://") || value.startsWith("https://")),
  );
}
