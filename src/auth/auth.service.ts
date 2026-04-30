import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'database/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { LoginDto } from './login.dto';
import { SignupDto } from './signup.dto';
import { BulkInviteDto, AcceptInviteDto } from './auth.dto';
import type { JwtRefreshPayload } from './jwt-refresh.stategy';
import { GlobalRole, OrgRole } from 'src/common/enum/roles.enum';
import { EmailService } from 'src/common/email/email.service';

const ACCESS_TOKEN_COOKIE  = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const ACCESS_EXPIRY_MS     = 15 * 60 * 1000;
const REFRESH_EXPIRY_MS    = 7 * 24 * 60 * 60 * 1000;
const INVITE_EXPIRY_HOURS  = 72;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async signup(dto: SignupDto, res: Response) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email already in use');

    if (dto.members?.length && !dto.org) {
      throw new BadRequestException('Cannot invite members without creating an org');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        name: dto.name,
        role: GlobalRole.SUPERADMIN,
      },
      select: { id: true, email: true, role: true, name: true },
    });

    let orgResult: { id: string; name: string; slug: string } | null = null;
    let inviteResults: Awaited<ReturnType<typeof this.createBulkInviteTokens>> = [];

    if (dto.org) {
      const slugExists = await this.prisma.organization.findUnique({
        where: { slug: dto.org.slug },
      });
      if (slugExists) throw new ConflictException(`Slug "${dto.org.slug}" is already taken`);

      const org = await this.prisma.organization.create({
        data: {
          name: dto.org.name,
          slug: dto.org.slug,
          owner_id: user.id,
          plan: dto.org.plan ?? 'FREE',
          token_quota: dto.org.token_quota ?? 100_000,
        },
      });

      await this.prisma.organizationMember.create({
        data: { org_id: org.id, user_id: user.id, role: OrgRole.ORG_ADMIN },
      });

      orgResult = { id: org.id, name: org.name, slug: org.slug };

      if (dto.members?.length) {
        inviteResults = await this.createBulkInviteTokens(
          org.id,
          user.id,
          user.name,
          org.name,
          dto.members,
        );
      }
    }

    const sessionId      = randomUUID();
    const refreshTokenId = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user.id, user.email, user.role, sessionId),
      this.signRefreshToken(user.id, user.email, user.role, sessionId, refreshTokenId),
    ]);

    this.attachCookies(res, accessToken, refreshToken);
    this.logger.log(`SUPERADMIN signup: ${user.id}`);

    const response: Record<string, unknown> = { userId: user.id, role: user.role };
    if (orgResult) response.org = orgResult;
    if (inviteResults.length) response.invites = inviteResults;

    return response;
  }

  async invite(callerId: string, dto: BulkInviteDto) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { org_id_user_id: { org_id: dto.org_id, user_id: callerId } },
    });

    if (!membership) throw new ForbiddenException('You are not a member of this organisation');
    if (membership.role !== OrgRole.ORG_ADMIN) throw new ForbiddenException('Only ORG_ADMIN can invite members');

    const caller = await this.prisma.user.findUnique({
      where: { id: callerId },
      select: { name: true },
    });

    const org = await this.prisma.organization.findUnique({
      where: { id: dto.org_id },
      select: { name: true },
    });

    const results = await this.createBulkInviteTokens(
      dto.org_id,
      callerId,
      caller?.name ?? 'Someone',
      org?.name ?? 'the organisation',
      dto.members,
    );

    return { invites: results };
  }

  async acceptInvite(dto: AcceptInviteDto, res: Response) {
    const hashedToken = createHash('sha256').update(dto.token).digest('hex');

    const invite = await this.prisma.inviteToken.findUnique({
      where: { token: hashedToken },
    });

    if (!invite) throw new NotFoundException('Invalid or expired invite token');
    if (invite.accepted_at) throw new BadRequestException('Invite already accepted');
    if (invite.expires_at < new Date()) throw new BadRequestException('Invite token has expired');

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invite.email },
    });
    if (existingUser) throw new ConflictException('An account with this email already exists');

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: invite.email,
        password: hashedPassword,
        name: dto.name,
        role: GlobalRole.USER,
      },
      select: { id: true, email: true, role: true },
    });

    await this.prisma.organizationMember.create({
      data: {
        org_id: invite.org_id,
        user_id: user.id,
        role: invite.role as OrgRole,
        invited_by: invite.invited_by,
      },
    });

    await this.prisma.inviteToken.update({
      where: { token: hashedToken },
      data: { accepted_at: new Date() },
    });

    const sessionId      = randomUUID();
    const refreshTokenId = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user.id, user.email, user.role, sessionId),
      this.signRefreshToken(user.id, user.email, user.role, sessionId, refreshTokenId),
    ]);

    this.attachCookies(res, accessToken, refreshToken);
    this.logger.log(`Invite accepted: ${user.id} joined org ${invite.org_id}`);

    return { userId: user.id, role: user.role };
  }

  async login(dto: LoginDto, res: Response, userAgent: string, ip: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true, email: true, role: true, password: true },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    const sessionId      = randomUUID();
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

    if (!user) throw new UnauthorizedException('Session invalid or expired');

    const newRefreshTokenId = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user.id, user.email, user.role, payload.sessionId),
      this.signRefreshToken(user.id, user.email, user.role, payload.sessionId, newRefreshTokenId),
    ]);

    this.attachCookies(res, accessToken, refreshToken);
    return { userId: user.id, role: user.role };
  }

  async logout(_sessionId: string, res: Response) {
    this.clearCookies(res);
  }

  // ── Private helpers ──────────────────────────────────────────

  private async createBulkInviteTokens(
    orgId: string,
    inviterId: string,
    inviterName: string,
    orgName: string,
    members: { email: string; role: OrgRole }[],
  ) {
    const results: {
      email: string;
      role: OrgRole;
      status: 'invited' | 'skipped' | 'failed';
      token?: string;
      reason?: string;
    }[] = [];

    for (const member of members) {
      try {
        const email = member.email.toLowerCase();

        const existingUser = await this.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          results.push({ email, role: member.role, status: 'skipped', reason: 'User already has an account' });
          continue;
        }

        const pendingInvite = await this.prisma.inviteToken.findFirst({
          where: { email, org_id: orgId, accepted_at: null, expires_at: { gt: new Date() } },
        });
        if (pendingInvite) {
          results.push({ email, role: member.role, status: 'skipped', reason: 'Pending invite already exists' });
          continue;
        }

        const rawToken    = randomBytes(32).toString('hex');
        const hashedToken = createHash('sha256').update(rawToken).digest('hex');
        const expiresAt   = new Date();
        expiresAt.setHours(expiresAt.getHours() + INVITE_EXPIRY_HOURS);

        await this.prisma.inviteToken.create({
          data: {
            email,
            role: member.role,
            token: hashedToken,
            invited_by: inviterId,
            org_id: orgId,
            expires_at: expiresAt,
          },
        });

        await this.emailService.sendInvite({
          to: email,
          inviterName,
          orgName,
          role: member.role,
          token: rawToken,
        });

        results.push({ email, role: member.role, status: 'invited', token: rawToken });
        this.logger.log(`Invite created for ${email} → org ${orgId} as ${member.role}`);
      } catch (err) {
        results.push({ email: member.email, role: member.role, status: 'failed', reason: 'Internal error' });
        this.logger.error(`Failed to invite ${member.email}: ${err}`);
      }
    }

    return results;
  }

  private signAccessToken(userId: string, email: string, role: string, sessionId: string) {
    return this.jwt.signAsync(
      { sub: userId, email, role, sessionId },
      { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '15m' },
    );
  }

  private signRefreshToken(userId: string, email: string, role: string, sessionId: string, refreshTokenId: string) {
    return this.jwt.signAsync(
      { sub: userId, email, role, sessionId, refreshTokenId },
      { secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'), expiresIn: '7d' },
    );
  }

  private attachCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProd = this.config.get('NODE_ENV') === 'production';

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true, secure: isProd, sameSite: 'strict',
      maxAge: ACCESS_EXPIRY_MS, path: '/',
    });

    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true, secure: isProd, sameSite: 'strict',
      maxAge: REFRESH_EXPIRY_MS, path: '/auth/refresh',
    });
  }

  private clearCookies(res: Response) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/auth/refresh' });
  }
}