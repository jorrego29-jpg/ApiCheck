// src/collections/collections.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto, CreateFolderDto, CreateRequestDto } from './dto/create-collection.dto';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
  createCollection(@Body() dto: CreateCollectionDto) {
    return this.collectionsService.createCollection(dto);
  }

  @Get()
  findAllByWorkspace(@Query('workspaceId') workspaceId: string) {
    return this.collectionsService.findAllByWorkspace(workspaceId);
  }

  @Get(':id/tree')
  getTree(@Param('id') id: string) {
    return this.collectionsService.getCollectionTree(id);
  }

  @Post('folders')
  createFolder(@Body() dto: CreateFolderDto) {
    return this.collectionsService.createFolder(dto);
  }

  @Post('requests')
  createRequest(@Body() dto: CreateRequestDto) {
    return this.collectionsService.createRequest(dto);
  }

  @Get('requests/:id')
  findRequest(@Param('id') id: string) {
    return this.collectionsService.findRequestById(id);
  }

  @Put('requests/:id')
  updateRequest(@Param('id') id: string, @Body() dto: Partial<CreateRequestDto>) {
    return this.collectionsService.updateRequest(id, dto);
  }

  @Delete('requests/:id')
  deleteRequest(@Param('id') id: string) {
    return this.collectionsService.deleteRequest(id);
  }
}