import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CollectionStatus } from "../../prisma/client";

export enum CardImageSourceDto {
  USER = "USER",
  CANONICAL = "CANONICAL",
  LEGACY = "LEGACY",
  NONE = "NONE",
}

export class CardSetDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  brand!: string | null;

  @ApiProperty({ nullable: true })
  setName!: string | null;

  @ApiProperty({ nullable: true })
  yearManufactured!: number | null;

  @ApiProperty({ nullable: true })
  sport!: string | null;

  @ApiProperty({ nullable: true })
  season!: string | null;

  @ApiProperty({ nullable: true })
  cardConditionScale!: string | null;

  @ApiProperty({ nullable: true })
  cardSize!: string | null;

  @ApiProperty({ nullable: true })
  cardThicknessPt!: number | null;

  @ApiProperty({ nullable: true })
  countryOfOrigin!: string | null;

  @ApiProperty({ nullable: true })
  language!: string | null;

  @ApiProperty({ nullable: true })
  material!: string | null;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    nullable: true,
  })
  metadata!: Record<string, unknown> | null;
}

export class CardDefinitionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  normalizedCardKey!: string;

  @ApiProperty({ nullable: true })
  cardNumber!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  player!: string | null;

  @ApiProperty({ nullable: true })
  variant!: string | null;

  @ApiProperty({ nullable: true })
  legacySetText!: string | null;

  @ApiProperty({ nullable: true })
  category!: string | null;

  @ApiProperty({ nullable: true })
  subcategory!: string | null;

  @ApiProperty()
  hasAutographVariant!: boolean;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    nullable: true,
  })
  features!: Record<string, unknown> | null;

  @ApiProperty({ nullable: true })
  originalOrReprint!: string | null;

  @ApiProperty({ nullable: true })
  parallelOrVariety!: string | null;

  @ApiProperty({ nullable: true })
  setType!: string | null;

  @ApiProperty({ nullable: true })
  insertSetName!: string | null;

  @ApiProperty({ nullable: true })
  cardType!: string | null;

  @ApiProperty()
  isVintage!: boolean;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    nullable: true,
  })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ type: CardSetDto, nullable: true })
  cardSet!: CardSetDto | null;
}

export class CardCollectionRecordDto {
  @ApiProperty({ enum: CollectionStatus })
  collectionStatus!: CollectionStatus;

  @ApiProperty({ nullable: true })
  personalImageUrl!: string | null;

  @ApiProperty({ nullable: true })
  frontImageUrl!: string | null;

  @ApiProperty({ nullable: true })
  backImageUrl!: string | null;

  @ApiProperty({ nullable: true })
  condition!: string | null;

  @ApiProperty()
  isAutographed!: boolean;

  @ApiProperty({ nullable: true })
  autographFormat!: string | null;

  @ApiProperty()
  isForTrade!: boolean;

  @ApiProperty()
  isForSale!: boolean;

  @ApiProperty({ nullable: true })
  askingPriceCents!: number | null;

  @ApiProperty({ nullable: true })
  priority!: number | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ nullable: true })
  gradeEstimate!: string | null;

  @ApiProperty({ nullable: true })
  confidence!: number | null;

  @ApiProperty({ nullable: true })
  scanJobId!: number | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class CardListItemDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  subtitle!: string;

  @ApiProperty({ nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ enum: CardImageSourceDto })
  imageSource!: CardImageSourceDto;

  @ApiProperty({ nullable: true })
  canonicalImageUrl!: string | null;

  @ApiProperty({ nullable: true })
  personalImageUrl!: string | null;

  @ApiProperty({ nullable: true })
  frontImageUrl!: string | null;

  @ApiProperty({ nullable: true })
  backImageUrl!: string | null;

  @ApiProperty({ enum: CollectionStatus })
  collectionStatus!: CollectionStatus;

  @ApiProperty({ type: CardDefinitionDto })
  definition!: CardDefinitionDto;

  @ApiProperty({ type: CardCollectionRecordDto })
  record!: CardCollectionRecordDto;
}

export class CardDetailDto extends CardListItemDto {}

export class CatalogPaginationDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class CatalogListResponseDto {
  @ApiProperty({ type: [CardListItemDto] })
  items!: CardListItemDto[];

  @ApiProperty({ type: CatalogPaginationDto })
  pagination!: CatalogPaginationDto;
}
