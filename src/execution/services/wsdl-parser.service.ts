// src/execution/services/wsdl-parser.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import * as soap from 'soap';

export interface SoapMethodDescription {
  name: string;
  inputParams: Record<string, any>;
}

@Injectable()
export class WsdlParserService {
  /**
   * Lee un WSDL desde una URL y extrae los servicios, puertos y métodos disponibles.
   */
  async inspectWsdl(wsdlUrl: string) {
    try {
      const client = await soap.createClientAsync(wsdlUrl);
      const description = client.describe();

      const methods: SoapMethodDescription[] = [];

      // La estructura devuelta por client.describe() es: { ServiceName: { PortName: { MethodName: { input: ... } } } }
      for (const serviceName of Object.keys(description)) {
        for (const portName of Object.keys(description[serviceName])) {
          const portMethods = description[serviceName][portName];

          for (const methodName of Object.keys(portMethods)) {
            methods.push({
              name: methodName,
              inputParams: portMethods[methodName]?.input || {},
            });
          }
        }
      }

      return {
        wsdlUrl,
        services: Object.keys(description),
        methods,
      };
    } catch (error) {
      throw new BadRequestException(
        `No se pudo analizar el WSDL desde la URL provista: ${error.message}`,
      );
    }
  }

  /**
   * Genera un Envelope XML de ejemplo basado en el nombre de la operación y el namespace target.
   */
  generateSampleEnvelope(methodName: string, targetNamespace: string, params: Record<string, any>): string {
    const paramTags = Object.keys(params)
      .map((key) => `<${key}>${params[key] || `{{${key}}}`}</${key}>`)
      .join('');

    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${methodName} xmlns="${targetNamespace}">
      ${paramTags}
    </${methodName}>
  </soap:Body>
</soap:Envelope>`;
  }
}