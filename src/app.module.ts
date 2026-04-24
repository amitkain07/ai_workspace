import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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