import { CollectionStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmScanDto {
  @ApiPropertyOptional({ description: 'Candidate ID to confirm. Defaults to top candidate.' })
  candidateId?: number;

  @ApiPropertyOptional({ enum: CollectionStatus, default: CollectionStatus.OWNED })
  collectionStatus?: CollectionStatus;

  @ApiPropertyOptional({ description: 'Optional field overrides applied before saving card' })
  overrides?: {
    name?: string;
    set?: string | null;
    year?: number | null;
    player?: string | null;
    variant?: string | null;
    sport?: string | null;
  };
}
