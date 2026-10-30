import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ExecutionModule } from './execution/execution.module';
import { EnvironmentsModule } from './environments/environments.module';
import { CollectionsModule } from './collections/collections.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { HistoryModule } from './history/history.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    PrismaModule,
    ExecutionModule,
    EnvironmentsModule,
    CollectionsModule,
    WorkspacesModule,
    HistoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
