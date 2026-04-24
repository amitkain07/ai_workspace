

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'database/prisma/prisma.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto, AddWorkspaceMemberDto } from './workspace.dto';
import { OrgRole } from 'src/common/enum/roles.enum';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(private prisma: PrismaService) {}

  // ── Create ───────────────────────────────────────────────────

  async create(orgId: string, creatorId: string, dto: CreateWorkspaceDto) {
    // Slug unique within org
    const conflict = await this.prisma.workspace.findUnique({
      where: { org_id_slug: { org_id: orgId, slug: dto.slug } },
    });
    if (conflict) {
      throw new ConflictException(
        `Slug "${dto.slug}" is already used in this organisation`,
      );
    }

    const workspace = await this.prisma.workspace.create({
      data: {
        org_id: orgId,
        name: dto.name,
        slug: dto.slug,
        system_prompt: dto.system_prompt,
        created_by: creatorId,
      },
    });

    // Creator becomes WORKSPACE_ADMIN automatically
    await this.prisma.workspaceMember.create({
      data: {
        workspace_id: workspace.id,
        user_id: creatorId,
        role: OrgRole.WORKSPACE_ADMIN,
      },
    });

    this.logger.log(`Workspace ${workspace.id} created in org ${orgId}`);
    return workspace;
  }

  // ── List workspaces in org ───────────────────────────────────

  async findAll(orgId: string, callerId: string, callerOrgRole: OrgRole) {
    // ORG_ADMIN sees all workspaces; others see only their own
    if (callerOrgRole === OrgRole.ORG_ADMIN) {
      return this.prisma.workspace.findMany({
        where: { org_id: orgId },
        include: {
          _count: { select: { members: true } },
          creator: { select: { id: true, email: true } },
        },
        orderBy: { created_at: 'asc' },
      });
    }

    const memberships = await this.prisma.workspaceMember.findMany({
      where: { user_id: callerId, workspace: { org_id: orgId } },
      include: {
        workspace: {
          include: { _count: { select: { members: true } } },
        },
      },
    });

    return memberships.map((m) => ({ ...m.workspace, my_role: m.role }));
  }

  // ── Get one (with org isolation check) ───────────────────────

  async findOne(orgId: string, workspaceId: string) {
    const ws = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, org_id: orgId },
      include: {
        creator: { select: { id: true, email: true } },
        _count: { select: { members: true } },
      },
    });
    if (!ws) throw new NotFoundException('Workspace not found');
    return ws;
  }

  // ── Update ───────────────────────────────────────────────────

  async update(orgId: string, workspaceId: string, dto: UpdateWorkspaceDto) {
    await this.findOne(orgId, workspaceId); // 404 check + isolation

    if (dto.slug) {
      const conflict = await this.prisma.workspace.findFirst({
        where: {
          org_id: orgId,
          slug: dto.slug,
          id: { not: workspaceId },
        },
      });
      if (conflict) throw new ConflictException('Slug already used in this org');
    }

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: dto,
    });
  }

  // ── Delete (soft) ────────────────────────────────────────────

  async remove(orgId: string, workspaceId: string) {
    await this.findOne(orgId, workspaceId);
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { is_active: false },
    });
  }

  // ── Workspace Members ────────────────────────────────────────

  async getMembers(orgId: string, workspaceId: string) {
    await this.findOne(orgId, workspaceId); // isolation
    return this.prisma.workspaceMember.findMany({
      where: { workspace_id: workspaceId },
      include: {
        workspace: {
          select: { id: true, name: true },
        },
      },
      orderBy: { added_at: 'asc' },
    });
  }

  async addMember(
    orgId: string,
    workspaceId: string,
    dto: AddWorkspaceMemberDto,
  ) {
    await this.findOne(orgId, workspaceId);

    // Target user must already be an org member
    const orgMember = await this.prisma.organizationMember.findUnique({
      where: {
        org_id_user_id: { org_id: orgId, user_id: dto.user_id },
      },
    });
    if (!orgMember) {
      throw new BadRequestException(
        'User must be an org member before being added to a workspace',
      );
    }

    const existing = await this.prisma.workspaceMember.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: workspaceId,
          user_id: dto.user_id,
        },
      },
    });
    if (existing) throw new ConflictException('User is already in this workspace');

    return this.prisma.workspaceMember.create({
      data: {
        workspace_id: workspaceId,
        user_id: dto.user_id,
        role: dto.role,
      },
    });
  }

  async removeMember(
    orgId: string,
    workspaceId: string,
    userId: string,
    callerId: string,
  ) {
    const ws = await this.findOne(orgId, workspaceId);

    // Can't remove the workspace creator (last admin guard)
    if (ws.created_by === userId) {
      const adminCount = await this.prisma.workspaceMember.count({
        where: { workspace_id: workspaceId, role: OrgRole.WORKSPACE_ADMIN },
      });
      if (adminCount <= 1) {
        throw new ForbiddenException(
          'Cannot remove the last WORKSPACE_ADMIN',
        );
      }
    }

    await this.prisma.workspaceMember.delete({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: userId },
      },
    });

    return { message: 'Member removed from workspace' };
  }

  // ── Update system prompt ─────────────────────────────────────

  async updateSystemPrompt(
    orgId: string,
    workspaceId: string,
    systemPrompt: string,
  ) {
    await this.findOne(orgId, workspaceId);
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { system_prompt: systemPrompt },
      select: { id: true, name: true, system_prompt: true, updated_at: true },
    });
  }

  async updateMemberRole(
  orgId: string,
  workspaceId: string,
  userId: string,
  role: OrgRole,
) {
  await this.findOne(orgId, workspaceId);

  const member = await this.prisma.workspaceMember.findUnique({
    where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: userId } },
  });
  if (!member) throw new NotFoundException('Member not found in this workspace');

  return this.prisma.workspaceMember.update({
    where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: userId } },
    data: { role },
  });
}
}