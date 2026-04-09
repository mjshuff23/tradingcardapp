import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireSessionGuard } from '../auth/require-session.guard';
import { SessionGuard } from '../auth/session.guard';
import { User } from '../prisma/client';
import { CatalogService } from './catalog.service';
import { CardDetailDto, CatalogListResponseDto } from './dto/card-response.dto';
import { ListCardsQueryDto } from './dto/list-cards-query.dto';
import { UpdateCardDto } from './dto/update-card.dto';

@ApiTags('Cards')
@Controller('cards')
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly authService: AuthService,
  ) {}

  @UseGuards(SessionGuard)
  @Get()
  @ApiOperation({ summary: 'List cards with optional search and status filters' })
  @ApiOkResponse({ type: CatalogListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  async listCards(@Query() query: ListCardsQueryDto, @CurrentUser() user: User | null) {
    const viewer = user ?? (await this.authService.ensureDemoUser());
    return this.catalogService.listCards({
      userId: viewer.id,
      q: query.q,
      queryMode: query.queryMode,
      collectionStatus: query.collectionStatus,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @UseGuards(SessionGuard)
  @Get(':cardId')
  @ApiOperation({ summary: 'Get one card by ID' })
  @ApiOkResponse({ type: CardDetailDto })
  @ApiNotFoundResponse({ description: 'Card not found.' })
  async getCard(@Param('cardId', ParseIntPipe) cardId: number, @CurrentUser() user: User | null) {
    const viewer = user ?? (await this.authService.ensureDemoUser());
    return this.catalogService.getCard(cardId, viewer.id);
  }

  @UseGuards(SessionGuard)
  @Get(':cardId/image')
  @ApiOperation({ summary: 'Get card image' })
  @ApiNotFoundResponse({ description: 'Card or image not found.' })
  async getCardImage(
    @Param('cardId', ParseIntPipe) cardId: number,
    @CurrentUser() user: User | null,
    @Res() res: Response,
  ) {
    const viewer = user ?? (await this.authService.ensureDemoUser());
    const image = await this.catalogService.getCardImage(cardId, viewer.id);
    res.setHeader('Content-Type', image.contentType);
    res.send(image.buffer);
  }

  @UseGuards(RequireSessionGuard)
  @ApiCookieAuth()
  @Patch(':cardId')
  @ApiOperation({ summary: 'Update a card' })
  @ApiOkResponse({ type: CardDetailDto })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiUnauthorizedResponse({ description: 'Sign in required.' })
  @ApiNotFoundResponse({ description: 'Card not found.' })
  async updateCard(
    @Param('cardId', ParseIntPipe) cardId: number,
    @CurrentUser() user: User,
    @Body() body: UpdateCardDto,
  ) {
    return this.catalogService.updateCard(cardId, user.id, body);
  }
}
