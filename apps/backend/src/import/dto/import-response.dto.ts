import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImportStatus } from '../../prisma/client';

export class ImportSummaryDto {
  @ApiProperty()
  totalRows!: number;

  @ApiProperty()
  createdCount!: number;

  @ApiProperty()
  updatedCount!: number;

  @ApiProperty()
  skippedCount!: number;

  @ApiProperty()
  errorCount!: number;
}

export class ImportJobDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ enum: ImportStatus })
  status!: ImportStatus;

  @ApiProperty()
  filename!: string;

  @ApiProperty()
  totalRows!: number;

  @ApiProperty()
  createdCount!: number;

  @ApiProperty()
  updatedCount!: number;

  @ApiProperty()
  skippedCount!: number;

  @ApiProperty()
  errorCount!: number;

  @ApiPropertyOptional({ type: 'array', nullable: true, items: { type: 'object', additionalProperties: true } })
  errors!: Array<Record<string, unknown>> | null;
}

export class ImportCsvResponseDto {
  @ApiProperty({ type: ImportJobDto })
  importJob!: ImportJobDto;

  @ApiProperty({ type: ImportSummaryDto })
  summary!: ImportSummaryDto;
}
