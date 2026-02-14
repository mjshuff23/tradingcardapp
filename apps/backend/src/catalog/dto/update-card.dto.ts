import { CollectionStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCardDto {
  @ApiPropertyOptional()
  name?: string;
  @ApiPropertyOptional()
  set?: string | null;
  @ApiPropertyOptional()
  year?: number | null;
  @ApiPropertyOptional()
  player?: string | null;
  @ApiPropertyOptional()
  variant?: string | null;
  @ApiPropertyOptional()
  sport?: string | null;
  @ApiPropertyOptional({ enum: CollectionStatus })
  collectionStatus?: CollectionStatus;
  @ApiPropertyOptional()
  gradeEstimate?: string | null;
}
