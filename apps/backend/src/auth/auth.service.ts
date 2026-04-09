import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { Response } from 'express';
import type { Express } from 'express';
import { DEFAULT_LOCAL_USER } from '../common/catalog-normalization.util';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '../prisma/client';
import { StorageService } from '../storage/storage.service';
import { AUTH_COOKIE_NAME, AUTH_SESSION_TTL_MS } from './auth.constants';
import { AuthUserDto } from './dto/auth-user.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

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
        pfpOriginalImageKey: null,
        pfpThumbnailImageKey: null,
      },
      create: DEFAULT_LOCAL_USER,
    });
  }

  toAuthUserDto(user: User): AuthUserDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      pfpUrl: this.resolveProfileImageUrl(user),
    };
  }

  async uploadProfileImage(userId: string, file: Express.Multer.File) {
    const storedImage = await this.storageService.uploadProfileImage(file.buffer, file.originalname);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        pfpUrl: null,
        pfpOriginalImageKey: storedImage.originalKey,
        pfpThumbnailImageKey: storedImage.thumbnailKey,
      },
    });

    return this.toAuthUserDto(user);
  }

  async clearProfileImage(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    await Promise.all([
      this.storageService.deleteProfileImage(user.pfpOriginalImageKey),
      this.storageService.deleteProfileImage(user.pfpThumbnailImageKey),
      user.pfpUrl?.startsWith('http://') || user.pfpUrl?.startsWith('https://')
        ? Promise.resolve()
        : this.storageService.deleteProfileImage(user.pfpUrl),
    ]);

    const cleared = await this.prisma.user.update({
      where: { id: userId },
      data: {
        pfpUrl: null,
        pfpOriginalImageKey: null,
        pfpThumbnailImageKey: null,
      },
    });

    return this.toAuthUserDto(cleared);
  }

  async getProfileImage(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const key =
      user.pfpThumbnailImageKey ??
      user.pfpOriginalImageKey ??
      (user.pfpUrl && !isHttpUrl(user.pfpUrl) ? user.pfpUrl : null);

    if (!key) {
      throw new NotFoundException('Profile image not found.');
    }

    if (isHttpUrl(key)) {
      return this.fetchExternalImage(key);
    }

    return this.storageService.readProfileImage(key);
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

  private resolveProfileImageUrl(user: User): string | null {
    if (user.pfpThumbnailImageKey || user.pfpOriginalImageKey) {
      return '/api/v1/auth/me/pfp';
    }

    if (user.pfpUrl && isHttpUrl(user.pfpUrl)) {
      return user.pfpUrl;
    }

    if (user.pfpUrl) {
      return '/api/v1/auth/me/pfp';
    }

    return null;
  }

  private async fetchExternalImage(url: string) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new NotFoundException('Profile image fetch failed.');
      }

      const bytes = await response.arrayBuffer();
      return {
        buffer: Buffer.from(bytes),
        contentType: response.headers.get('content-type') ?? 'image/jpeg',
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function isHttpUrl(value: string | null | undefined) {
  return Boolean(value && (value.startsWith('http://') || value.startsWith('https://')));
}
