import { SetMetadata } from '@nestjs/common';
import { GlobalRole, OrgRole } from '../enum/roles.enum';

export const GLOBAL_ROLES_KEY = 'global_roles';
export const ORG_ROLES_KEY    = 'org_roles';

export const Roles    = (...roles: GlobalRole[]) => SetMetadata(GLOBAL_ROLES_KEY, roles);
export const OrgRoles = (...roles: OrgRole[])    => SetMetadata(ORG_ROLES_KEY, roles);