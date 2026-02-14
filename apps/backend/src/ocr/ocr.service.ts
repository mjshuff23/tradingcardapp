import { Injectable } from '@nestjs/common';
import path from 'node:path';

@Injectable()
export class OcrService {
  async extractText(fileBuffer: Buffer, sourceFilename: string): Promise<string> {
    const filename = path.basename(sourceFilename, path.extname(sourceFilename));
    const guessFromFilename = filename.replace(/[_-]+/g, ' ').trim();

    const sizeHint = fileBuffer.length > 0 ? ` image-bytes-${Math.min(fileBuffer.length, 999999)}` : '';

    // MVP baseline: lightweight OCR placeholder derived from filename.
    // Real OCR engine can be swapped in this service without API changes.
    return `${guessFromFilename}${sizeHint}`.trim();
  }
}
