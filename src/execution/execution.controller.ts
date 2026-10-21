// src/execution/execution.controller.ts
import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ExecutionService } from './services/execution.service';
import type { UnifiedExecutionDto } from './services/execution.service';
import { WsdlParserService } from './services/wsdl-parser.service';

@Controller('execution')
export class ExecutionController {
  constructor(
    private readonly executionService: ExecutionService,
    private readonly wsdlParserService: WsdlParserService,
  ) {}

  @Post('run')
  async runRequest(@Body() dto: UnifiedExecutionDto) {
    return await this.executionService.execute(dto);
  }

  @Get('soap/inspect-wsdl')
  async inspectWsdl(@Query('url') wsdlUrl: string) {
    return await this.wsdlParserService.inspectWsdl(wsdlUrl);
  }
}