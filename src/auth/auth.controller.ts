import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { SignupDto } from './signup.dto';
import { JwtAuthGuard } from './jwt.auth.gaurd';
import { JwtRefreshGuard } from './jwt.refresh.guard';
import type { JwtPayload } from './jwt.strategy';
import type { JwtRefreshPayload } from './jwt-refresh.stategy';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.signup(dto, res);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.authService.login(
      dto,
      res,
      req.headers['user-agent'] ?? '',
      req.ip ?? '',
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  async refresh(
    @Req() req: Request & { user: JwtRefreshPayload & { rawRefreshToken: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.refresh(req.user, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: Request & { user: JwtPayload },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.logout(req.user.sessionId, res);
  }
}