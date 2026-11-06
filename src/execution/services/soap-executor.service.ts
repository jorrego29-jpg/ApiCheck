// src/execution/services/soap-executor.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService, insecureAgent } from '../http.service';
import * as soap from 'soap';
import { firstValueFrom } from 'rxjs';
import { SOAP_12_ENVELOPE_NS } from './wsdl-parser.service';

@Injectable()
export class SoapExecutorService {
  constructor(private readonly httpService: HttpService) {}

  // Modo 1: Consumir vía WSDL dinámico
  async executeFromWsdl(
    wsdlUrl: string,
    methodName: string,
    args: Record<string, any>,
    ignoreSsl = false,
  ) {
    const startTime = Date.now();
    // `wsdl_options` cubre la descarga del WSDL (y sus imports); el segundo argumento, la llamada a la operación.
    const tls = ignoreSsl ? { httpsAgent: insecureAgent } : {};
    try {
      // disableCache: node-soap guarda cada WSDL por URL hasta reiniciar; sin esto un WSDL descargado con
      // ignoreSsl se serviría después aunque la petición no lo pida, y un WSDL editado no se recargaría.
      const client = await soap.createClientAsync(wsdlUrl, { wsdl_options: tls, disableCache: true });

      if (typeof client[`${methodName}Async`] !== 'function') {
        throw new Error(`El método ${methodName} no existe en el WSDL.`);
      }

      const [result] = await client[`${methodName}Async`](args, tls);
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
  async executeRawEnvelope(
    endpointUrl: string,
    xmlEnvelope: string,
    soapAction?: string,
    customHeaders: Record<string, string> = {},
    ignoreSsl = false,
  ) {
    const startTime = Date.now();
    const headers = this.buildHeaders(xmlEnvelope, soapAction, customHeaders);

    try {
      const response = await firstValueFrom(
        this.httpService.post(endpointUrl, xmlEnvelope, {
          headers,
          httpsAgent: ignoreSsl ? insecureAgent : undefined,
          // El XML se devuelve tal cual: sin intentar leerlo como JSON.
          responseType: 'text',
          transformResponse: (data) => data,
          validateStatus: () => true,
        }),
      );

      const durationMs = Date.now() - startTime;

      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data, // XML devuelto
        requestHeaders: headers,
        metrics: {
          timeMs: durationMs,
          sizeBytes: Buffer.byteLength(String(response.data || ''), 'utf8'),
        },
      };
    } catch (error) {
      return {
        error: true,
        message: error?.message ?? String(error),
        requestHeaders: headers,
        metrics: { timeMs: Date.now() - startTime, sizeBytes: 0 },
      };
    }
  }

  /**
   * SOAP 1.1 va como text/xml con la cabecera SOAPAction; SOAP 1.2 como application/soap+xml con la
   * acción dentro del Content-Type. Lo que el usuario escribió a mano en Headers manda sobre eso.
   */
  buildHeaders(
    xmlEnvelope: string,
    soapAction?: string,
    customHeaders: Record<string, string> = {},
  ): Record<string, string> {
    const action = (soapAction ?? '').trim().replace(/^"(.*)"$/, '$1');
    const headers: Record<string, string> = xmlEnvelope.includes(SOAP_12_ENVELOPE_NS)
      ? {
          'Content-Type': `application/soap+xml;charset=UTF-8${action ? `;action="${action}"` : ''}`,
        }
      : { 'Content-Type': 'text/xml;charset=UTF-8', SOAPAction: `"${action}"` };

    for (const [name, value] of Object.entries(customHeaders)) {
      for (const existing of Object.keys(headers)) {
        if (existing.toLowerCase() === name.toLowerCase()) delete headers[existing];
      }
      headers[name] = value;
    }
    return headers;
  }
}
