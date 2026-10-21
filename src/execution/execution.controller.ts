// src/execution/execution.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { ExecutionService } from './services/execution.service';
import type { UnifiedExecutionDto } from './services/execution.service';

@Controller('execution')
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Post('run')
  async runRequest(@Body() dto: UnifiedExecutionDto) {
    return await this.executionService.execute(dto);
  }
}