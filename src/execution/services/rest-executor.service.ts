// src/execution/services/rest-executor.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService, insecureAgent } from '../http.service';
import { firstValueFrom } from 'rxjs';

export interface RestRequestDto {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: any;
  /** Si viene, se envía como multipart/form-data en lugar de `body`. */
  formData?: FormDataField[];
  ignoreSsl?: boolean;
}

/** Con `fileName` es un archivo y `value` su contenido en base64; sin él, un campo de texto. */
export interface FormDataField {
  key: string;
  value: string;
  fileName?: string;
  contentType?: string;
}

@Injectable()
export class RestExecutorService {
  constructor(private readonly httpService: HttpService) {}

  async execute(dto: RestRequestDto) {
    const startTime = Date.now();
    let headers = dto.headers;
    let data: unknown = dto.body;
    let requestHeaders: Record<string, string> | undefined;

    if (dto.formData) {
      const form = new FormData();
      for (const field of dto.formData) {
        if (field.fileName === undefined) {
          form.append(field.key, field.value);
        } else {
          const bytes = new Uint8Array(Buffer.from(field.value, 'base64'));
          const type = field.contentType || 'application/octet-stream';
          form.append(field.key, new Blob([bytes], { type }), field.fileName);
        }
      }
      data = form;
      // axios pone el Content-Type con su boundary: uno escrito a mano (sin boundary) rompería el envío.
      headers = Object.fromEntries(
        Object.entries(dto.headers ?? {}).filter(([name]) => name.toLowerCase() !== 'content-type'),
      );
      requestHeaders = { ...headers, 'Content-Type': 'multipart/form-data' };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method: dto.method,
          url: dto.url,
          headers,
          params: dto.params,
          data,
          httpsAgent: dto.ignoreSsl ? insecureAgent : undefined,
          validateStatus: () => true, // Evita que Axios lance excepción en estados != 2xx
        }),
      );

      const durationMs = Date.now() - startTime;
      const dataString = typeof response.data === 'object' 
        ? JSON.stringify(response.data) 
        : String(response.data || '');

      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        ...(requestHeaders ? { requestHeaders } : {}),
        metrics: {
          timeMs: durationMs,
          sizeBytes: Buffer.byteLength(dataString, 'utf8'),
        },
      };
    } catch (error) {
      return {
        error: true,
        message: error.message,
        ...(requestHeaders ? { requestHeaders } : {}),
        metrics: { timeMs: Date.now() - startTime, sizeBytes: 0 },
      };
    }
  }
}