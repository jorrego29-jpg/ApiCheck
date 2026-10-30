// src/execution/services/soap-executor.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as soap from 'soap';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SoapExecutorService {
  constructor(private readonly httpService: HttpService) {}

  // Modo 1: Consumir vía WSDL dinámico
  async executeFromWsdl(wsdlUrl: string, methodName: string, args: Record<string, any>) {
    const startTime = Date.now();
    try {
      const client = await soap.createClientAsync(wsdlUrl);

      if (typeof client[`${methodName}Async`] !== 'function') {
        throw new Error(`El método ${methodName} no existe en el WSDL.`);
      }

      const [result] = await client[`${methodName}Async`](args);
      const durationMs = Date.now() - startTime;
      const dataString = JSON.stringify(result ?? '');

      return {
        status: 200,
        statusText: 'OK',
        data: result,
        rawRequest: client.lastRequest,
        rawResponse: client.lastResponse,
        metrics: {
          timeMs: durationMs,
          sizeBytes: Buffer.byteLength(dataString, 'utf8'),
        },
      };
    } catch (error) {
      // Misma forma de error que el ejecutor REST: la UI distingue `error: true`.
      return {
        error: true,
        message: error?.message ?? String(error),
        metrics: { timeMs: Date.now() - startTime, sizeBytes: 0 },
      };
    }
  }

  // Modo 2: Envío de XML Envelope directo
  async executeRawEnvelope(endpointUrl: string, xmlEnvelope: string, soapAction?: string) {
    const startTime = Date.now();
    const headers: Record<string, string> = {
      'Content-Type': 'text/xml;charset=UTF-8',
    };
    if (soapAction) {
      headers['SOAPAction'] = `"${soapAction}"`;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(endpointUrl, xmlEnvelope, {
          headers,
          validateStatus: () => true,
        }),
      );

      const durationMs = Date.now() - startTime;

      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data, // XML devuelto
        metrics: {
          timeMs: durationMs,
          sizeBytes: Buffer.byteLength(String(response.data || ''), 'utf8'),
        },
      };
    } catch (error) {
      return {
        error: true,
        message: error?.message ?? String(error),
        metrics: { timeMs: Date.now() - startTime, sizeBytes: 0 },
      };
    }
  }
}
