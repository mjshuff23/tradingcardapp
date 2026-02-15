import { Injectable, NotFoundException } from '@nestjs/common';
import { CollectionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UpdateCardDto } from './dto/update-card.dto';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async listCards(params: {
    q?: string;
    collectionStatus?: CollectionStatus;
    page?: number;
    pageSize?: number;
  }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize = params.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 25;

    const where: Prisma.CardWhereInput = {};

    if (params.collectionStatus) {
      where.collectionStatus = params.collectionStatus;
    }

    if (params.q) {
      where.OR = [
        { name: { contains: params.q, mode: 'insensitive' } },
        { player: { contains: params.q, mode: 'insensitive' } },
        { set: { contains: params.q, mode: 'insensitive' } },
        { variant: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.card.count({ where }),
      this.prisma.card.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

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

  async getCard(cardId: number) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    if (!card) {
      throw new NotFoundException('Card not found.');
    }

    return card;
  }

  async updateCard(cardId: number, dto: UpdateCardDto) {
    await this.getCard(cardId);

    return this.prisma.card.update({
      where: { id: cardId },
      data: dto,
    });
  }

  async getCardImage(
    cardId: number,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const card = await this.getCard(cardId);
    const key = card.thumbnailImageKey ?? card.originalImageKey ?? card.imageUrl;

    if (!key) {
      throw new NotFoundException('Card image not found.');
    }

    if (key.startsWith('http://') || key.startsWith('https://')) {
      return this.fetchExternalImage(key);
    }

    return this.storageService.readImage(key);
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
