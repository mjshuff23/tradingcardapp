import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class NormalizeTitleFieldsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  player?: string | null;

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
  @Type(() => Number)
  @IsInt()
  @Min(1800)
  @Max(2200)
  yearManufactured?: number | null;

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
  @IsString()
  sport?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variant?: string | null;

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
}

export class NormalizeTitleRequestDto {
  @ApiProperty()
  @IsString()
  rawTitle!: string;

  @ApiPropertyOptional({ type: NormalizeTitleFieldsDto })
  @IsOptional()
  @Type(() => NormalizeTitleFieldsDto)
  fields?: NormalizeTitleFieldsDto;
}

export class NormalizeTitleResultDto {
  @ApiProperty()
  rawTitle!: string;

  @ApiProperty()
  cleanedTitle!: string;

  @ApiPropertyOptional({ nullable: true })
  cleanedSearchText!: string | null;

  @ApiProperty({ type: NormalizeTitleFieldsDto })
  fields!: NormalizeTitleFieldsDto;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  fieldConfidence!: Record<string, number>;

  @ApiProperty()
  confidence!: number;

  @ApiProperty()
  usedAi!: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  @IsOptional()
  @IsObject()
  debug?: Record<string, unknown> | null;
}
