import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { StorageService } from '../storage/storage.service';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [CatalogModule, AuthModule],
  controllers: [ImportController],
  providers: [ImportService, StorageService],
  exports: [ImportService],
})
export class ImportModule {}
