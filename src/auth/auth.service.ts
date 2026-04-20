import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'database/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { LoginDto } from './login.dto';
import { SignupDto } from './signup.dto';
import type { JwtRefreshPayload } from './jwt-refresh.stategy';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const ACCESS_EXPIRY_MS = 15 * 60 * 1000;
const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}


  async signup(dto: SignupDto, res: Response) {
  const existing = await this.prisma.user.findUnique({
    where: { email: dto.email.toLowerCase() },
  });

  if (existing) {
    throw new ConflictException('Email already in use');
  }

  const hashedPassword = await bcrypt.hash(dto.password, 12);

  const user = await this.prisma.user.create({
    data: {
      email: dto.email.toLowerCase(),
      password: hashedPassword,
    },
    select: { id: true, email: true, role: true },
  });

  const sessionId = randomUUID();
  const refreshTokenId = randomUUID();

  const [accessToken, refreshToken] = await Promise.all([
    this.signAccessToken(user.id, user.email, user.role, sessionId),
    this.signRefreshToken(user.id, user.email, user.role, sessionId, refreshTokenId),
  ]);

  this.attachCookies(res, accessToken, refreshToken);

  return { userId: user.id, role: user.role };
}

  async login(dto: LoginDto, res: Response, userAgent: string, ip: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true, email: true, role: true, password: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const sessionId = randomUUID();
    const refreshTokenId = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user.id, user.email, user.role, sessionId),
      this.signRefreshToken(user.id, user.email, user.role, sessionId, refreshTokenId),
    ]);

    this.attachCookies(res, accessToken, refreshToken);

    return { userId: user.id, role: user.role };
  }

  async refresh(payload: JwtRefreshPayload & { rawRefreshToken: string }, res: Response) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedException('Session invalid or expired');
    }

    const newRefreshTokenId = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user.id, user.email, user.role, payload.sessionId),
      this.signRefreshToken(user.id, user.email, user.role, payload.sessionId, newRefreshTokenId),
    ]);

    this.attachCookies(res, accessToken, refreshToken);

    return { userId: user.id, role: user.role };
  }

  async logout(sessionId: string, res: Response) {
    this.clearCookies(res);
  }

  private async signAccessToken(
    userId: string,
    email: string,
    role: string,
    sessionId: string,
  ): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, email, role, sessionId },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );
  }

  private async signRefreshToken(
    userId: string,
    email: string,
    role: string,
    sessionId: string,
    refreshTokenId: string,
  ): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, email, role, sessionId, refreshTokenId },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );
  }

  private attachCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProd = this.config.get('NODE_ENV') === 'production';

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: ACCESS_EXPIRY_MS,
      path: '/',
    });

    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: REFRESH_EXPIRY_MS,
      path: '/auth/refresh',
    });
  }

  private clearCookies(res: Response) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/auth/refresh' });
  }
}