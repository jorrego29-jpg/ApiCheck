// src/collections/dto/create-collection.dto.ts
import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ProtocolType, HttpMethod } from '@prisma/client';

/**
 * headers y queryParams se guardan como arreglo [{ key, value, enabled }] (formato del schema),
 * pero se acepta también un objeto plano para no romper clientes existentes.
 */
@ValidatorConstraint({ name: 'isKeyValueList', async: false })
export class IsKeyValueListConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return Array.isArray(value) || (typeof value === 'object' && value !== null);
  }
  defaultMessage(): string {
    return '$property debe ser un arreglo de { key, value, enabled } o un objeto';
  }
}

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

  @Validate(IsKeyValueListConstraint)
  @IsOptional()
  headers?: any;

  @Validate(IsKeyValueListConstraint)
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

export class UpdateCollectionDto {
  @IsString()
  @IsOptional()
  name?: string;
}

export class UpdateFolderDto {
  @IsString()
  @IsOptional()
  name?: string;

  // null = mover a la raíz de la colección; omitido = sin cambios
  @IsString()
  @IsOptional()
  parentId?: string | null;
}

export class UpdateRequestDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(ProtocolType)
  @IsOptional()
  protocol?: ProtocolType;

  @IsEnum(HttpMethod)
  @IsOptional()
  method?: HttpMethod | null;

  @IsString()
  @IsOptional()
  url?: string;

  @Validate(IsKeyValueListConstraint)
  @IsOptional()
  headers?: any;

  @Validate(IsKeyValueListConstraint)
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
  soapAction?: string | null;

  @IsString()
  @IsOptional()
  wsdlUrl?: string | null;

  @IsString()
  @IsOptional()
  collectionId?: string;

  // null = mover a la raíz de la colección; omitido = sin cambios
  @IsString()
  @IsOptional()
  folderId?: string | null;
}
