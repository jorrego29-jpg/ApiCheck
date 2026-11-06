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
  ignoreSsl?: boolean;
}

@Injectable()
export class RestExecutorService {
  constructor(private readonly httpService: HttpService) {}

  async execute(dto: RestRequestDto) {
    const startTime = Date.now();
    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method: dto.method,
          url: dto.url,
          headers: dto.headers,
          params: dto.params,
          data: dto.body,
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
        metrics: {
          timeMs: durationMs,
          sizeBytes: Buffer.byteLength(dataString, 'utf8'),
        },
      };
    } catch (error) {
      return {
        error: true,
        message: error.message,
        metrics: { timeMs: Date.now() - startTime, sizeBytes: 0 },
      };
    }
  }
}