import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CollectionStatus } from '../../prisma/client';

export enum CardQueryMode {
  TEXT = 'text',
  NL = 'nl',
}

export enum CardSortBy {
  TITLE = 'title',
  PLAYER = 'player',
  BRAND = 'brand',
  SET_NAME = 'setName',
  YEAR_MANUFACTURED = 'yearManufactured',
  SEASON = 'season',
  CARD_NUMBER = 'cardNumber',
  SPORT = 'sport',
  CATEGORY = 'category',
  SUBCATEGORY = 'subcategory',
  CARD_TYPE = 'cardType',
  COLLECTION_STATUS = 'collectionStatus',
  CONDITION = 'condition',
  GRADE_ESTIMATE = 'gradeEstimate',
  IS_AUTOGRAPHED = 'isAutographed',
  IS_FOR_TRADE = 'isForTrade',
  IS_FOR_SALE = 'isForSale',
  ASKING_PRICE_CENTS = 'askingPriceCents',
  PRIORITY = 'priority',
  CONFIDENCE = 'confidence',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListCardsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: CollectionStatus })
  @IsOptional()
  @IsEnum(CollectionStatus)
  collectionStatus?: CollectionStatus;

  @ApiPropertyOptional({ enum: CardQueryMode, default: CardQueryMode.TEXT })
  @IsOptional()
  @IsEnum(CardQueryMode)
  queryMode?: CardQueryMode;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ enum: CardSortBy, default: CardSortBy.UPDATED_AT })
  @IsOptional()
  @IsEnum(CardSortBy)
  sortBy?: CardSortBy;

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.DESC })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: SortDirection;
}
