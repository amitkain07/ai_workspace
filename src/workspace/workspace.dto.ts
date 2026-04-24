import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { OrgRole } from 'src/common/enum/roles.enum';

// ─── Workspace DTOs ───────────────────────────────────────────────────────────

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  })
  slug: string;

  @IsString()
  @IsOptional()
  system_prompt?: string;
}

export class UpdateWorkspaceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  })
  slug?: string;

  @IsString()
  @IsOptional()
  system_prompt?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class UpdateSystemPromptDto {
  @IsString()
  @IsNotEmpty()
  system_prompt: string;
}

// ─── Workspace Member DTOs ────────────────────────────────────────────────────

export class AddWorkspaceMemberDto {
  @IsUUID('4', { message: 'user_id must be a valid UUID' })
  @IsNotEmpty()
  user_id: string;

  @IsEnum(OrgRole, {
    message: `Role must be one of: ${Object.values(OrgRole).join(', ')}`,
  })
  role: OrgRole;
}

export class UpdateWorkspaceMemberRoleDto {
  @IsEnum(OrgRole, {
    message: `Role must be one of: ${Object.values(OrgRole).join(', ')}`,
  })
  @IsNotEmpty()
  role: OrgRole;
}