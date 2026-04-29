import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from 'database/prisma/prisma.service';
import { CreateOrgDto, UpdateOrgDto, InviteMemberDto, UpdateMemberRoleDto } from './org.dto';
import { GlobalRole, OrgRole } from 'src/common/enum/roles.enum';

const INVITE_EXPIRY_HOURS = 72;

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateOrgDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException(`Slug "${dto.slug}" is already taken`);

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        owner_id: ownerId,
        plan: dto.plan ?? 'FREE',
        token_quota: dto.token_quota ?? 100_000,
      },
    });

    await this.prisma.organizationMember.create({
      data: { org_id: org.id, user_id: ownerId, role: OrgRole.ORG_ADMIN },
    });

    this.logger.log(`Org created: ${org.id} by user ${ownerId}`);
    return { ...org, my_role: OrgRole.ORG_ADMIN };
  }

  async findAll(callerId: string, callerRole: string) {
    if (callerRole === GlobalRole.SUPERADMIN) {
      return this.prisma.organization.findMany({
        include: { _count: { select: { members: true, workspaces: true } } },
        orderBy: { created_at: 'desc' },
      });
    }

    const memberships = await this.prisma.organizationMember.findMany({
      where: { user_id: callerId },
      include: {
        org: {
          include: { _count: { select: { members: true, workspaces: true } } },
        },
      },
    });

    return memberships.map((m) => ({ ...m.org, my_role: m.role }));
  }

  async findOne(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        owner: { select: { id: true, email: true } },
        _count: { select: { members: true, workspaces: true } },
      },
    });
    if (!org) throw new NotFoundException('Organisation not found');
    return org;
  }

  async update(orgId: string, dto: UpdateOrgDto) {
    await this.findOne(orgId);

    if (dto.slug) {
      const conflict = await this.prisma.organization.findFirst({
        where: { slug: dto.slug, id: { not: orgId } },
      });
      if (conflict) throw new ConflictException('Slug already taken');
    }

    return this.prisma.organization.update({ where: { id: orgId }, data: dto });
  }

  async suspend(orgId: string) {
    return this.prisma.organization.update({ where: { id: orgId }, data: { is_active: false } });
  }

  async activate(orgId: string) {
    return this.prisma.organization.update({ where: { id: orgId }, data: { is_active: true } });
  }

  async getMembers(orgId: string) {
    return this.prisma.organizationMember.findMany({
      where: { org_id: orgId },
      include: { user: { select: { id: true, email: true, is_active: true } } },
      orderBy: { joined_at: 'asc' },
    });
  }

  async inviteMember(orgId: string, inviterId: string, dto: InviteMemberDto) {
    const email = dto.email.toLowerCase();

    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      // Block adding SUPERADMIN to an org
      if (existingUser.role === GlobalRole.SUPERADMIN) {
        throw new ForbiddenException('Cannot add a SUPERADMIN to an org');
      }

      const alreadyMember = await this.prisma.organizationMember.findUnique({
        where: { org_id_user_id: { org_id: orgId, user_id: existingUser.id } },
      });
      if (alreadyMember) throw new ConflictException('User is already a member of this org');

      const member = await this.prisma.organizationMember.create({
        data: { org_id: orgId, user_id: existingUser.id, role: dto.role, invited_by: inviterId },
        include: { user: { select: { id: true, email: true } } },
      });

      this.logger.log(`User ${existingUser.id} added to org ${orgId} as ${dto.role}`);
      return { type: 'added', member };
    }

    // User doesn't exist — create invite token
    const pendingInvite = await this.prisma.inviteToken.findFirst({
      where: { email, org_id: orgId, accepted_at: null, expires_at: { gt: new Date() } },
    });
    if (pendingInvite) throw new ConflictException('A pending invite already exists for this email');

    const rawToken    = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt   = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITE_EXPIRY_HOURS);

    await this.prisma.inviteToken.create({
      data: {
        email,
        role: dto.role,
        token: hashedToken,
        invited_by: inviterId,
        org_id: orgId,
        expires_at: expiresAt,
      },
    });

    this.logger.log(`Invite token created for ${email} → org ${orgId} as ${dto.role}`);
    return { type: 'invited', email, role: dto.role, token: rawToken };
  }

  async updateMemberRole(orgId: string, targetUserId: string, callerId: string, dto: UpdateMemberRoleDto) {
    if (targetUserId === callerId && dto.role !== OrgRole.ORG_ADMIN) {
      const adminCount = await this.prisma.organizationMember.count({
        where: { org_id: orgId, role: OrgRole.ORG_ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot remove the last ORG_ADMIN from the organisation');
      }
    }

    const member = await this.prisma.organizationMember.findUnique({
      where: { org_id_user_id: { org_id: orgId, user_id: targetUserId } },
    });
    if (!member) throw new NotFoundException('Member not found in this org');

    return this.prisma.organizationMember.update({
      where: { org_id_user_id: { org_id: orgId, user_id: targetUserId } },
      data: { role: dto.role },
    });
  }

  async removeMember(orgId: string, targetUserId: string, callerId: string) {
    const org = await this.findOne(orgId);

    if (org.owner_id === targetUserId) {
      throw new ForbiddenException('Cannot remove the organisation owner');
    }

    if (targetUserId === callerId) {
      const adminCount = await this.prisma.organizationMember.count({
        where: { org_id: orgId, role: OrgRole.ORG_ADMIN },
      });
      const member = await this.prisma.organizationMember.findUnique({
        where: { org_id_user_id: { org_id: orgId, user_id: targetUserId } },
      });
      if (member?.role === OrgRole.ORG_ADMIN && adminCount <= 1) {
        throw new BadRequestException('Cannot remove the last ORG_ADMIN from the organisation');
      }
    }

    await this.prisma.organizationMember.delete({
      where: { org_id_user_id: { org_id: orgId, user_id: targetUserId } },
    });

    this.logger.log(`User ${targetUserId} removed from org ${orgId}`);
    return { message: 'Member removed successfully' };
  }

  async transferOwnership(orgId: string, newOwnerId: string, callerId: string) {
    const org = await this.findOne(orgId);
    if (org.owner_id !== callerId) {
      throw new ForbiddenException('Only the current owner can transfer ownership');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: { org_id_user_id: { org_id: orgId, user_id: newOwnerId } },
    });
    if (!membership) throw new BadRequestException('New owner must already be a member');

    await this.prisma.organizationMember.update({
      where: { org_id_user_id: { org_id: orgId, user_id: newOwnerId } },
      data: { role: OrgRole.ORG_ADMIN },
    });

    return this.prisma.organization.update({
      where: { id: orgId },
      data: { owner_id: newOwnerId },
    });
  }

  async getUsageSummary(orgId: string) {
    const org = await this.findOne(orgId);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const totals = await this.prisma.usage.aggregate({
      where: { org_id: orgId, created_at: { gte: startOfMonth } },
      _sum: { tokens_input: true, tokens_output: true, cost_usd: true },
      _count: { id: true },
    });

    const totalTokens = (totals._sum.tokens_input ?? 0) + (totals._sum.tokens_output ?? 0);

    return {
      org_id: orgId,
      plan: org.plan,
      token_quota: org.token_quota,
      tokens_used_this_month: totalTokens,
      quota_percent: Math.round((totalTokens / org.token_quota) * 100),
      cost_usd: totals._sum.cost_usd ?? 0,
      request_count: totals._count.id,
    };
  }
}