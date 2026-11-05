// src/execution/execution.module.ts
import { Module } from '@nestjs/common';
import { HttpService } from './http.service';
import { ExecutionController } from './execution.controller';
import { RestExecutorService } from './services/rest-executor.service';
import { SoapExecutorService } from './services/soap-executor.service';
import { VariableResolverService } from './services/variable-resolver.service';
import { WsdlParserService } from './services/wsdl-parser.service';
import { ExecutionService } from './services/execution.service';
import { EnvironmentsModule } from '../environments/environments.module';

@Module({
  imports: [EnvironmentsModule],
  controllers: [ExecutionController],
  providers: [
    HttpService,
    RestExecutorService,
    SoapExecutorService,
    VariableResolverService,
    WsdlParserService,
    ExecutionService,
  ],
  exports: [ExecutionService, WsdlParserService],
})
export class ExecutionModule {}