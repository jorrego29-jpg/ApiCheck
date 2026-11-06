import { of, throwError } from 'rxjs';

import { SoapExecutorService } from './soap-executor.service';

const ENVELOPE_11 = '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"/>';
const ENVELOPE_12 = '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"/>';

describe('SoapExecutorService', () => {
  const post = jest.fn();
  const service = new SoapExecutorService({ post } as never);

  beforeEach(() => post.mockReset());

  describe('buildHeaders', () => {
    it('sends SOAP 1.1 as text/xml with a quoted SOAPAction', () => {
      expect(service.buildHeaders(ENVELOPE_11, 'urn:Add')).toEqual({
        'Content-Type': 'text/xml;charset=UTF-8',
        SOAPAction: '"urn:Add"',
      });
    });

    it('does not quote a SOAPAction twice, and sends an empty one when there is none', () => {
      expect(service.buildHeaders(ENVELOPE_11, '"urn:Add"').SOAPAction).toBe('"urn:Add"');
      expect(service.buildHeaders(ENVELOPE_11).SOAPAction).toBe('""');
    });

    it('sends SOAP 1.2 as application/soap+xml with the action inside the Content-Type', () => {
      expect(service.buildHeaders(ENVELOPE_12, 'urn:Add')).toEqual({
        'Content-Type': 'application/soap+xml;charset=UTF-8;action="urn:Add"',
      });
      expect(service.buildHeaders(ENVELOPE_12)['Content-Type']).toBe(
        'application/soap+xml;charset=UTF-8',
      );
    });

    it('lets the headers written by hand win, whatever their case', () => {
      const headers = service.buildHeaders(ENVELOPE_11, 'urn:Add', {
        'content-type': 'text/xml; charset=utf-16',
        Authorization: 'Bearer t',
      });

      expect(headers).toEqual({
        SOAPAction: '"urn:Add"',
        'content-type': 'text/xml; charset=utf-16',
        Authorization: 'Bearer t',
      });
    });
  });

  describe('executeRawEnvelope', () => {
    it('returns the XML untouched along with the headers that were sent', async () => {
      post.mockReturnValue(
        of({ status: 200, statusText: 'OK', headers: { 'content-type': 'text/xml' }, data: '<ok/>' }),
      );

      const result = await service.executeRawEnvelope('http://x/svc', ENVELOPE_11, 'urn:Add');

      expect(post).toHaveBeenCalledWith(
        'http://x/svc',
        ENVELOPE_11,
        expect.objectContaining({ responseType: 'text' }),
      );
      expect(result).toMatchObject({
        status: 200,
        data: '<ok/>',
        requestHeaders: { SOAPAction: '"urn:Add"' },
      });
    });

    it('does not turn an HTTP 500 (a SOAP Fault) into an error', async () => {
      post.mockReturnValue(of({ status: 500, statusText: 'Server Error', headers: {}, data: '<Fault/>' }));

      const result = await service.executeRawEnvelope('http://x/svc', ENVELOPE_11);

      expect(result).toMatchObject({ status: 500, data: '<Fault/>' });
      expect(result).not.toHaveProperty('error');
    });

    it('only skips TLS verification when ignoreSsl is asked for', async () => {
      post.mockReturnValue(of({ status: 200, statusText: 'OK', headers: {}, data: '<ok/>' }));

      await service.executeRawEnvelope('https://x/svc', ENVELOPE_11);
      await service.executeRawEnvelope('https://x/svc', ENVELOPE_11, undefined, {}, true);

      expect(post.mock.calls[0][2].httpsAgent).toBeUndefined();
      expect(post.mock.calls[1][2].httpsAgent.options.rejectUnauthorized).toBe(false);
    });

    it('reports a network failure like the REST executor does', async () => {
      post.mockReturnValue(throwError(() => new Error('getaddrinfo ENOTFOUND nope.test')));

      const result = await service.executeRawEnvelope('http://nope.test', ENVELOPE_11);

      expect(result).toMatchObject({ error: true, message: 'getaddrinfo ENOTFOUND nope.test' });
    });
  });
});
