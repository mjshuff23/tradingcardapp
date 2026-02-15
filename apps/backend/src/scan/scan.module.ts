import { Module } from '@nestjs/common';
import { OcrService } from '../ocr/ocr.service';
import { StorageService } from '../storage/storage.service';
import { ValidationService } from '../validation/validation.service';
import { LookupService } from '../lookup/lookup.service';
import { ScanController } from './scan.controller';
import { LinkPreviewService } from './link-preview.service';
import { ScanService } from './scan.service';

@Module({
  controllers: [ScanController],
  providers: [
    ScanService,
    OcrService,
    StorageService,
    ValidationService,
    LookupService,
    LinkPreviewService,
  ],
  exports: [ScanService],
})
export class ScanModule {}
