// src/history/history.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { HistoryService } from './history.service';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  findAll(
    @Query('requestId') requestId?: string,
    @Query('limit') limit?: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.historyService.findAll(requestId, limit ? Number(limit) : undefined, workspaceId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.historyService.findOne(id);
  }
}
