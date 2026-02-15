import { Module } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, StorageService],
  exports: [CatalogService],
})
export class CatalogModule {}
