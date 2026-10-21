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
    const client = await soap.createClientAsync(wsdlUrl);

    if (typeof client[`${methodName}Async`] !== 'function') {
      throw new Error(`El método ${methodName} no existe en el WSDL.`);
    }

    const [result] = await client[`${methodName}Async`](args);
    const durationMs = Date.now() - startTime;

    return {
      data: result,
      rawRequest: client.lastRequest,
      rawResponse: client.lastResponse,
      metrics: { timeMs: durationMs },
    };
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

    const response = await firstValueFrom(
      this.httpService.post(endpointUrl, xmlEnvelope, {
        headers,
        validateStatus: () => true,
      }),
    );

    const durationMs = Date.now() - startTime;

    return {
      status: response.status,
      headers: response.headers,
      data: response.data, // XML devuelto
      metrics: {
        timeMs: durationMs,
        sizeBytes: Buffer.byteLength(String(response.data || ''), 'utf8'),
      },
    };
  }
}