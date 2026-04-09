import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import type { Express } from 'express';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireSessionGuard } from '../auth/require-session.guard';
import { SessionGuard } from '../auth/session.guard';
import { User } from '../prisma/client';
import { CatalogService } from './catalog.service';
import { CardDetailDto, CatalogListResponseDto } from './dto/card-response.dto';
import { ListCardsQueryDto } from './dto/list-cards-query.dto';
import {
  NormalizeTitleRequestDto,
  NormalizeTitleResultDto,
} from './dto/normalize-title.dto';
import { UpdateCardDto } from './dto/update-card.dto';

@ApiTags('Cards')
@Controller('cards')
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly authService: AuthService,
  ) {}

  @UseGuards(SessionGuard)
  @Post('normalize-title')
  @ApiOperation({ summary: 'Normalize a messy card title into structured fields' })
  @ApiOkResponse({ type: NormalizeTitleResultDto })
  @ApiBadRequestResponse({ description: 'Invalid normalization payload.' })
  async normalizeTitle(@Body() body: NormalizeTitleRequestDto) {
    return this.catalogService.normalizeTitle(body.rawTitle, body.fields ?? {});
  }

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

  @UseGuards(SessionGuard)
  @Get(':cardId/images/:kind')
  @ApiOperation({ summary: 'Get a specific card image kind (front/back/canonical)' })
  @ApiBadRequestResponse({ description: 'kind must be front, back, or canonical.' })
  @ApiNotFoundResponse({ description: 'Card or image not found.' })
  async getCardImageByKind(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Param('kind') kind: string,
    @CurrentUser() user: User | null,
    @Res() res: Response,
  ) {
    const viewer = user ?? (await this.authService.ensureDemoUser());
    const imageKind = toImageKind(kind);
    const image = await this.catalogService.getCardImageByKind(cardId, viewer.id, imageKind);
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

  @UseGuards(RequireSessionGuard)
  @ApiCookieAuth()
  @Post(':cardId/images/:kind')
  @ApiOperation({ summary: 'Upload or replace a card image (front/back/canonical)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
      },
      required: ['image'],
    },
  })
  @ApiCreatedResponse({ type: CardDetailDto })
  @ApiBadRequestResponse({ description: 'Invalid image upload request.' })
  @ApiUnauthorizedResponse({ description: 'Sign in required.' })
  @ApiNotFoundResponse({ description: 'Card not found.' })
  @UseInterceptors(FileInterceptor('image'))
  async uploadCardImage(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Param('kind') kind: string,
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }

    const imageKind = toImageKind(kind);
    return this.catalogService.uploadCardImage(cardId, user.id, imageKind, file);
  }

  @UseGuards(RequireSessionGuard)
  @ApiCookieAuth()
  @Delete(':cardId/images/:kind')
  @ApiOperation({ summary: 'Clear a stored card image (front/back/canonical)' })
  @ApiOkResponse({ type: CardDetailDto })
  @ApiBadRequestResponse({ description: 'Invalid image clear request.' })
  @ApiUnauthorizedResponse({ description: 'Sign in required.' })
  @ApiNotFoundResponse({ description: 'Card not found.' })
  async clearCardImage(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Param('kind') kind: string,
    @CurrentUser() user: User,
  ) {
    const imageKind = toImageKind(kind);
    return this.catalogService.clearCardImage(cardId, user.id, imageKind);
  }
}

function toImageKind(value: string): 'front' | 'back' | 'canonical' {
  if (value === 'front' || value === 'back' || value === 'canonical') {
    return value;
  }

  throw new BadRequestException('kind must be front, back, or canonical.');
}
