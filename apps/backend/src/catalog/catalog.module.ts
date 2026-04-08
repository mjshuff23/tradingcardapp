import { Module } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { CatalogController } from './catalog.controller';
import { CatalogIndexService } from './catalog-index.service';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, CatalogIndexService, StorageService],
  exports: [CatalogService, CatalogIndexService],
})
export class CatalogModule {}
