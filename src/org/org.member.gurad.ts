

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ORG_ROLES_KEY } from '../decorators/roles.decorator';
import { GlobalRole, OrgRole, hasMinOrgRole } from '../enums/roles.enum';

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
      throw new ForbiddenException('No orgId in route params');
    }

    // Resolve required OrgRole from metadata (default: any member)
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(
      ORG_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const membership = await this.prisma.organizationMember.findUnique({
      where: { org_id_user_id: { org_id: orgId, user_id: user.sub } },
    });

    if (!membership) {
      throw new NotFoundException('You are not a member of this organisation');
    }

    if (requiredRoles && requiredRoles.length > 0) {
      const meetsRole = requiredRoles.some((r) =>
        hasMinOrgRole(membership.role as OrgRole, r),
      );
      if (!meetsRole) {
        throw new ForbiddenException(
          `Requires one of [${requiredRoles.join(', ')}]. Your role: ${membership.role}`,
        );
      }
    }

    // Attach membership to request for downstream use
    req.orgMembership = membership;
    return true;
  }
}