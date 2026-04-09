import { Injectable, NotFoundException } from '@nestjs/common';
import { CatalogDraftInput } from '../common/catalog-normalization.util';
import { CollectionStatus, Prisma } from '../prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CatalogIndexService } from './catalog-index.service';
import { CatalogQueryService, CatalogSearchFilters } from './catalog-query.service';
import {
  CardDetailDto,
  CardListItemDto,
} from './dto/card-response.dto';
import { CardQueryMode } from './dto/list-cards-query.dto';
import { UpdateCardDto } from './dto/update-card.dto';

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

type UserCardRow = Prisma.UserCardGetPayload<{ include: typeof userCardInclude }>;
type UserWishlistRow = Prisma.UserWishlistGetPayload<{ include: typeof userWishlistInclude }>;
type TransactionReader = Pick<PrismaService, 'userCard' | 'userWishlist'>;

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
  ) {}

  async listCards(params: {
    userId: string;
    q?: string;
    queryMode?: CardQueryMode;
    collectionStatus?: CollectionStatus;
    page?: number;
    pageSize?: number;
  }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize = params.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 25;
    const interpreted = this.catalogQueryService.interpret(params.q, params.queryMode);
    const effectiveStatus = params.collectionStatus ?? interpreted.collectionStatus;

    const [owned, wanted] = await Promise.all([
      effectiveStatus === CollectionStatus.WANTED
        ? Promise.resolve([] as UserCardRow[])
        : this.prisma.userCard.findMany({
            where: this.buildUserCardWhere(params.userId, interpreted),
            include: userCardInclude,
            orderBy: { createdAt: 'desc' },
          }),
      effectiveStatus === CollectionStatus.OWNED
        ? Promise.resolve([] as UserWishlistRow[])
        : this.prisma.userWishlist.findMany({
            where: this.buildUserWishlistWhere(params.userId, interpreted),
            include: userWishlistInclude,
            orderBy: { createdAt: 'desc' },
          }),
    ]);

    const combined = [
      ...owned.map((row) => ({
        createdAt: row.createdAt,
        item: this.toCardListItem({ kind: CollectionStatus.OWNED, row }),
      })),
      ...wanted.map((row) => ({
        createdAt: row.createdAt,
        item: this.toCardListItem({ kind: CollectionStatus.WANTED, row }),
      })),
    ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    const total = combined.length;
    const items = combined.slice((page - 1) * pageSize, page * pageSize).map((entry) => entry.item);

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
      throw new NotFoundException('Card not found.');
    }

    return this.toCardDetail(card);
  }

  async updateCard(cardId: number, userId: string, dto: UpdateCardDto): Promise<CardDetailDto> {
    const current = await this.findCardSource(userId, cardId);
    if (!current) {
      throw new NotFoundException('Card not found.');
    }

    const nextDraft = this.buildCatalogDraftInput(current, dto);
    const { cardDefinition } = await this.catalogIndexService.upsertCatalogNodes(nextDraft);
    const nextStatus = dto.collectionStatus ?? current.kind;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (current.kind === CollectionStatus.OWNED && nextStatus === CollectionStatus.WANTED) {
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
            gradeEstimate:
              dto.gradeEstimate !== undefined ? dto.gradeEstimate : current.row.gradeEstimate,
            confidence: current.row.confidence,
            scanJobId: current.row.scanJobId,
            createdAt: current.row.createdAt,
            updatedAt: current.row.updatedAt,
          },
        });
        await this.syncCardRecordSequence(tx, 'UserWishlist');
        await tx.userCard.delete({ where: { id: current.row.id } });
      } else if (current.kind === CollectionStatus.WANTED && nextStatus === CollectionStatus.OWNED) {
        const existingOwned = await tx.userCard.findFirst({
          where: {
            userId: current.row.userId,
            cardDefinitionId: cardDefinition.id,
            NOT: { id: current.row.id },
          },
          orderBy: { id: 'asc' },
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
            autographFormat: dto.autographFormat !== undefined ? dto.autographFormat : null,
            imageUrl: current.row.imageUrl,
            originalImageKey: current.row.originalImageKey,
            thumbnailImageKey: current.row.thumbnailImageKey,
            frontImageKey: null,
            backImageKey: null,
            isForTrade: dto.isForTrade ?? false,
            isForSale: dto.isForSale ?? false,
            askingPriceCents:
              dto.askingPriceCents !== undefined ? dto.askingPriceCents : null,
            notes: dto.notes !== undefined ? dto.notes : current.row.notes,
            gradeEstimate:
              dto.gradeEstimate !== undefined ? dto.gradeEstimate : current.row.gradeEstimate,
            confidence: current.row.confidence,
            scanJobId: current.row.scanJobId,
            createdAt: current.row.createdAt,
            updatedAt: current.row.updatedAt,
          },
        });
        await this.syncCardRecordSequence(tx, 'UserCard');
        await tx.userWishlist.delete({ where: { id: current.row.id } });
      } else if (current.kind === CollectionStatus.OWNED) {
        await tx.userCard.update({
          where: { id: current.row.id },
          data: {
            cardDefinitionId: cardDefinition.id,
            condition: dto.condition !== undefined ? dto.condition : current.row.condition,
            isAutographed:
              dto.isAutographed !== undefined ? dto.isAutographed : current.row.isAutographed,
            autographFormat:
              dto.autographFormat !== undefined ? dto.autographFormat : current.row.autographFormat,
            isForTrade: dto.isForTrade !== undefined ? dto.isForTrade : current.row.isForTrade,
            isForSale: dto.isForSale !== undefined ? dto.isForSale : current.row.isForSale,
            askingPriceCents:
              dto.askingPriceCents !== undefined
                ? dto.askingPriceCents
                : current.row.askingPriceCents,
            notes: dto.notes !== undefined ? dto.notes : current.row.notes,
            gradeEstimate:
              dto.gradeEstimate !== undefined ? dto.gradeEstimate : current.row.gradeEstimate,
          },
        });
      } else {
        await tx.userWishlist.update({
          where: { id: current.row.id },
          data: {
            cardDefinitionId: cardDefinition.id,
            priority: dto.priority !== undefined ? dto.priority : current.row.priority,
            notes: dto.notes !== undefined ? dto.notes : current.row.notes,
            gradeEstimate:
              dto.gradeEstimate !== undefined ? dto.gradeEstimate : current.row.gradeEstimate,
          },
        });
      }

      return this.findCardSourceWithin(tx, userId, cardId);
    });

    if (!updated) {
      throw new NotFoundException('Card not found after update.');
    }

    return this.toCardDetail(updated);
  }

  async getCardImage(
    cardId: number,
    userId: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const card = await this.findCardSource(userId, cardId);
    if (!card) {
      throw new NotFoundException('Card not found.');
    }

    const key =
      card.row.thumbnailImageKey ??
      card.row.originalImageKey ??
      card.row.imageUrl;

    if (!key) {
      throw new NotFoundException('Card image not found.');
    }

    if (key.startsWith('http://') || key.startsWith('https://')) {
      return this.fetchExternalImage(key);
    }

    return this.storageService.readCardImage(key);
  }

  private buildUserCardWhere(userId: string, filters: CatalogSearchFilters): Prisma.UserCardWhereInput {
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
          { name: { contains: q, mode: 'insensitive' } },
          { player: { contains: q, mode: 'insensitive' } },
          { variant: { contains: q, mode: 'insensitive' } },
          { legacySetText: { contains: q, mode: 'insensitive' } },
          { cardNumber: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
          { subcategory: { contains: q, mode: 'insensitive' } },
          { originalOrReprint: { contains: q, mode: 'insensitive' } },
          { parallelOrVariety: { contains: q, mode: 'insensitive' } },
          { setType: { contains: q, mode: 'insensitive' } },
          { insertSetName: { contains: q, mode: 'insensitive' } },
          { cardType: { contains: q, mode: 'insensitive' } },
          {
            cardSet: {
              is: {
                OR: [
                  { brand: { contains: q, mode: 'insensitive' } },
                  { setName: { contains: q, mode: 'insensitive' } },
                  { season: { contains: q, mode: 'insensitive' } },
                  { sport: { contains: q, mode: 'insensitive' } },
                  { language: { contains: q, mode: 'insensitive' } },
                  { material: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
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
              mode: 'insensitive',
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

  private async findCardSource(userId: string, cardId: number): Promise<CardSource | null> {
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

  private buildCatalogDraftInput(source: CardSource, dto: UpdateCardDto): CatalogDraftInput {
    const definition = source.row.cardDefinition;
    const cardSet = definition.cardSet;

    return {
      name: dto.name ?? definition.name,
      brand: dto.brand !== undefined ? dto.brand : cardSet?.brand ?? null,
      set: dto.legacySetText !== undefined ? dto.legacySetText : definition.legacySetText,
      setName: dto.setName !== undefined ? dto.setName : cardSet?.setName ?? definition.legacySetText,
      yearManufactured:
        dto.yearManufactured !== undefined ? dto.yearManufactured : cardSet?.yearManufactured ?? null,
      player: dto.player !== undefined ? dto.player : definition.player,
      variant: dto.variant !== undefined ? dto.variant : definition.variant,
      sport: dto.sport !== undefined ? dto.sport : cardSet?.sport ?? null,
      season: dto.season !== undefined ? dto.season : cardSet?.season ?? null,
      cardNumber: dto.cardNumber !== undefined ? dto.cardNumber : definition.cardNumber,
      category: dto.category !== undefined ? dto.category : definition.category,
      subcategory: dto.subcategory !== undefined ? dto.subcategory : definition.subcategory,
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
        dto.insertSetName !== undefined ? dto.insertSetName : definition.insertSetName,
      cardType: dto.cardType !== undefined ? dto.cardType : definition.cardType,
      isVintage: dto.isVintage !== undefined ? dto.isVintage : definition.isVintage,
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
      .join(' · ');
    const subtitleParts = [
      cardSet?.brand,
      cardSet?.setName ?? definition.legacySetText,
      definition.cardNumber ? `#${definition.cardNumber}` : null,
      definition.variant,
      cardSet?.season,
    ].filter(Boolean);

    return {
      id: source.row.id,
      title,
      subtitle: subtitleParts.join(' · '),
      imageUrl:
        source.row.imageUrl ??
        source.row.thumbnailImageKey ??
        source.row.originalImageKey ??
        null,
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
        features: (definition.features as Record<string, unknown> | null) ?? null,
        originalOrReprint: definition.originalOrReprint,
        parallelOrVariety: definition.parallelOrVariety,
        setType: definition.setType,
        insertSetName: definition.insertSetName,
        cardType: definition.cardType,
        isVintage: definition.isVintage,
        metadata: (definition.metadata as Record<string, unknown> | null) ?? null,
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
              metadata: (cardSet.metadata as Record<string, unknown> | null) ?? null,
            }
          : null,
      },
      record:
        source.kind === CollectionStatus.OWNED
          ? {
              collectionStatus: source.kind,
              imageUrl: source.row.imageUrl ?? null,
              originalImageKey: source.row.originalImageKey ?? null,
              thumbnailImageKey: source.row.thumbnailImageKey ?? null,
              frontImageKey: source.row.frontImageKey ?? null,
              backImageKey: source.row.backImageKey ?? null,
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
            }
          : {
              collectionStatus: source.kind,
              imageUrl: source.row.imageUrl ?? null,
              originalImageKey: source.row.originalImageKey ?? null,
              thumbnailImageKey: source.row.thumbnailImageKey ?? null,
              frontImageKey: null,
              backImageKey: null,
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
            },
    };
  }

  private toCardDetail(source: CardSource): CardDetailDto {
    return this.toCardListItem(source);
  }

  private async syncCardRecordSequence(
    tx: Prisma.TransactionClient,
    table: 'UserCard' | 'UserWishlist',
  ) {
    const quotedTable = `"${table}"`;
    await tx.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('${quotedTable}', 'id'), COALESCE((SELECT MAX("id") FROM ${quotedTable}), 0) + 1, false);`,
    );
  }

  private async fetchExternalImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
        },
      });

      if (!response.ok) {
        throw new NotFoundException('Card image fetch failed.');
      }

      const contentType = response.headers.get('content-type') ?? 'image/jpeg';
      const bytes = await response.arrayBuffer();
      return {
        buffer: Buffer.from(bytes),
        contentType,
      };
    } catch {
      throw new NotFoundException('Card image not reachable.');
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
