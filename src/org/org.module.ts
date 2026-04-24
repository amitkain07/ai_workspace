import { Module } from '@nestjs/common';
import { OrganizationsService } from './org.service.js';
import { OrganizationsController } from './org.controller.js';
import { PrismaModule } from 'database/prisma/prisma.moudle.js';
import { OrgMemberGuard } from '../common/guards/org-member.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrgMemberGuard, RolesGuard],
  exports: [OrganizationsService],
})
export class OrgModule {}