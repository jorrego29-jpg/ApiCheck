import { Injectable } from '@nestjs/common';
import { Agent } from 'node:https';
import axios, { AxiosRequestConfig } from 'axios';
import { from } from 'rxjs';

// Agente que acepta certificados autofirmados o caducados (p. ej. el de desarrollo de .NET en https://localhost).
// Solo se usa cuando la petición pide `ignoreSsl`.
export const insecureAgent = new Agent({ rejectUnauthorized: false });

// Sustituye a @nestjs/axios: la v12 es solo ESM y el runtime de Vercel (CommonJS) no puede cargarla con require().
// Mismos métodos y mismo retorno (Observable) que HttpService, así los ejecutores y sus pruebas no cambian.
@Injectable()
export class HttpService {
  request(config: AxiosRequestConfig) {
    return from(axios.request(config));
  }

  post(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return from(axios.post(url, data, config));
  }
}
