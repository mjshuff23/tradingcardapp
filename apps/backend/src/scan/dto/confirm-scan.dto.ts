import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CollectionStatus } from '../../prisma/client';

export class ConfirmScanDraftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  set?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  setName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1800)
  @Max(2200)
  year?: number | null;

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
  cardNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  season?: string | null;

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
  @IsBoolean()
  hasAutographVariant?: boolean | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVintage?: boolean | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  condition?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gradeEstimate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAutographed?: boolean | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  autographFormat?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isForTrade?: boolean | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isForSale?: boolean | null;

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
}

export class ConfirmScanDto {
  @ApiPropertyOptional({ description: 'Candidate ID to confirm. Defaults to top candidate.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  candidateId?: number;

  @ApiPropertyOptional({ enum: CollectionStatus, default: CollectionStatus.OWNED })
  @IsOptional()
  @IsEnum(CollectionStatus)
  collectionStatus?: CollectionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  keepScanImage?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  promoteToCanonical?: boolean;

  @ApiPropertyOptional({ description: 'Finalized draft applied before saving card', type: ConfirmScanDraftDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConfirmScanDraftDto)
  draft?: ConfirmScanDraftDto;
}
