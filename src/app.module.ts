import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseMongooseModule } from 'database/mongoose/mongoose.module';
import { PrismaModule } from 'database/prisma/prisma.moudle';

@Module({
  imports: [DatabaseMongooseModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}