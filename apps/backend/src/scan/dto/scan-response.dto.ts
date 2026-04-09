import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScanStatus } from '../../prisma/client';

export class ValidationHintDto {
  @ApiProperty()
  source!: string;

  @ApiPropertyOptional()
  provider?: string;

  @ApiProperty()
  url!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  score!: number;

  @ApiPropertyOptional({ nullable: true })
  imageUrl?: string | null;
}

export class ScanCandidateDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  set!: string | null;

  @ApiProperty({ nullable: true })
  year!: number | null;

  @ApiProperty({ nullable: true })
  player!: string | null;

  @ApiProperty({ nullable: true })
  variant!: string | null;

  @ApiProperty({ nullable: true })
  sport!: string | null;

  @ApiProperty()
  score!: number;

  @ApiProperty({ nullable: true })
  validationScore!: number | null;

  @ApiProperty({ type: [ValidationHintDto], nullable: true })
  sourceHints!: ValidationHintDto[] | null;

  @ApiProperty()
  chosen!: boolean;
}

export class ScanResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ enum: ScanStatus })
  status!: ScanStatus;

  @ApiProperty({ nullable: true })
  sourceFilename!: string | null;

  @ApiProperty({ nullable: true })
  ocrText!: string | null;

  @ApiProperty({ nullable: true })
  error!: string | null;

  @ApiProperty({ nullable: true })
  frontImageUrl!: string | null;

  @ApiProperty({ nullable: true })
  backImageUrl!: string | null;

  @ApiProperty({ type: [ScanCandidateDto] })
  candidates!: ScanCandidateDto[];
}

export class CreateScanResponseDto {
  @ApiProperty()
  scanId!: number;

  @ApiProperty({ enum: ScanStatus })
  status!: ScanStatus;
}

export class ConfirmScanResponseDto {
  @ApiProperty()
  id!: number;
}
