import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseMongooseModule } from 'database/mongoose/mongoose.module.js';
import { PrismaModule } from 'database/prisma/prisma.moudle.js';
import { AuthModule } from './auth/auth.module.js';
import { OrgModule } from './org/org.module.js';
import { WorkspacesModule } from './workspace/workspace.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseMongooseModule,
    PrismaModule,
    AuthModule,
    OrgModule,
    WorkspacesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}