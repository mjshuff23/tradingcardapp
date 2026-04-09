import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageService } from '../storage/storage.service';
import { CatalogQueryService } from './catalog-query.service';
import { CatalogController } from './catalog.controller';
import { CatalogIndexService } from './catalog-index.service';
import { CatalogService } from './catalog.service';
import { TitleNormalizationService } from './title-normalization.service';

@Module({
  imports: [AuthModule],
  controllers: [CatalogController],
  providers: [
    CatalogService,
    CatalogIndexService,
    CatalogQueryService,
    StorageService,
    TitleNormalizationService,
  ],
  exports: [CatalogService, CatalogIndexService],
})
export class CatalogModule {}
