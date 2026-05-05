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
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequireSessionGuard } from "../auth/require-session.guard";
import { UploadedFileFields } from "../common/uploaded-file.type";
import { User } from "../prisma/client";
import { ConfirmScanDto } from "./dto/confirm-scan.dto";
import {
  EnrichScanCandidateRequestDto,
  EnrichScanCandidateResponseDto,
} from "./dto/enrich-scan-candidate.dto";
import {
  ConfirmScanResponseDto,
  CreateScanResponseDto,
  ScanResponseDto,
} from "./dto/scan-response.dto";
import { ScanEnrichmentService } from "./scan-enrichment.service";
import { ScanService } from "./scan.service";

@ApiTags("Scans")
@ApiCookieAuth()
@UseGuards(RequireSessionGuard)
@Controller("scans")
export class ScanController {
  constructor(
    private readonly scanService: ScanService,
    private readonly scanEnrichmentService: ScanEnrichmentService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Upload an image and create a scan job" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        image: { type: "string", format: "binary" },
        backImage: { type: "string", format: "binary" },
      },
      required: ["image"],
    },
  })
  @ApiOkResponse({ type: CreateScanResponseDto })
  @ApiBadRequestResponse({ description: "Front image file is required." })
  @ApiUnauthorizedResponse({ description: "Sign in required." })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "image", maxCount: 1 },
      { name: "backImage", maxCount: 1 },
    ]),
  )
  async createScan(
    @UploadedFiles() files: UploadedFileFields,
    @CurrentUser() user: User,
  ) {
    return this.scanService.createScan({
      userId: user.id,
      frontFile: files.image?.[0],
      backFile: files.backImage?.[0],
    });
  }

  @Get(":scanId")
  @ApiOperation({ summary: "Get scan job status and candidates" })
  @ApiOkResponse({ type: ScanResponseDto })
  @ApiNotFoundResponse({ description: "Scan not found." })
  async getScan(
    @Param("scanId", ParseIntPipe) scanId: number,
    @CurrentUser() user: User,
  ) {
    return this.scanService.getScan(scanId, user.id);
  }

  @Get(":scanId/image/:side")
  @ApiOperation({ summary: "Get uploaded scan image (front/back)" })
  @ApiBadRequestResponse({ description: 'side must be "front" or "back".' })
  @ApiNotFoundResponse({ description: "Scan or image not found." })
  async getScanImage(
    @Param("scanId", ParseIntPipe) scanId: number,
    @Param("side") side: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    if (side !== "front" && side !== "back") {
      res.status(400).json({ message: 'side must be "front" or "back".' });
      return;
    }

    const image = await this.scanService.getScanImage(scanId, user.id, side);
    res.setHeader("Content-Type", image.contentType);
    res.send(image.buffer);
  }

  @Get(":scanId/candidates/:candidateId/preview-image")
  @ApiOperation({
    summary: "Get trusted proxied preview image for a scan candidate hint",
  })
  @ApiBadRequestResponse({ description: "hintUrl is required." })
  @ApiNotFoundResponse({
    description: "Scan candidate or preview image not found.",
  })
  async getCandidatePreviewImage(
    @Param("scanId", ParseIntPipe) scanId: number,
    @Param("candidateId", ParseIntPipe) candidateId: number,
    @Query("hintUrl") hintUrl: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const image = await this.scanService.getCandidatePreviewImage(
      scanId,
      candidateId,
      user.id,
      hintUrl ?? "",
    );
    res.setHeader("Content-Type", image.contentType);
    res.setHeader("Cache-Control", "public, max-age=43200");
    res.send(image.buffer);
  }

  @Post(":scanId/candidates/:candidateId/enrich")
  @ApiOperation({
    summary: "Enrich a chosen scan candidate with web metadata evidence",
  })
  @ApiOkResponse({ type: EnrichScanCandidateResponseDto })
  @ApiBadRequestResponse({ description: "Invalid enrichment payload." })
  @ApiNotFoundResponse({ description: "Scan candidate not found." })
  async enrichCandidate(
    @Param("scanId", ParseIntPipe) scanId: number,
    @Param("candidateId", ParseIntPipe) candidateId: number,
    @CurrentUser() user: User,
    @Body() body: EnrichScanCandidateRequestDto,
  ) {
    return this.scanEnrichmentService.enrichCandidate(
      scanId,
      candidateId,
      user.id,
      body.draft,
    );
  }

  @Post(":scanId/confirm")
  @ApiOperation({ summary: "Confirm selected scan candidate and save card" })
  @ApiOkResponse({ type: ConfirmScanResponseDto })
  @ApiBadRequestResponse({ description: "Invalid confirmation payload." })
  @ApiNotFoundResponse({ description: "Scan not found." })
  async confirmScan(
    @Param("scanId", ParseIntPipe) scanId: number,
    @CurrentUser() user: User,
    @Body() body: ConfirmScanDto,
  ) {
    return this.scanService.confirmScan(scanId, user.id, body);
  }
}
