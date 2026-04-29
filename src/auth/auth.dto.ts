import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsArray,
  ValidateNested,
  IsEnum,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrgRole } from 'src/common/enum/roles.enum';

export class InviteMemberItemDto {
  @IsEmail({}, { message: 'Must be a valid email' })
  email: string;

  @IsEnum(OrgRole, {
    message: `Role must be one of: ${Object.values(OrgRole).join(', ')}`,
  })
  role: OrgRole;
}

export class BulkInviteDto {
  @IsUUID('4')
  org_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InviteMemberItemDto)
  members: InviteMemberItemDto[];
}

export class AcceptInviteDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}