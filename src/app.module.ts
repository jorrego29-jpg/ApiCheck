import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ExecutionModule } from './execution/execution.module';
import { EnvironmentsModule } from './environments/environments.module';
import { CollectionsModule } from './collections/collections.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [PrismaModule, ExecutionModule, EnvironmentsModule, CollectionsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
