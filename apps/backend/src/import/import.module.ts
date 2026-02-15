import { Module } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  controllers: [ImportController],
  providers: [ImportService, StorageService],
  exports: [ImportService],
})
export class ImportModule {}
