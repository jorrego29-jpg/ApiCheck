// src/execution/dto/execute-request.dto.ts
import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export const EXECUTION_PROTOCOLS = ['REST', 'SOAP'] as const;
export const EXECUTION_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

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
