import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { Response } from 'express';
import { DEFAULT_LOCAL_USER } from '../common/catalog-normalization.util';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../prisma/client';
import { AUTH_COOKIE_NAME, AUTH_SESSION_TTL_MS } from './auth.constants';
import { AuthUserDto } from './dto/auth-user.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async signup(dto: SignupDto) {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim();
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existing) {
      throw new ConflictException('An account with that email or username already exists.');
    }

    const passwordHash = await argon2.hash(dto.password);
    return this.prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
      },
    });
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const validPassword = await argon2.verify(user.passwordHash, dto.password);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return user;
  }

  async createSession(userId: string) {
    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + AUTH_SESSION_TTL_MS);

    await this.prisma.session.create({
      data: {
        sessionToken,
        userId,
        expiresAt,
      },
    });

    return {
      sessionToken,
      expiresAt,
    };
  }

  async findUserBySessionToken(sessionToken: string): Promise<User | null> {
    const session = await this.prisma.session.findUnique({
      where: { sessionToken },
      include: { user: true },
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.delete({
        where: { sessionToken },
      });
      return null;
    }

    return session.user;
  }

  async deleteSession(sessionToken: string) {
    await this.prisma.session.deleteMany({
      where: { sessionToken },
    });
  }

  async ensureDemoUser() {
    return this.prisma.user.upsert({
      where: { id: DEFAULT_LOCAL_USER.id },
      update: {
        username: DEFAULT_LOCAL_USER.username,
        email: DEFAULT_LOCAL_USER.email,
        passwordHash: DEFAULT_LOCAL_USER.passwordHash,
        pfpUrl: DEFAULT_LOCAL_USER.pfpUrl,
      },
      create: DEFAULT_LOCAL_USER,
    });
  }

  toAuthUserDto(user: User): AuthUserDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      pfpUrl: user.pfpUrl,
    };
  }

  writeSessionCookie(response: Response, sessionToken: string, expiresAt: Date) {
    response.cookie(AUTH_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
      path: '/',
    });
  }

  clearSessionCookie(response: Response) {
    response.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }
}
