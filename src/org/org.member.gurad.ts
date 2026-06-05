

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'database/prisma/prisma.service';
import { ORG_ROLES_KEY } from 'src/common/decorators/role.decorator';
import { OrgRole ,GlobalRole,hasMinOrgRole} from 'src/common/enum/roles.enum';

@Injectable()
export class OrgMemberGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    // SuperAdmins bypass org-level checks
    if (user?.role === GlobalRole.SUPERADMIN) return true;

    const orgId = req.params?.orgId;
    if (!orgId) {
      throw new ForbiddenException('Access denied');
    }

    // Check if org is active (suspended orgs block all access)
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { is_active: true },
    });
    if (!org) throw new NotFoundException('Organisation not found');
    if (!org.is_active) throw new ForbiddenException('Organisation is suspended');

    // Resolve required OrgRole from metadata (default: any member)
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(
      ORG_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const membership = await this.prisma.organizationMember.findUnique({
      where: { org_id_user_id: { org_id: orgId, user_id: user.sub } },
    });

    if (!membership) {
      throw new ForbiddenException('Access denied');
    }

    if (requiredRoles && requiredRoles.length > 0) {
      const meetsRole = requiredRoles.some((r) =>
        hasMinOrgRole(membership.role as OrgRole, r),
      );
      if (!meetsRole) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    // Attach membership to request for downstream use
    req.orgMembership = membership;
    return true;
  }
}