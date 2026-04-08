import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { StorageService } from '../storage/storage.service';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [CatalogModule],
  controllers: [ImportController],
  providers: [ImportService, StorageService],
  exports: [ImportService],
})
export class ImportModule {}
