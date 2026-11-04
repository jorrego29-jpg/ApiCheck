// src/collections/collections.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import {
  CreateCollectionDto,
  CreateFolderDto,
  CreateRequestDto,
  UpdateCollectionDto,
  UpdateFolderDto,
  UpdateRequestDto,
} from './dto/create-collection.dto';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  // --- Colecciones ---
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

  @Put(':id')
  updateCollection(@Param('id') id: string, @Body() dto: UpdateCollectionDto) {
    return this.collectionsService.updateCollection(id, dto);
  }

  @Delete(':id')
  deleteCollection(@Param('id') id: string) {
    return this.collectionsService.deleteCollection(id);
  }

  // --- Carpetas ---
  @Post('folders')
  createFolder(@Body() dto: CreateFolderDto) {
    return this.collectionsService.createFolder(dto);
  }

  @Put('folders/:id')
  updateFolder(@Param('id') id: string, @Body() dto: UpdateFolderDto) {
    return this.collectionsService.updateFolder(id, dto);
  }

  @Delete('folders/:id')
  deleteFolder(@Param('id') id: string) {
    return this.collectionsService.deleteFolder(id);
  }

  // --- Peticiones ---
  @Post('requests')
  createRequest(@Body() dto: CreateRequestDto) {
    return this.collectionsService.createRequest(dto);
  }

  @Get('requests/:id')
  findRequest(@Param('id') id: string) {
    return this.collectionsService.findRequestById(id);
  }

  @Put('requests/:id')
  updateRequest(@Param('id') id: string, @Body() dto: UpdateRequestDto) {
    return this.collectionsService.updateRequest(id, dto);
  }

  @Delete('requests/:id')
  deleteRequest(@Param('id') id: string) {
    return this.collectionsService.deleteRequest(id);
  }
}
