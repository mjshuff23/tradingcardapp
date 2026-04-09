import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from './current-user.decorator';
import { AUTH_COOKIE_NAME } from './auth.constants';
import { AuthService } from './auth.service';
import { RequireSessionGuard } from './require-session.guard';
import { SessionGuard } from './session.guard';
import { AuthSessionDto } from './dto/auth-session.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { User } from '../prisma/client';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(SessionGuard)
  @Get('me')
  @ApiOkResponse({ type: AuthSessionDto })
  async me(@CurrentUser() user: User | null): Promise<AuthSessionDto> {
    return {
      authenticated: Boolean(user),
      user: user ? this.authService.toAuthUserDto(user) : null,
    };
  }

  @Post('signup')
  @ApiCreatedResponse({ type: AuthSessionDto })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiConflictResponse({ description: 'Email or username already exists.' })
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionDto> {
    const user = await this.authService.signup(dto);
    const session = await this.authService.createSession(user.id);
    this.authService.writeSessionCookie(response, session.sessionToken, session.expiresAt);

    return {
      authenticated: true,
      user: this.authService.toAuthUserDto(user),
    };
  }

  @Post('login')
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password.' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionDto> {
    const user = await this.authService.login(dto);
    const session = await this.authService.createSession(user.id);
    this.authService.writeSessionCookie(response, session.sessionToken, session.expiresAt);

    return {
      authenticated: true,
      user: this.authService.toAuthUserDto(user),
    };
  }

  @UseGuards(RequireSessionGuard)
  @ApiCookieAuth()
  @Post('logout')
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
}
