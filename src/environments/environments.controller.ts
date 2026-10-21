// src/environments/environments.controller.ts
import { Controller, Get, Post, Body, Param, Delete, Query } from '@nestjs/common';
import { EnvironmentsService } from './environments.service';
import { CreateEnvironmentDto, CreateVariableDto } from './dto/create-environment.dto';

@Controller('environments')
export class EnvironmentsController {
  constructor(private readonly environmentsService: EnvironmentsService) {}

  @Post()
  create(@Body() dto: CreateEnvironmentDto) {
    return this.environmentsService.create(dto);
  }

  @Get()
  findAll(@Query('workspaceId') workspaceId: string) {
    return this.environmentsService.findAllByWorkspace(workspaceId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.environmentsService.findOne(id);
  }

  @Post(':id/variables')
  addVariable(@Param('id') environmentId: string, @Body() dto: CreateVariableDto) {
    return this.environmentsService.addVariable(environmentId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.environmentsService.remove(id);
  }
}