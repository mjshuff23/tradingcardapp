import { Injectable, NotFoundException } from '@nestjs/common';
import { CollectionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCardDto } from './dto/update-card.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

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
}
