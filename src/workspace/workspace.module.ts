import { Module } from '@nestjs/common';
import { WorkspacesService } from './workspace.service.js';
import { WorkspacesController } from './workspace.controller.js';
import { PrismaModule } from 'database/prisma/prisma.moudle.js';
import { OrgMemberGuard } from 'src/org/org.member.gurad.js';
import { WorkspaceMemberGuard } from './workspace.member.guard.js';
import { RolesGuard } from 'src/common/gurads/role.gurad.js';

@Module({
  imports: [PrismaModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, OrgMemberGuard, WorkspaceMemberGuard, RolesGuard],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}