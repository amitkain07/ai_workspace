import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  Matches,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrgPlan, OrgRole } from 'src/common/enum/roles.enum';

export class SignupOrgDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  })
  slug: string;

  @IsEnum(OrgPlan)
  @IsOptional()
  plan?: OrgPlan;

  @IsInt()
  @Min(1_000)
  @Max(10_000_000)
  @IsOptional()
  token_quota?: number;
}

export class BulkInviteMemberDto {
  @IsEmail({}, { message: 'Must be a valid email' })
  email: string;

  @IsEnum(OrgRole, {
    message: `Role must be one of: ${Object.values(OrgRole).join(', ')}`,
  })
  role: OrgRole;
}

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SignupOrgDto)
  org?: SignupOrgDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkInviteMemberDto)
  members?: BulkInviteMemberDto[];
}