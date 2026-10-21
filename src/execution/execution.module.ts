// src/execution/execution.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ExecutionController } from './execution.controller';
import { RestExecutorService } from './services/rest-executor.service';
import { SoapExecutorService } from './services/soap-executor.service';
import { VariableResolverService } from './services/variable-resolver.service';
import { ExecutionService } from './services/execution.service';
import { EnvironmentsModule } from '../environments/environments.module';

@Module({
  imports: [HttpModule, EnvironmentsModule],
  controllers: [ExecutionController],
  providers: [
    RestExecutorService,
    SoapExecutorService,
    VariableResolverService,
    ExecutionService,
  ],
  exports: [ExecutionService],
})
export class ExecutionModule {}