import { Injectable } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import { from } from 'rxjs';

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
