import { Module } from '@nestjs/common';
import { WorkspacesService } from './workspace.service';
import { WorkspacesController } from './workspace.controller';
import { PrismaModule } from 'database/prisma/prisma.moudle';
import { OrgMemberGuard } from 'src/org/org.member.gurad';
import { WorkspaceMemberGuard } from './workspace.member.guard';
import { RolesGuard } from 'src/common/gurads/role.gurad';

@Module({
  imports: [PrismaModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, OrgMemberGuard, WorkspaceMemberGuard, RolesGuard],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}