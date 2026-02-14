import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
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
      },
      required: ['image'],
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  async createScan(@UploadedFile() file: Express.Multer.File) {
    return this.scanService.createScan(file);
  }

  @Get(':scanId')
  @ApiOperation({ summary: 'Get scan job status and candidates' })
  async getScan(@Param('scanId', ParseIntPipe) scanId: number) {
    return this.scanService.getScan(scanId);
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
