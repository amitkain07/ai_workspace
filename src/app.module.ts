import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseMongooseModule } from 'database/mongoose/mongoose.module';
import { PrismaModule } from 'database/prisma/prisma.moudle';
import { AuthModule } from './auth/auth.module';
import { OrgModule } from './org/org.module';
import { WorkspacesModule } from './workspace/workspace.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    DatabaseMongooseModule,
    PrismaModule,
    AuthModule,
    OrgModule,
    WorkspacesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}