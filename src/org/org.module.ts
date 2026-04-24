import { Module } from '@nestjs/common';
import { OrganizationsService } from './org.service';
import { OrganizationsController } from './org.controller';
import { PrismaModule } from 'database/prisma/prisma.moudle';
import { OrgMemberGuard } from './org.member.gurad';
import { RolesGuard } from 'src/common/gurads/role.gurad';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrgMemberGuard, RolesGuard],
  exports: [OrganizationsService],
})
export class OrgModule {}