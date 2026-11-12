// src/execution/dto/execute-request.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export const EXECUTION_PROTOCOLS = ['REST', 'SOAP'] as const;
export const EXECUTION_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

/** Un campo de multipart/form-data. Con `fileName` es un archivo y `value` trae su contenido en base64. */
export class FormDataFieldDto {
  @IsString()
  key: string;

  @IsString()
  value: string;

  @IsString()
  @IsOptional()
  fileName?: string;

  @IsString()
  @IsOptional()
  contentType?: string;
}

export class ExecuteRequestDto {
  @IsString()
  @IsOptional()
  requestId?: string; // Opcional, si la petición ya está guardada en la BD

  @IsIn(EXECUTION_PROTOCOLS)
  protocol: 'REST' | 'SOAP';

  @IsString()
  url: string;

  @IsIn(EXECUTION_METHODS)
  @IsOptional()
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @IsObject()
  @IsOptional()
  queryParams?: Record<string, string>;

  // JSON, XML (string) u otro contenido: se valida solo que sea opcional.
  @IsOptional()
  body?: any;

  // Solo REST: si viene, la petición sale como multipart/form-data y `body` se ignora.
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormDataFieldDto)
  @IsOptional()
  formData?: FormDataFieldDto[];

  // Datos específicos SOAP
  @IsString()
  @IsOptional()
  soapAction?: string;

  @IsString()
  @IsOptional()
  wsdlUrl?: string;

  // No verificar el certificado TLS del destino (certificados autofirmados de desarrollo)
  @IsBoolean()
  @IsOptional()
  ignoreSsl?: boolean;

  // Variables activas del entorno seleccionado
  @IsObject()
  @IsOptional()
  variables?: Record<string, string>;

  @IsString()
  @IsOptional()
  environmentId?: string;

  @IsString()
  @IsOptional()
  workspaceId?: string;
}
