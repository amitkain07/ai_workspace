import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CreateOrgDto, UpdateOrgDto, InviteMemberDto, UpdateMemberRoleDto } from './org.dto';
import { OrganizationsService } from './org.service';
import { JwtAuthGuard } from 'src/auth/jwt.auth.gaurd';
import { OrgMemberGuard } from './org.member.gurad';
import { RolesGuard } from 'src/common/gurads/role.gurad';
import { Roles, OrgRoles } from 'src/common/decorators/role.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtPayload } from 'src/auth/jwt.strategy';
import { OrgRole, GlobalRole } from 'src/common/enum/roles.enum';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrgDto) {
    return this.orgsService.create(user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.orgsService.findAll(user.sub, user.role);
  }

  @Get(':orgId')
  @UseGuards(OrgMemberGuard)
  findOne(@Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.orgsService.findOne(orgId);
  }

  @Patch(':orgId')
  @UseGuards(OrgMemberGuard)
  @OrgRoles(OrgRole.ORG_ADMIN)
  update(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: UpdateOrgDto,
  ) {
    return this.orgsService.update(orgId, dto);
  }

  @Post(':orgId/suspend')
  @HttpCode(HttpStatus.OK)
  @Roles(GlobalRole.SUPERADMIN)
  suspend(@Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.orgsService.suspend(orgId);
  }

  @Post(':orgId/activate')
  @HttpCode(HttpStatus.OK)
  @Roles(GlobalRole.SUPERADMIN)
  activate(@Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.orgsService.activate(orgId);
  }

  @Get(':orgId/members')
  @UseGuards(OrgMemberGuard)
  getMembers(@Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.orgsService.getMembers(orgId);
  }

  @Post(':orgId/members/invite')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OrgMemberGuard)
  @OrgRoles(OrgRole.ORG_ADMIN)
  inviteMember(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: InviteMemberDto,
  ) {
    return this.orgsService.inviteMember(orgId, user.sub, dto);
  }

  @Patch(':orgId/members/:userId/role')
  @UseGuards(OrgMemberGuard)
  @OrgRoles(OrgRole.ORG_ADMIN)
  updateMemberRole(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() caller: JwtPayload,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.orgsService.updateMemberRole(orgId, userId, caller.sub, dto);
  }

  @Delete(':orgId/members/:userId')
  @UseGuards(OrgMemberGuard)
  @OrgRoles(OrgRole.ORG_ADMIN)
  @HttpCode(HttpStatus.OK)
  removeMember(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() caller: JwtPayload,
  ) {
    return this.orgsService.removeMember(orgId, userId, caller.sub);
  }

  @Post(':orgId/transfer-owner')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgMemberGuard)
  @OrgRoles(OrgRole.ORG_ADMIN)
  transferOwner(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body('new_owner_id', ParseUUIDPipe) newOwnerId: string,
    @CurrentUser() caller: JwtPayload,
  ) {
    return this.orgsService.transferOwnership(orgId, newOwnerId, caller.sub);
  }

  @Get(':orgId/usage')
  @UseGuards(OrgMemberGuard)
  @OrgRoles(OrgRole.ORG_ADMIN)
  getUsage(@Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.orgsService.getUsageSummary(orgId);
  }
}