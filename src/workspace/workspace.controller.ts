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

import { WorkspacesService } from './workspace.service';
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  AddWorkspaceMemberDto,
  UpdateSystemPromptDto,
  UpdateWorkspaceMemberRoleDto,
} from './workspace.dto';
import { JwtAuthGuard } from 'src/auth/jwt.auth.gaurd';
import { OrgMemberGuard } from 'src/org/org.member.gurad';
import { WorkspaceMemberGuard } from './workspace.member.guard';
import { RolesGuard } from 'src/common/gurads/role.gurad';
import { OrgRoles } from 'src/common/decorators/role.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtPayload } from 'src/common/decorators/current-user.decorator';
import { OrgRole } from 'src/common/enum/roles.enum';

@Controller('organizations/:orgId/workspaces')
@UseGuards(JwtAuthGuard, RolesGuard, OrgMemberGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @OrgRoles(OrgRole.ORG_ADMIN)
  create(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.workspacesService.create(orgId, user.sub, dto);
  }

  @Get()
  findAll(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workspacesService.findAll(orgId, user.sub, OrgRole.MEMBER);
  }

  @Get(':workspaceId')
  @UseGuards(WorkspaceMemberGuard)
  findOne(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspacesService.findOne(orgId, workspaceId);
  }

  @Patch(':workspaceId')
  @UseGuards(WorkspaceMemberGuard)
  @OrgRoles(OrgRole.WORKSPACE_ADMIN)
  update(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(orgId, workspaceId, dto);
  }

  @Delete(':workspaceId')
  @HttpCode(HttpStatus.OK)
  @OrgRoles(OrgRole.ORG_ADMIN)
  remove(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspacesService.remove(orgId, workspaceId);
  }

  @Patch(':workspaceId/system-prompt')
  @UseGuards(WorkspaceMemberGuard)
  @OrgRoles(OrgRole.WORKSPACE_ADMIN)
  updateSystemPrompt(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: UpdateSystemPromptDto,
  ) {
    return this.workspacesService.updateSystemPrompt(orgId, workspaceId, dto.system_prompt);
  }

  @Get(':workspaceId/members')
  @UseGuards(WorkspaceMemberGuard)
  getMembers(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspacesService.getMembers(orgId, workspaceId);
  }

  @Post(':workspaceId/members')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(WorkspaceMemberGuard)
  @OrgRoles(OrgRole.WORKSPACE_ADMIN)
  addMember(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: AddWorkspaceMemberDto,
  ) {
    return this.workspacesService.addMember(orgId, workspaceId, dto);
  }

  @Patch(':workspaceId/members/:userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceMemberGuard)
  @OrgRoles(OrgRole.WORKSPACE_ADMIN)
  updateMemberRole(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateWorkspaceMemberRoleDto,
  ) {
    return this.workspacesService.updateMemberRole(orgId, workspaceId, userId, dto.role);
  }

  @Delete(':workspaceId/members/:userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceMemberGuard)
  @OrgRoles(OrgRole.WORKSPACE_ADMIN)
  removeMember(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() caller: JwtPayload,
  ) {
    return this.workspacesService.removeMember(orgId, workspaceId, userId, caller.sub);
  }
}