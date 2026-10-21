// src/execution/services/execution.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { RestExecutorService } from './rest-executor.service';
import { SoapExecutorService } from './soap-executor.service';
import { VariableResolverService } from './variable-resolver.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface UnifiedExecutionDto {
  requestId?: string; // Opcional, si la petición ya está guardada en la BD
  protocol: 'REST' | 'SOAP';
  
  // Datos de la petición (pueden venir directos del cliente o cargados desde la BD)
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: any;

  // Datos específicos SOAP
  soapAction?: string;
  wsdlUrl?: string;

  // Variables activas del entorno seleccionado
  variables?: Record<string, string>;
}

@Injectable()
export class ExecutionService {
  constructor(
    private readonly restExecutor: RestExecutorService,
    private readonly soapExecutor: SoapExecutorService,
    private readonly variableResolver: VariableResolverService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: UnifiedExecutionDto) {
    const activeVariables = dto.variables || {};

    // 1. Resolver variables de entorno en URL, Headers, Params y Body
    const resolvedUrl = this.variableResolver.resolveVariables(dto.url, activeVariables);
    const resolvedHeaders = dto.headers
      ? this.variableResolver.resolveObject(dto.headers, activeVariables)
      : {};
    const resolvedParams = dto.queryParams
      ? this.variableResolver.resolveObject(dto.queryParams, activeVariables)
      : {};
    const resolvedBody = dto.body
      ? this.variableResolver.resolveObject(dto.body, activeVariables)
      : null;

    let responseResult: any;

    // 2. Delegar la petición según el protocolo
    if (dto.protocol === 'REST') {
      if (!dto.method) {
        throw new BadRequestException('El método HTTP es obligatorio para peticiones REST.');
      }

      responseResult = await this.restExecutor.execute({
        method: dto.method,
        url: resolvedUrl,
        headers: resolvedHeaders,
        params: resolvedParams,
        body: resolvedBody,
      });
    } else if (dto.protocol === 'SOAP') {
      if (dto.wsdlUrl) {
        const resolvedWsdl = this.variableResolver.resolveVariables(dto.wsdlUrl, activeVariables);
        responseResult = await this.soapExecutor.executeFromWsdl(
          resolvedWsdl,
          dto.soapAction || '',
          resolvedBody,
        );
      } else {
        const resolvedSoapAction = dto.soapAction
          ? this.variableResolver.resolveVariables(dto.soapAction, activeVariables)
          : undefined;

        responseResult = await this.soapExecutor.executeRawEnvelope(
          resolvedUrl,
          typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody),
          resolvedSoapAction,
        );
      }
    } else {
      throw new BadRequestException(`Protocolo no soportado: ${dto.protocol}`);
    }

    // 3. Guardar la ejecución en el historial (Prisma)
    await this.logHistory({
      requestId: dto.requestId,
      executedUrl: resolvedUrl,
      method: dto.method || 'POST',
      status: responseResult.status || 0,
      statusText: responseResult.statusText || (responseResult.error ? 'ERROR' : 'OK'),
      requestHeaders: resolvedHeaders,
      responseHeaders: responseResult.headers || {},
      responseBody: JSON.stringify(responseResult.data || responseResult.message || ''),
      durationMs: responseResult.metrics?.timeMs || 0,
      sizeBytes: responseResult.metrics?.sizeBytes || 0,
    });

    return {
      request: {
        url: resolvedUrl,
        method: dto.method,
        headers: resolvedHeaders,
        params: resolvedParams,
        body: resolvedBody,
      },
      response: responseResult,
    };
  }

  private async logHistory(logData: {
    requestId?: string;
    executedUrl: string;
    method: string;
    status: number;
    statusText: string;
    requestHeaders: any;
    responseHeaders: any;
    responseBody: string;
    durationMs: number;
    sizeBytes: number;
  }) {
    try {
      await this.prisma.historyLog.create({
        data: {
          requestId: logData.requestId || null,
          executedUrl: logData.executedUrl,
          method: logData.method,
          status: logData.status,
          statusText: logData.statusText,
          requestHeaders: logData.requestHeaders,
          responseHeaders: logData.responseHeaders,
          responseBody: logData.responseBody,
          durationMs: logData.durationMs,
          sizeBytes: logData.sizeBytes,
        },
      });
    } catch (error) {
      console.error('Error al registrar el historial de ejecución:', error);
    }
  }
}