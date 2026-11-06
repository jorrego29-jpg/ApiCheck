// src/execution/services/wsdl-parser.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import * as soap from 'soap';
import { insecureAgent } from '../http.service';

export type SoapVersion = '1.1' | '1.2';

export interface SoapMethodDescription {
  name: string;
  inputParams: Record<string, any>;
}

/** Una operación lista para usarse: dónde se envía, con qué SOAPAction y un envelope de ejemplo. */
export interface SoapOperation {
  name: string;
  service: string;
  port: string;
  endpoint: string;
  soapAction: string;
  soapVersion: SoapVersion;
  targetNamespace: string;
  sampleEnvelope: string;
}

export const SOAP_11_ENVELOPE_NS = 'http://schemas.xmlsoap.org/soap/envelope/';
export const SOAP_12_ENVELOPE_NS = 'http://www.w3.org/2003/05/soap-envelope';

// Claves que node-soap añade a la descripción y que no son elementos del mensaje.
const META_KEYS = new Set(['targetNSAlias', 'targetNamespace']);
const XML_NAME = /^[A-Za-z_][\w.-]*$/;

const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

@Injectable()
export class WsdlParserService {
  /**
   * Lee un WSDL desde una URL y extrae los servicios, puertos y métodos disponibles.
   */
  async inspectWsdl(wsdlUrl: string, ignoreSsl = false) {
    try {
      const client = await soap.createClientAsync(wsdlUrl, {
        wsdl_options: ignoreSsl ? { httpsAgent: insecureAgent } : {},
        disableCache: true, // ver soap-executor.service.ts
      });
      const description = client.describe();
      const wsdl = (client as any).wsdl;
      const definitions = wsdl?.definitions ?? {};
      const wsdlTargetNamespace: string = definitions.$targetNamespace ?? definitions.targetNamespace ?? '';

      const methods: SoapMethodDescription[] = [];
      const operations: SoapOperation[] = [];

      // La estructura devuelta por client.describe() es: { ServiceName: { PortName: { MethodName: { input: ... } } } }
      for (const serviceName of Object.keys(description)) {
        for (const portName of Object.keys(description[serviceName])) {
          const portMethods = description[serviceName][portName];
          const port = definitions.services?.[serviceName]?.ports?.[portName];
          const soapVersion = this.detectSoapVersion(portName, port?.binding?.$name, wsdl?.xml);

          for (const methodName of Object.keys(portMethods)) {
            const inputParams = portMethods[methodName]?.input || {};
            methods.push({ name: methodName, inputParams });

            const targetNamespace: string = inputParams.targetNamespace || wsdlTargetNamespace;
            operations.push({
              name: methodName,
              service: serviceName,
              port: portName,
              endpoint: port?.location ?? '',
              soapAction: port?.binding?.methods?.[methodName]?.soapAction ?? '',
              soapVersion,
              targetNamespace,
              sampleEnvelope: this.generateSampleEnvelope(
                methodName,
                targetNamespace,
                inputParams,
                soapVersion,
              ),
            });
          }
        }
      }

      return {
        wsdlUrl,
        services: Object.keys(description),
        methods,
        operations,
      };
    } catch (error) {
      throw new BadRequestException(
        `No se pudo analizar el WSDL desde la URL provista: ${error.message}`,
      );
    }
  }

  /** Los WSDL de .NET publican el mismo servicio en dos puertos: "XSoap" (1.1) y "XSoap12" (1.2). */
  detectSoapVersion(portName: string, bindingName?: string, wsdlXml?: string): SoapVersion {
    if (/soap12|12$/i.test(portName) || /soap12/i.test(bindingName ?? '')) return '1.2';
    if (wsdlXml && /wsdl\/soap12\//.test(wsdlXml) && !/wsdl\/soap\//.test(wsdlXml)) return '1.2';
    return '1.1';
  }

  /**
   * Genera un Envelope XML de ejemplo basado en el nombre de la operación y el namespace target.
   * Cada valor queda como `?` para rellenarlo a mano (o con una {{variable}}).
   */
  generateSampleEnvelope(
    methodName: string,
    targetNamespace: string,
    params: Record<string, any>,
    soapVersion: SoapVersion = '1.1',
  ): string {
    const envelopeNs = soapVersion === '1.2' ? SOAP_12_ENVELOPE_NS : SOAP_11_ENVELOPE_NS;
    const body = this.renderParams(params, '      ');
    const namespace = targetNamespace ? ` xmlns="${escapeAttribute(targetNamespace)}"` : '';
    const operation = body
      ? `    <${methodName}${namespace}>\n${body}\n    </${methodName}>`
      : `    <${methodName}${namespace}/>`;

    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="${envelopeNs}">
  <soap:Header/>
  <soap:Body>
${operation}
  </soap:Body>
</soap:Envelope>`;
  }

  private renderParams(params: Record<string, any> | undefined, indent: string): string {
    const lines: string[] = [];
    for (const [rawKey, type] of Object.entries(params ?? {})) {
      if (META_KEYS.has(rawKey)) continue;
      // "items[]" es una lista y "nota?" un elemento opcional: en el XML es solo el nombre.
      const name = rawKey.replace(/[?[\]]/g, '');
      if (!XML_NAME.test(name)) continue;

      if (type && typeof type === 'object') {
        const inner = this.renderParams(type, indent + '  ');
        lines.push(inner ? `${indent}<${name}>\n${inner}\n${indent}</${name}>` : `${indent}<${name}/>`);
      } else {
        lines.push(`${indent}<${name}>?</${name}>`);
      }
    }
    return lines.join('\n');
  }
}
