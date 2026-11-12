import { createServer, IncomingHttpHeaders, Server } from 'node:http';
import { AddressInfo } from 'node:net';

import { HttpService } from '../http.service';
import { RestExecutorService } from './rest-executor.service';

// Contra un servidor HTTP real: lo que se comprueba es lo que axios pone de verdad en el cable.
describe('RestExecutorService (form-data)', () => {
  const service = new RestExecutorService(new HttpService());
  let server: Server;
  let url: string;
  let received: { headers: IncomingHttpHeaders; body: Buffer };

  beforeAll(async () => {
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        received = { headers: req.headers, body: Buffer.concat(chunks) };
        res.setHeader('content-type', 'application/json');
        res.end('{"ok":true}');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/upload`;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it('sends text fields and files as multipart, with the boundary set by axios', async () => {
    const file = Buffer.from([0, 255, 1, 254, 13, 10]);

    const result = await service.execute({
      method: 'POST',
      url,
      // Un Content-Type escrito a mano no trae boundary: no debe salir.
      headers: { 'content-type': 'multipart/form-data', 'X-Test': '1' },
      formData: [
        { key: 'nombre', value: 'José' },
        { key: 'tag', value: 'a' },
        { key: 'tag', value: 'b' },
        { key: 'doc', value: file.toString('base64'), fileName: 'a.bin', contentType: 'application/pdf' },
      ],
    });

    expect(result).toMatchObject({
      status: 200,
      data: { ok: true },
      requestHeaders: { 'X-Test': '1', 'Content-Type': 'multipart/form-data' },
    });

    const contentType = received.headers['content-type'] ?? '';
    const boundary = /^multipart\/form-data; boundary=(.+)$/.exec(contentType)?.[1];
    expect(boundary).toBeDefined();
    expect(received.headers['x-test']).toBe('1');

    const body = received.body.toString('latin1');
    expect(body.split(`--${boundary}`)).toHaveLength(6); // 4 partes + preámbulo y cierre
    expect(received.body.toString('utf8')).toContain('name="nombre"\r\n\r\nJosé\r\n');
    expect(body).toContain('name="tag"\r\n\r\na\r\n');
    expect(body).toContain('name="tag"\r\n\r\nb\r\n');
    expect(body).toContain('name="doc"; filename="a.bin"\r\nContent-Type: application/pdf\r\n\r\n');
    expect(received.body.includes(file)).toBe(true);
  });

  it('still sends a plain body when there is no formData', async () => {
    await service.execute({
      method: 'POST',
      url,
      headers: { 'Content-Type': 'application/json' },
      body: '{"a":1}',
    });

    expect(received.headers['content-type']).toBe('application/json');
    expect(received.body.toString()).toBe('{"a":1}');
  });
});
