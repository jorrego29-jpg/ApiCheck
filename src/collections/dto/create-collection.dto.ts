// src/collections/dto/create-collection.dto.ts
import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ProtocolType, HttpMethod } from '@prisma/client';

export class CreateCollectionDto {
  @IsString()
  name: string;

  @IsString()
  workspaceId: string;
}

export class CreateFolderDto {
  @IsString()
  name: string;

  @IsString()
  collectionId: string;

  @IsString()
  @IsOptional()
  parentId?: string;
}

export class CreateRequestDto {
  @IsString()
  name: string;

  @IsEnum(ProtocolType)
  protocol: ProtocolType;

  @IsEnum(HttpMethod)
  @IsOptional()
  method?: HttpMethod;

  @IsString()
  url: string;

  @IsObject()
  @IsOptional()
  headers?: any;

  @IsObject()
  @IsOptional()
  queryParams?: any;

  @IsObject()
  @IsOptional()
  body?: any;

  @IsObject()
  @IsOptional()
  auth?: any;

  @IsString()
  @IsOptional()
  soapAction?: string;

  @IsString()
  @IsOptional()
  wsdlUrl?: string;

  @IsString()
  collectionId: string;

  @IsString()
  @IsOptional()
  folderId?: string;
}