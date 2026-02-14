import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { CollectionStatus } from '@prisma/client';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { UpdateCardDto } from './dto/update-card.dto';

@ApiTags('Cards')
@Controller('cards')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'List cards with optional search and status filters' })
  async listCards(
    @Query('q') q?: string,
    @Query('collectionStatus') collectionStatus?: CollectionStatus,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.catalogService.listCards({
      q,
      collectionStatus,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':cardId')
  @ApiOperation({ summary: 'Get one card by ID' })
  async getCard(@Param('cardId', ParseIntPipe) cardId: number) {
    return this.catalogService.getCard(cardId);
  }

  @Patch(':cardId')
  @ApiOperation({ summary: 'Update a card' })
  async updateCard(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() body: UpdateCardDto,
  ) {
    return this.catalogService.updateCard(cardId, body);
  }
}
