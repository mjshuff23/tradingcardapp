import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { ConfirmScanDraftDto } from './confirm-scan.dto';

export class EnrichScanCandidateRequestDto {
  @ApiPropertyOptional({ type: ConfirmScanDraftDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConfirmScanDraftDto)
  draft?: ConfirmScanDraftDto;
}

export class EnrichmentSourceDto {
  @ApiProperty()
  provider!: string;

  @ApiProperty()
  query!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  snippet!: string | null;

  @ApiProperty()
  score!: number;
}

export class EnrichScanCandidateResponseDto {
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  fields!: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  fieldConfidence!: Record<string, number>;

  @ApiProperty()
  confidence!: number;

  @ApiProperty()
  usedAi!: boolean;

  @ApiProperty()
  provider!: string;

  @ApiProperty({ type: [String] })
  queries!: string[];

  @ApiProperty({ type: [EnrichmentSourceDto] })
  sources!: EnrichmentSourceDto[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  debug!: Record<string, unknown> | null;
}
