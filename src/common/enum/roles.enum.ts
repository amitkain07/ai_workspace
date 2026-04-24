export enum GlobalRole {
  SUPERADMIN = 'SUPERADMIN',
  USER = 'USER',
}

export enum OrgRole {
  ORG_ADMIN      = 'ORG_ADMIN',
  WORKSPACE_ADMIN = 'WORKSPACE_ADMIN',
  MEMBER         = 'MEMBER',
}

export enum OrgPlan {
  FREE       = 'FREE',
  PRO        = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

const ORG_ROLE_RANK: Record<OrgRole, number> = {
  [OrgRole.ORG_ADMIN]:       3,
  [OrgRole.WORKSPACE_ADMIN]: 2,
  [OrgRole.MEMBER]:          1,
};

export function hasMinOrgRole(userRole: OrgRole, required: OrgRole): boolean {
  return (ORG_ROLE_RANK[userRole] ?? 0) >= (ORG_ROLE_RANK[required] ?? 0);
}