import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UploadedFileFields } from '../common/uploaded-file.type';
import { ConfirmScanDto } from './dto/confirm-scan.dto';
import { ScanService } from './scan.service';

@ApiTags('Scans')
@Controller('scans')
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Post()
  @ApiOperation({ summary: 'Upload an image and create a scan job' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
        backImage: { type: 'string', format: 'binary' },
      },
      required: ['image'],
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'image', maxCount: 1 },
      { name: 'backImage', maxCount: 1 },
    ]),
  )
  async createScan(@UploadedFiles() files: UploadedFileFields) {
    return this.scanService.createScan({
      frontFile: files.image?.[0],
      backFile: files.backImage?.[0],
    });
  }

  @Get(':scanId')
  @ApiOperation({ summary: 'Get scan job status and candidates' })
  async getScan(@Param('scanId', ParseIntPipe) scanId: number) {
    return this.scanService.getScan(scanId);
  }

  @Get(':scanId/image/:side')
  @ApiOperation({ summary: 'Get uploaded scan image (front/back)' })
  async getScanImage(
    @Param('scanId', ParseIntPipe) scanId: number,
    @Param('side') side: string,
    @Res() res: Response,
  ) {
    if (side !== 'front' && side !== 'back') {
      res.status(400).json({ message: 'side must be "front" or "back".' });
      return;
    }

    const image = await this.scanService.getScanImage(scanId, side);
    res.setHeader('Content-Type', image.contentType);
    res.send(image.buffer);
  }

  @Get(':scanId/candidates/:candidateId/preview-image')
  @ApiOperation({ summary: 'Get trusted proxied preview image for a scan candidate hint' })
  async getCandidatePreviewImage(
    @Param('scanId', ParseIntPipe) scanId: number,
    @Param('candidateId', ParseIntPipe) candidateId: number,
    @Query('hintUrl') hintUrl: string,
    @Res() res: Response,
  ) {
    const image = await this.scanService.getCandidatePreviewImage(scanId, candidateId, hintUrl ?? '');
    res.setHeader('Content-Type', image.contentType);
    res.setHeader('Cache-Control', 'public, max-age=43200');
    res.send(image.buffer);
  }

  @Post(':scanId/confirm')
  @ApiOperation({ summary: 'Confirm selected scan candidate and save card' })
  async confirmScan(
    @Param('scanId', ParseIntPipe) scanId: number,
    @Body() body: ConfirmScanDto,
  ) {
    return this.scanService.confirmScan(scanId, body);
  }
}
