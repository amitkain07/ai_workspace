import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GLOBAL_ROLES_KEY } from '../decorators/role.decorator';
import { GlobalRole } from '../enum/roles.enum';
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<GlobalRole[]>(
      GLOBAL_ROLES_KEY, [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;   // no @Roles() annotation → pass through
    const { user } = context.switchToHttp().getRequest();
    return required.includes(user?.role as GlobalRole);
  }
}