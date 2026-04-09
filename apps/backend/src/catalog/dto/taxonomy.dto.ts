import { ApiProperty } from '@nestjs/swagger';

export class TaxonomySubcategoryDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({ type: [String] })
  keywords!: string[];
}

export class TaxonomyGroupDto {
  @ApiProperty()
  category!: string;

  @ApiProperty({ type: [String] })
  keywords!: string[];

  @ApiProperty({ type: [TaxonomySubcategoryDto] })
  subcategories!: TaxonomySubcategoryDto[];
}

export class CardTaxonomyResponseDto {
  @ApiProperty({ type: [TaxonomyGroupDto] })
  groups!: TaxonomyGroupDto[];
}
