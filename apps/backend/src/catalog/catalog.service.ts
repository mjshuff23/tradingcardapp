import { Injectable, NotFoundException } from '@nestjs/common';
import { CollectionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UpdateCardDto } from './dto/update-card.dto';
import { CatalogIndexService } from './catalog-index.service';

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

type CardSource =
  | { kind: 'OWNED'; row: UserCardRow }
  | { kind: 'WANTED'; row: UserWishlistRow };

type CardRecord = {
  id: number;
  name: string;
  set: string | null;
  year: number | null;
  player: string | null;
  variant: string | null;
  sport: string | null;
  imageUrl: string | null;
  originalImageKey: string | null;
  thumbnailImageKey: string | null;
  confidence: number | null;
  collectionStatus: CollectionStatus;
  gradeEstimate: string | null;
};

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly catalogIndexService: CatalogIndexService,
  ) {}

  async listCards(params: {
    q?: string;
    collectionStatus?: CollectionStatus;
    page?: number;
    pageSize?: number;
  }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize = params.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 25;

    const [owned, wanted] = await Promise.all([
      params.collectionStatus === CollectionStatus.WANTED
        ? Promise.resolve([] as UserCardRow[])
        : this.prisma.userCard.findMany({
            where: this.buildUserCardWhere(params.q),
            include: userCardInclude,
            orderBy: { createdAt: 'desc' },
          }),
      params.collectionStatus === CollectionStatus.OWNED
        ? Promise.resolve([] as UserWishlistRow[])
        : this.prisma.userWishlist.findMany({
            where: this.buildUserWishlistWhere(params.q),
            include: userWishlistInclude,
            orderBy: { createdAt: 'desc' },
          }),
    ]);

    const combined = [
      ...owned.map((row) => ({ createdAt: row.createdAt, item: this.toCardRecord({ kind: CollectionStatus.OWNED, row }) })),
      ...wanted.map((row) => ({ createdAt: row.createdAt, item: this.toCardRecord({ kind: CollectionStatus.WANTED, row }) })),
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

  async getCard(cardId: number): Promise<CardRecord> {
    const card = await this.findCardSource(cardId);
    if (!card) {
      throw new NotFoundException('Card not found.');
    }

    return this.toCardRecord(card);
  }

  async updateCard(cardId: number, dto: UpdateCardDto): Promise<CardRecord> {
    const current = await this.findCardSource(cardId);
    if (!current) {
      throw new NotFoundException('Card not found.');
    }

    const currentRecord = this.toCardRecord(current);
    const nextDraft = {
      name: dto.name ?? currentRecord.name,
      set: dto.set !== undefined ? dto.set : currentRecord.set,
      year: dto.year !== undefined ? dto.year : currentRecord.year,
      player: dto.player !== undefined ? dto.player : currentRecord.player,
      variant: dto.variant !== undefined ? dto.variant : currentRecord.variant,
      sport: dto.sport !== undefined ? dto.sport : currentRecord.sport,
    };

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
            notes: current.row.notes,
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
        await tx.userCard.delete({ where: { id: current.row.id } });
      } else if (current.kind === CollectionStatus.WANTED && nextStatus === CollectionStatus.OWNED) {
        await tx.userCard.create({
          data: {
            id: current.row.id,
            userId: current.row.userId,
            cardDefinitionId: cardDefinition.id,
            imageUrl: current.row.imageUrl,
            originalImageKey: current.row.originalImageKey,
            thumbnailImageKey: current.row.thumbnailImageKey,
            notes: current.row.notes,
            gradeEstimate:
              dto.gradeEstimate !== undefined ? dto.gradeEstimate : current.row.gradeEstimate,
            confidence: current.row.confidence,
            scanJobId: current.row.scanJobId,
            createdAt: current.row.createdAt,
            updatedAt: current.row.updatedAt,
          },
        });
        await tx.userWishlist.delete({ where: { id: current.row.id } });
      } else if (current.kind === CollectionStatus.OWNED) {
        await tx.userCard.update({
          where: { id: current.row.id },
          data: {
            cardDefinitionId: cardDefinition.id,
            gradeEstimate: dto.gradeEstimate !== undefined ? dto.gradeEstimate : undefined,
          },
        });
      } else {
        await tx.userWishlist.update({
          where: { id: current.row.id },
          data: {
            cardDefinitionId: cardDefinition.id,
            gradeEstimate: dto.gradeEstimate !== undefined ? dto.gradeEstimate : undefined,
          },
        });
      }

      return this.findCardSourceWithin(tx, cardId);
    });

    if (!updated) {
      throw new NotFoundException('Card not found after update.');
    }

    return this.toCardRecord(updated);
  }

  async getCardImage(
    cardId: number,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const card = await this.findCardSource(cardId);
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

    return this.storageService.readImage(key);
  }

  private buildUserCardWhere(q?: string): Prisma.UserCardWhereInput {
    const definition = this.buildDefinitionSearchWhere(q);
    return definition ? { cardDefinition: { is: definition } } : {};
  }

  private buildUserWishlistWhere(q?: string): Prisma.UserWishlistWhereInput {
    const definition = this.buildDefinitionSearchWhere(q);
    return definition ? { cardDefinition: { is: definition } } : {};
  }

  private buildDefinitionSearchWhere(q?: string): Prisma.CardDefinitionWhereInput | null {
    if (!q?.trim()) {
      return null;
    }

    return {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { player: { contains: q, mode: 'insensitive' } },
        { variant: { contains: q, mode: 'insensitive' } },
        { legacySetText: { contains: q, mode: 'insensitive' } },
        {
          cardSet: {
            is: {
              OR: [
                { setName: { contains: q, mode: 'insensitive' } },
                { brand: { contains: q, mode: 'insensitive' } },
                { sport: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    };
  }

  private async findCardSource(cardId: number): Promise<CardSource | null> {
    return this.findCardSourceWithin(this.prisma, cardId);
  }

  private async findCardSourceWithin(
    prisma: Pick<PrismaService, 'userCard' | 'userWishlist'>,
    cardId: number,
  ): Promise<CardSource | null> {
    const [owned, wanted] = await Promise.all([
      prisma.userCard.findUnique({
        where: { id: cardId },
        include: userCardInclude,
      }),
      prisma.userWishlist.findUnique({
        where: { id: cardId },
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

  private toCardRecord(source: CardSource): CardRecord {
    const definition = source.row.cardDefinition;
    const set = definition.cardSet?.setName ?? definition.legacySetText ?? null;
    const year = definition.cardSet?.yearManufactured ?? null;
    const sport = definition.cardSet?.sport ?? null;

    return {
      id: source.row.id,
      name: definition.name,
      set,
      year,
      player: definition.player,
      variant: definition.variant,
      sport,
      imageUrl: source.row.imageUrl ?? source.row.thumbnailImageKey ?? source.row.originalImageKey ?? null,
      originalImageKey: source.row.originalImageKey ?? null,
      thumbnailImageKey: source.row.thumbnailImageKey ?? null,
      confidence: source.row.confidence ?? null,
      collectionStatus: source.kind,
      gradeEstimate: source.row.gradeEstimate ?? null,
    };
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
