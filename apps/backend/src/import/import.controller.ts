import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiCookieAuth,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireSessionGuard } from '../auth/require-session.guard';
import { UploadedFile as UploadedFileType } from '../common/uploaded-file.type';
import { User } from '../prisma/client';
import { ImportCsvResponseDto } from './dto/import-response.dto';
import { ImportService } from './import.service';

@ApiTags('Imports')
@ApiCookieAuth()
@UseGuards(RequireSessionGuard)
@Controller('import/cards')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('csv')
  @ApiOperation({ summary: 'Import cards from CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: ImportCsvResponseDto })
  @ApiUnauthorizedResponse({ description: 'Sign in required.' })
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(@UploadedFile() file: UploadedFileType, @CurrentUser() user: User) {
    return this.importService.importCardsCsv(file, user.id);
  }
}
