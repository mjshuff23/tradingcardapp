import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CollectionStatus } from '../../prisma/client';

export enum CardQueryMode {
  TEXT = 'text',
  NL = 'nl',
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
}
