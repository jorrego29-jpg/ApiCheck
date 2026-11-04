import { BadRequestException } from '@nestjs/common';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { WsdlParserService } from './wsdl-parser.service';

// Calculadora con el mismo aspecto que publica .NET: un puerto SOAP 1.1 y otro 1.2.
const WSDL = `<?xml version="1.0" encoding="utf-8"?>
<wsdl:definitions xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:soap12="http://schemas.xmlsoap.org/wsdl/soap12/" xmlns:tns="http://tempuri.org/" xmlns:s="http://www.w3.org/2001/XMLSchema" xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" targetNamespace="http://tempuri.org/">
  <wsdl:types>
    <s:schema elementFormDefault="qualified" targetNamespace="http://tempuri.org/">
      <s:element name="Add"><s:complexType><s:sequence>
        <s:element minOccurs="1" maxOccurs="1" name="intA" type="s:int"/>
        <s:element minOccurs="1" maxOccurs="1" name="intB" type="s:int"/>
      </s:sequence></s:complexType></s:element>
      <s:element name="AddResponse"><s:complexType><s:sequence>
        <s:element minOccurs="1" maxOccurs="1" name="AddResult" type="s:int"/>
      </s:sequence></s:complexType></s:element>
    </s:schema>
  </wsdl:types>
  <wsdl:message name="AddSoapIn"><wsdl:part name="parameters" element="tns:Add"/></wsdl:message>
  <wsdl:message name="AddSoapOut"><wsdl:part name="parameters" element="tns:AddResponse"/></wsdl:message>
  <wsdl:portType name="CalculatorSoap">
    <wsdl:operation name="Add"><wsdl:input message="tns:AddSoapIn"/><wsdl:output message="tns:AddSoapOut"/></wsdl:operation>
  </wsdl:portType>
  <wsdl:binding name="CalculatorSoap" type="tns:CalculatorSoap">
    <soap:binding transport="http://schemas.xmlsoap.org/soap/http"/>
    <wsdl:operation name="Add"><soap:operation soapAction="http://tempuri.org/Add" style="document"/>
      <wsdl:input><soap:body use="literal"/></wsdl:input><wsdl:output><soap:body use="literal"/></wsdl:output></wsdl:operation>
  </wsdl:binding>
  <wsdl:binding name="CalculatorSoap12" type="tns:CalculatorSoap">
    <soap12:binding transport="http://schemas.xmlsoap.org/soap/http"/>
    <wsdl:operation name="Add"><soap12:operation soapAction="http://tempuri.org/Add" style="document"/>
      <wsdl:input><soap12:body use="literal"/></wsdl:input><wsdl:output><soap12:body use="literal"/></wsdl:output></wsdl:operation>
  </wsdl:binding>
  <wsdl:service name="Calculator">
    <wsdl:port name="CalculatorSoap" binding="tns:CalculatorSoap"><soap:address location="http://localhost:9/calculator.asmx"/></wsdl:port>
    <wsdl:port name="CalculatorSoap12" binding="tns:CalculatorSoap12"><soap12:address location="http://localhost:9/calculator.asmx"/></wsdl:port>
  </wsdl:service>
</wsdl:definitions>`;

describe('WsdlParserService', () => {
  const service = new WsdlParserService();
  let wsdlPath: string;

  beforeAll(() => {
    wsdlPath = join(mkdtempSync(join(tmpdir(), 'wsdl-')), 'calculator.wsdl');
    writeFileSync(wsdlPath, WSDL);
  });

  describe('inspectWsdl', () => {
    it('keeps the services and methods the client already knew', async () => {
      const result = await service.inspectWsdl(wsdlPath);

      expect(result.services).toEqual(['Calculator']);
      expect(result.methods.map((m) => m.name)).toEqual(['Add', 'Add']);
    });

    it('describes each operation with its endpoint, SOAPAction and SOAP version', async () => {
      const { operations } = await service.inspectWsdl(wsdlPath);

      expect(operations).toHaveLength(2);
      expect(operations[0]).toMatchObject({
        name: 'Add',
        service: 'Calculator',
        port: 'CalculatorSoap',
        endpoint: 'http://localhost:9/calculator.asmx',
        soapAction: 'http://tempuri.org/Add',
        soapVersion: '1.1',
        targetNamespace: 'http://tempuri.org/',
      });
      expect(operations[1]).toMatchObject({ port: 'CalculatorSoap12', soapVersion: '1.2' });
    });

    it('generates a sample envelope per operation', async () => {
      const { operations } = await service.inspectWsdl(wsdlPath);

      expect(operations[0].sampleEnvelope).toContain('xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"');
      expect(operations[0].sampleEnvelope).toContain('<Add xmlns="http://tempuri.org/">');
      expect(operations[0].sampleEnvelope).toContain('<intA>?</intA>');
      expect(operations[0].sampleEnvelope).toContain('<intB>?</intB>');
      expect(operations[1].sampleEnvelope).toContain('http://www.w3.org/2003/05/soap-envelope');
    });

    it('rejects a WSDL that cannot be read', async () => {
      await expect(service.inspectWsdl(join(tmpdir(), 'no-existe.wsdl'))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('generateSampleEnvelope', () => {
    it('nests complex types and drops the markers node-soap adds', () => {
      const xml = service.generateSampleEnvelope('Create', 'urn:demo', {
        targetNSAlias: 'tns',
        targetNamespace: 'urn:demo',
        'name?': 'xsd:string',
        'tags[]': 'xsd:string',
        person: { age: 'xsd:int', address: { city: 'xsd:string' } },
      });

      expect(xml).toContain('<Create xmlns="urn:demo">');
      expect(xml).toContain('<name>?</name>');
      expect(xml).toContain('<tags>?</tags>');
      expect(xml).toContain('<person>');
      expect(xml).toContain('<city>?</city>');
      expect(xml).not.toContain('targetNSAlias');
    });

    it('leaves an empty operation self-closed and tolerates a missing namespace', () => {
      const xml = service.generateSampleEnvelope('Ping', '', {});

      expect(xml).toContain('<Ping/>');
    });

    it('ignores names that would break the XML', () => {
      const xml = service.generateSampleEnvelope('Op', 'urn:x', { 'a b': 'xsd:string', ok: 'xsd:string' });

      expect(xml).not.toContain('a b');
      expect(xml).toContain('<ok>?</ok>');
    });
  });

  describe('detectSoapVersion', () => {
    it('reads the version from the port or binding name', () => {
      expect(service.detectSoapVersion('CalculatorSoap')).toBe('1.1');
      expect(service.detectSoapVersion('CalculatorSoap12')).toBe('1.2');
      expect(service.detectSoapVersion('Port', 'MySoap12Binding')).toBe('1.2');
    });

    it('treats a WSDL that only speaks SOAP 1.2 as 1.2', () => {
      expect(service.detectSoapVersion('Port', 'B', 'xmlns:s="http://schemas.xmlsoap.org/wsdl/soap12/"')).toBe('1.2');
    });
  });
});
