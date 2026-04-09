import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import path from 'node:path';
import sharp from 'sharp';
import Tesseract from 'tesseract.js';
import { parseStructuredCardHints, StructuredCardHints } from '../common/card-hints.util';

type OcrExtractInput = {
  frontBuffer: Buffer;
  frontFilename: string;
  backBuffer?: Buffer;
  backFilename?: string;
};

export type OcrExtractResult = {
  text: string;
  frontText: string;
  backText: string;
  hints: StructuredCardHints;
};

type OcrAttempt = {
  label: string;
  text: string;
  confidence: number;
  quality: number;
};

@Injectable()
export class OcrService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(OcrService.name);
  private workerPromise: Promise<Tesseract.Worker> | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const provider = (this.configService.get<string>('OCR_PROVIDER') ?? 'tesseract').toLowerCase();
    this.logger.log(`Active OCR provider: ${provider}`);
  }

  async extractText(input: OcrExtractInput): Promise<OcrExtractResult> {
    const provider = (this.configService.get<string>('OCR_PROVIDER') ?? 'tesseract').toLowerCase();

    if (provider !== 'tesseract') {
      return this.fallbackResult(
        input.frontFilename,
        input.frontBuffer,
        input.backFilename,
        input.backBuffer,
      );
    }

    try {
      const [frontText, backText] = await Promise.all([
        this.extractTextFromSingleImage(input.frontBuffer, 'front'),
        input.backBuffer ? this.extractTextFromSingleImage(input.backBuffer, 'back') : Promise.resolve(''),
      ]);

      const combined = [frontText, backText].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      const hints = parseStructuredCardHints(frontText, backText);

      if (combined.length > 0) {
        return {
          text: combined,
          frontText,
          backText,
          hints,
        };
      }

      this.logger.warn('OCR returned empty text, using fallback text.');
      return this.fallbackResult(
        input.frontFilename,
        input.frontBuffer,
        input.backFilename,
        input.backBuffer,
      );
    } catch (error) {
      this.logger.warn(`OCR failed, using fallback text. ${(error as Error).message}`);
      return this.fallbackResult(
        input.frontFilename,
        input.frontBuffer,
        input.backFilename,
        input.backBuffer,
      );
    }
  }

  async onModuleDestroy() {
    if (!this.workerPromise) {
      return;
    }

    try {
      const worker = await this.workerPromise;
      await worker.terminate();
    } catch (error) {
      this.logger.warn(`Failed to terminate OCR worker cleanly. ${(error as Error).message}`);
    } finally {
      this.workerPromise = null;
    }
  }

  private fallbackResult(
    frontFilename: string,
    frontBuffer: Buffer,
    backFilename?: string,
    backBuffer?: Buffer,
  ): OcrExtractResult {
    const frontGuess = this.fallbackSingle(frontFilename, frontBuffer);
    const backGuess = backFilename && backBuffer ? this.fallbackSingle(backFilename, backBuffer) : '';
    const text = [frontGuess, backGuess].filter(Boolean).join(' ').trim();
    const hints = parseStructuredCardHints(frontGuess, backGuess);

    return {
      text,
      frontText: frontGuess,
      backText: backGuess,
      hints,
    };
  }

  private fallbackSingle(sourceFilename: string, fileBuffer: Buffer): string {
    const filename = path.basename(sourceFilename, path.extname(sourceFilename));
    const guessFromFilename = filename.replace(/[_-]+/g, ' ').trim();
    const sizeHint = fileBuffer.length > 0 ? ` image-bytes-${Math.min(fileBuffer.length, 999999)}` : '';
    return `${guessFromFilename}${sizeHint}`.trim();
  }

  private async extractTextFromSingleImage(fileBuffer: Buffer, sideLabel: 'front' | 'back'): Promise<string> {
    const worker = await this.getWorker();
    const variants = await this.createImageVariants(fileBuffer);
    const attempts: OcrAttempt[] = [];

    const fullPassModes: Array<{ name: string; psm: Tesseract.PSM }> = [
      { name: 'auto', psm: Tesseract.PSM.AUTO },
      { name: 'sparse', psm: Tesseract.PSM.SPARSE_TEXT },
    ];

    for (const variant of variants) {
      for (const mode of fullPassModes) {
        const attempt = await this.runAttempt(worker, variant.buffer, `${sideLabel}:${variant.name}:${mode.name}`, mode.psm);
        if (attempt) {
          attempts.push(attempt);
          if (attempt.quality >= 0.86) {
            return attempt.text;
          }
        }
      }
    }

    const regionBuffers = await this.createRegionBuffers(variants[0].buffer);
    for (const region of regionBuffers) {
      const mode = region.name === 'top' || region.name === 'bottom'
        ? Tesseract.PSM.SINGLE_LINE
        : Tesseract.PSM.AUTO;
      const attempt = await this.runAttempt(worker, region.buffer, `${sideLabel}:region:${region.name}`, mode);
      if (attempt) {
        attempts.push(attempt);
      }
    }

    const numericRegions = regionBuffers.filter(
      (region) => region.name === 'top' || region.name === 'right' || region.name === 'numberStrip',
    );
    for (const region of numericRegions) {
      const attempt = await this.runAttempt(
        worker,
        region.buffer,
        `${sideLabel}:numeric:${region.name}`,
        Tesseract.PSM.SINGLE_LINE,
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#-/: ',
      );
      if (attempt) {
        attempts.push(attempt);
      }
    }

    if (!attempts.length) {
      return '';
    }

    const best = [...attempts].sort((a, b) => b.quality - a.quality)[0];
    const topTexts = [...attempts]
      .sort((a, b) => b.quality - a.quality)
      .map((item) => item.text)
      .filter((value, index, array) => array.indexOf(value) === index)
      .slice(0, 3);

    const merged = topTexts.join(' ').replace(/\s+/g, ' ').trim();

    if ((this.configService.get<string>('OCR_DEBUG') ?? 'false') === 'true') {
      this.logger.debug(
        `${sideLabel} OCR best=${best.label} conf=${best.confidence.toFixed(1)} quality=${best.quality.toFixed(3)} text="${best.text}"`,
      );
    }

    return merged || best.text;
  }

  private async runAttempt(
    worker: Tesseract.Worker,
    image: Buffer,
    label: string,
    psm: Tesseract.PSM,
    charWhitelist?: string,
  ): Promise<OcrAttempt | null> {
    await worker.setParameters({
      tessedit_pageseg_mode: psm,
      preserve_interword_spaces: '1',
      tessedit_char_whitelist: charWhitelist ?? '',
    });

    const result = await worker.recognize(image);
    const text = this.cleanText(result.data.text);
    if (!text) {
      return null;
    }

    const confidence = Number(result.data.confidence ?? 0);
    const quality = this.scoreTextQuality(text, confidence);

    return {
      label,
      text,
      confidence,
      quality,
    };
  }

  private cleanText(rawText: string): string {
    return rawText
      .replace(/[\u0000-\u001F]+/g, ' ')
      .replace(/[^\w\s\-.,/#:()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private scoreTextQuality(text: string, confidence: number): number {
    const lengthScore = Math.min(text.length, 120) / 120;
    const confidenceScore = Math.max(0, Math.min(confidence, 100)) / 100;
    return Number((lengthScore * 0.7 + confidenceScore * 0.3).toFixed(3));
  }

  private async createImageVariants(
    fileBuffer: Buffer,
  ): Promise<Array<{ name: string; buffer: Buffer }>> {
    const base = sharp(fileBuffer).rotate();
    const metadata = await base.metadata();
    const width = metadata.width ?? 0;

    const resized = width > 0 && width < 1600
      ? base.resize({ width: 1600, fit: 'inside', withoutEnlargement: false })
      : base;

    const normalized = await resized.clone().grayscale().normalize().sharpen().png().toBuffer();
    const thresholded = await resized.clone().grayscale().normalize().threshold(160).png().toBuffer();

    return [
      { name: 'normalized', buffer: normalized },
      { name: 'thresholded', buffer: thresholded },
    ];
  }

  private async createRegionBuffers(
    imageBuffer: Buffer,
  ): Promise<
    Array<{ name: 'top' | 'bottom' | 'right' | 'center' | 'left' | 'numberStrip'; buffer: Buffer }>
  > {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (!width || !height) {
      return [];
    }

    const topHeight = Math.max(120, Math.floor(height * 0.24));
    const bottomHeight = Math.max(140, Math.floor(height * 0.26));
    const rightWidth = Math.max(120, Math.floor(width * 0.24));
    const leftWidth = Math.max(120, Math.floor(width * 0.2));
    const centerHeight = Math.max(160, Math.floor(height * 0.28));
    const centerTop = Math.max(0, Math.floor((height - centerHeight) / 2));
    const numberStripHeight = Math.max(100, Math.floor(height * 0.14));

    const [top, bottom, right, center, left, numberStrip] = await Promise.all([
      image
        .clone()
        .extract({ left: 0, top: 0, width, height: Math.min(topHeight, height) })
        .png()
        .toBuffer(),
      image
        .clone()
        .extract({ left: 0, top: Math.max(0, height - bottomHeight), width, height: Math.min(bottomHeight, height) })
        .png()
        .toBuffer(),
      image
        .clone()
        .extract({ left: Math.max(0, width - rightWidth), top: 0, width: Math.min(rightWidth, width), height })
        .png()
        .toBuffer(),
      image
        .clone()
        .extract({ left: 0, top: 0, width: Math.min(leftWidth, width), height })
        .png()
        .toBuffer(),
      image
        .clone()
        .extract({ left: 0, top: centerTop, width, height: Math.min(centerHeight, height) })
        .png()
        .toBuffer(),
      image
        .clone()
        .extract({
          left: 0,
          top: Math.max(0, height - numberStripHeight),
          width,
          height: Math.min(numberStripHeight, height),
        })
        .png()
        .toBuffer(),
    ]);

    return [
      { name: 'top', buffer: top },
      { name: 'bottom', buffer: bottom },
      { name: 'right', buffer: right },
      { name: 'left', buffer: left },
      { name: 'center', buffer: center },
      { name: 'numberStrip', buffer: numberStrip },
    ];
  }

  private async getWorker(): Promise<Tesseract.Worker> {
    if (!this.workerPromise) {
      const lang = this.configService.get<string>('OCR_LANG') ?? 'eng';
      const enableLogs = (this.configService.get<string>('OCR_DEBUG') ?? 'false') === 'true';

      this.workerPromise = Tesseract.createWorker(lang, Tesseract.OEM.LSTM_ONLY, {
        logger: (message) => {
          if (enableLogs && message.progress > 0.95) {
            this.logger.debug(`${message.status} ${Math.round(message.progress * 100)}%`);
          }
        },
        cachePath: '/tmp/tesseract-cache',
      });
    }

    return this.workerPromise;
  }
}
