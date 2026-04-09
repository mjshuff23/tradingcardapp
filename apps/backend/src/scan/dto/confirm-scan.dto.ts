import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CollectionStatus } from '../../prisma/client';

export class ConfirmScanOverridesDto {
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

  @ApiPropertyOptional({ description: 'Optional field overrides applied before saving card', type: ConfirmScanOverridesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConfirmScanOverridesDto)
  overrides?: ConfirmScanOverridesDto;
}
