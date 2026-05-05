import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { CollectionStatus } from "../../prisma/client";

export class UpdateCardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  setName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legacySetText?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  season?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cardNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1800)
  @Max(2200)
  yearManufactured?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  player?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variant?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sport?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subcategory?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originalOrReprint?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parallelOrVariety?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  setType?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  insertSetName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cardType?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasAutographVariant?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVintage?: boolean;

  @ApiPropertyOptional({ enum: CollectionStatus })
  @IsOptional()
  @IsEnum(CollectionStatus)
  collectionStatus?: CollectionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  condition?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAutographed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  autographFormat?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isForTrade?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isForSale?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  askingPriceCents?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gradeEstimate?: string | null;
}
