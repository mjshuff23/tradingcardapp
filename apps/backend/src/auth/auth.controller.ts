import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Response } from "express";
import type { Express } from "express";
import { CurrentUser } from "./current-user.decorator";
import { AUTH_COOKIE_NAME } from "./auth.constants";
import { AuthService } from "./auth.service";
import { RequireSessionGuard } from "./require-session.guard";
import { SessionGuard } from "./session.guard";
import { AuthSessionDto } from "./dto/auth-session.dto";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";
import { User } from "../prisma/client";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(SessionGuard)
  @Get("me")
  @ApiOkResponse({ type: AuthSessionDto })
  async me(@CurrentUser() user: User | null): Promise<AuthSessionDto> {
    return {
      authenticated: Boolean(user),
      user: user ? this.authService.toAuthUserDto(user) : null,
    };
  }

  @Post("signup")
  @ApiCreatedResponse({ type: AuthSessionDto })
  @ApiBadRequestResponse({ description: "Validation failed." })
  @ApiConflictResponse({ description: "Email or username already exists." })
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionDto> {
    const user = await this.authService.signup(dto);
    const session = await this.authService.createSession(user.id);
    this.authService.writeSessionCookie(
      response,
      session.sessionToken,
      session.expiresAt,
    );

    return {
      authenticated: true,
      user: this.authService.toAuthUserDto(user),
    };
  }

  @Post("login")
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiBadRequestResponse({ description: "Validation failed." })
  @ApiUnauthorizedResponse({ description: "Invalid email or password." })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionDto> {
    const user = await this.authService.login(dto);
    const session = await this.authService.createSession(user.id);
    this.authService.writeSessionCookie(
      response,
      session.sessionToken,
      session.expiresAt,
    );

    return {
      authenticated: true,
      user: this.authService.toAuthUserDto(user),
    };
  }

  @UseGuards(RequireSessionGuard)
  @ApiCookieAuth()
  @Post("logout")
  @ApiOkResponse({ type: AuthSessionDto })
  async logout(
    @CurrentUser() _user: User,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionDto> {
    const currentCookie = response.req?.cookies?.[AUTH_COOKIE_NAME];
    if (currentCookie) {
      await this.authService.deleteSession(currentCookie);
    }
    this.authService.clearSessionCookie(response);

    return {
      authenticated: false,
      user: null,
    };
  }

  @UseGuards(RequireSessionGuard)
  @ApiCookieAuth()
  @Get("me/pfp")
  @ApiNotFoundResponse({ description: "Profile image not found." })
  async getProfileImage(@CurrentUser() user: User, @Res() response: Response) {
    const image = await this.authService.getProfileImage(user.id);
    response.setHeader("Content-Type", image.contentType);
    response.send(image.buffer);
  }

  @UseGuards(RequireSessionGuard)
  @ApiCookieAuth()
  @Post("me/pfp")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        image: { type: "string", format: "binary" },
      },
      required: ["image"],
    },
  })
  @ApiOkResponse({ type: AuthSessionDto })
  @UseInterceptors(FileInterceptor("image"))
  async uploadProfileImage(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<AuthSessionDto> {
    if (!file) {
      throw new BadRequestException("Profile image is required.");
    }

    const nextUser = await this.authService.uploadProfileImage(user.id, file);
    return {
      authenticated: true,
      user: nextUser,
    };
  }

  @UseGuards(RequireSessionGuard)
  @ApiCookieAuth()
  @Delete("me/pfp")
  @ApiOkResponse({ type: AuthSessionDto })
  async clearProfileImage(@CurrentUser() user: User): Promise<AuthSessionDto> {
    const nextUser = await this.authService.clearProfileImage(user.id);
    return {
      authenticated: true,
      user: nextUser,
    };
  }
}
