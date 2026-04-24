import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { OrgPlan,OrgRole } from 'src/common/enum/roles.enum';

// ─── Org DTOs ─────────────────────────────────────────────────────────────────

export class CreateOrgDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  })
  slug: string;

  @IsEnum(OrgPlan, {
    message: `Plan must be one of: ${Object.values(OrgPlan).join(', ')}`,
  })
  @IsOptional()
  plan?: OrgPlan;

  @IsInt()
  @Min(1_000)
  @Max(10_000_000)
  @IsOptional()
  token_quota?: number;
}

export class UpdateOrgDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  })
  slug?: string;

  @IsEnum(OrgPlan, {
    message: `Plan must be one of: ${Object.values(OrgPlan).join(', ')}`,
  })
  @IsOptional()
  plan?: OrgPlan;

  @IsInt()
  @Min(1_000)
  @Max(10_000_000)
  @IsOptional()
  token_quota?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

// ─── Member DTOs ──────────────────────────────────────────────────────────────

export class InviteMemberDto {
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty()
  email: string;

  @IsEnum(OrgRole, {
    message: `Role must be one of: ${Object.values(OrgRole).join(', ')}`,
  })
  role: OrgRole;
}

export class UpdateMemberRoleDto {
  @IsEnum(OrgRole, {
    message: `Role must be one of: ${Object.values(OrgRole).join(', ')}`,
  })
  @IsNotEmpty()
  role: OrgRole;
}

export class TransferOwnershipDto {
  @IsUUID('4', { message: 'new_owner_id must be a valid UUID' })
  @IsNotEmpty()
  new_owner_id: string;
}