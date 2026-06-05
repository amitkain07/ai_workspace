

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ORG_ROLES_KEY } from 'src/common/decorators/role.decorator';
import { PrismaService } from 'database/prisma/prisma.service';
import { GlobalRole, OrgRole, hasMinOrgRole } from 'src/common/enum/roles.enum';

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (user?.role === GlobalRole.SUPERADMIN) return true;

    const { orgId, workspaceId } = req.params ?? {};
    if (!workspaceId) throw new ForbiddenException('Access denied');

    // Check if org is active
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { is_active: true },
    });
    if (!org) throw new NotFoundException('Organisation not found');
    if (!org.is_active) throw new ForbiddenException('Organisation is suspended');

    // 1. Verify workspace belongs to the org (isolation)
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, org_id: orgId },
    });
    if (!workspace) {
      throw new NotFoundException(
        'Workspace not found or does not belong to this organisation',
      );
    }

    // 2. OrgAdmins can manage all workspaces in their org
    const orgMembership = await this.prisma.organizationMember.findUnique({
      where: { org_id_user_id: { org_id: orgId, user_id: user.sub } },
    });
    if (orgMembership?.role === OrgRole.ORG_ADMIN) {
      req.workspace = workspace;
      req.orgMembership = orgMembership;
      return true;
    }

    // 3. Check workspace-level membership
    const wsMembership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: workspaceId,
          user_id: user.sub,
        },
      },
    });
    if (!wsMembership) {
      throw new ForbiddenException('Access denied');
    }

    // 4. Check role requirement from @OrgRoles()
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(
      ORG_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredRoles?.length) {
      const meetsRole = requiredRoles.some((r) =>
        hasMinOrgRole(wsMembership.role as OrgRole, r),
      );
      if (!meetsRole) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    req.workspace = workspace;
    req.wsMembership = wsMembership;
    return true;
  }
}