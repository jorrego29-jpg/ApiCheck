// src/environments/environments.controller.ts
import { Controller, Get, Post, Put, Body, Param, Delete, Query } from '@nestjs/common';
import { EnvironmentsService } from './environments.service';
import {
  CreateEnvironmentDto,
  CreateVariableDto,
  UpdateEnvironmentDto,
  UpdateVariableDto,
} from './dto/create-environment.dto';

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

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEnvironmentDto) {
    return this.environmentsService.update(id, dto);
  }

  @Put('variables/:id')
  updateVariable(@Param('id') id: string, @Body() dto: UpdateVariableDto) {
    return this.environmentsService.updateVariable(id, dto);
  }

  @Delete('variables/:id')
  removeVariable(@Param('id') id: string) {
    return this.environmentsService.removeVariable(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.environmentsService.remove(id);
  }
}