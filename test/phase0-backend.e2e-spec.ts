// Pruebas e2e de la fase 0 del backend. Prisma y axios están simulados: no requieren base de datos ni red.
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Prisma } from '@prisma/client';
import { of } from 'rxjs';
import request from 'supertest';
import * as soap from 'soap';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { configureApp } from './../src/app.setup';

// @nestjs/axios v12 es solo ESM y Jest (CommonJS) no puede cargarlo: se sustituye por un módulo equivalente.
jest.mock('@nestjs/axios', () => {
  const { Module } = jest.requireActual('@nestjs/common');
  class HttpService {}
  class HttpModule {}
  Module({ providers: [HttpService], exports: [HttpService] })(HttpModule);
  return { HttpModule, HttpService };
});

jest.mock('soap', () => ({
  createClientAsync: jest.fn().mockRejectedValue(new Error('boom')),
}));

const model = () => ({
  create: jest.fn(),
  findMany: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
});

describe('Backend fase 0 (e2e, Prisma simulado)', () => {
  let app: INestApplication;
  const prisma: any = {
    workspace: model(),
    collection: model(),
    folder: model(),
    request: model(),
    environment: model(),
    variable: model(),
    historyLog: model(),
    $transaction: jest.fn(),
  };
  const http = { request: jest.fn(), post: jest.fn() };

  beforeAll(async () => {
    delete process.env.CORS_ORIGIN;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(HttpService)
      .useValue(http)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((ops: Promise<any>[]) => Promise.all(ops));
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  describe('CORS', () => {
    it('permite el origen de Angular en el preflight', async () => {
      const res = await request(server())
        .options('/collections')
        .set('Origin', 'http://localhost:4200')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    });

    it('no habilita otros orígenes', async () => {
      const res = await request(server())
        .options('/collections')
        .set('Origin', 'http://evil.test')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Workspaces', () => {
    it('POST valida el nombre', async () => {
      await request(server()).post('/workspaces').send({}).expect(400);
      expect(prisma.workspace.create).not.toHaveBeenCalled();
    });

    it('POST crea y GET lista', async () => {
      prisma.workspace.create.mockResolvedValue({ id: 'w1', name: 'Demo' });
      prisma.workspace.findMany.mockResolvedValue([{ id: 'w1', name: 'Demo' }]);
      const created = await request(server()).post('/workspaces').send({ name: 'Demo' }).expect(201);
      expect(created.body.id).toBe('w1');
      const list = await request(server()).get('/workspaces').expect(200);
      expect(list.body).toHaveLength(1);
    });

    it('GET :id responde 404 si no existe', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);
      await request(server()).get('/workspaces/nope').expect(404);
    });
  });

  describe('Colecciones', () => {
    it('GET sin workspaceId responde 400 (no lista todo)', async () => {
      await request(server()).get('/collections').expect(400);
      expect(prisma.collection.findMany).not.toHaveBeenCalled();
    });

    it('el árbol incluye carpetas de 3 niveles', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'C',
        workspaceId: 'w1',
        folders: [
          { id: 'f1', name: 'A', parentId: null, collectionId: 'c1', requests: [] },
          { id: 'f2', name: 'B', parentId: 'f1', collectionId: 'c1', requests: [] },
          { id: 'f3', name: 'C', parentId: 'f2', collectionId: 'c1', requests: [{ id: 'r1' }] },
        ],
        requests: [{ id: 'r0', folderId: null }],
      });
      const res = await request(server()).get('/collections/c1/tree').expect(200);
      expect(res.body.folders).toHaveLength(1);
      expect(res.body.folders[0].children[0].children[0].requests[0].id).toBe('r1');
      expect(res.body.requests[0].id).toBe('r0');
    });

    it('PUT/DELETE de colección', async () => {
      prisma.collection.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.collection.update.mockResolvedValue({ id: 'c1', name: 'Nuevo' });
      prisma.collection.delete.mockResolvedValue({ id: 'c1' });
      await request(server()).put('/collections/c1').send({ name: 'Nuevo' }).expect(200);
      expect(prisma.collection.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { name: 'Nuevo' } });
      await request(server()).delete('/collections/c1').expect(200);
    });

    it('mover una carpeta dentro de su propio descendiente responde 400', async () => {
      const folders: Record<string, any> = {
        f1: { id: 'f1', collectionId: 'c1', parentId: null },
        f2: { id: 'f2', collectionId: 'c1', parentId: 'f1' },
        f3: { id: 'f3', collectionId: 'c1', parentId: 'f2' },
      };
      prisma.folder.findUnique.mockImplementation(({ where }: any) => Promise.resolve(folders[where.id] ?? null));
      await request(server()).put('/collections/folders/f1').send({ parentId: 'f3' }).expect(400);
      await request(server()).put('/collections/folders/f1').send({ parentId: 'f1' }).expect(400);
      expect(prisma.folder.update).not.toHaveBeenCalled();
    });

    it('borrar una carpeta elimina sus subcarpetas y peticiones, y nada más', async () => {
      prisma.folder.findUnique.mockResolvedValue({ id: 'f1', collectionId: 'c1', parentId: null });
      prisma.folder.findMany.mockResolvedValue([
        { id: 'f1', parentId: null },
        { id: 'f2', parentId: 'f1' },
        { id: 'f3', parentId: 'f2' },
        { id: 'fx', parentId: null },
      ]);
      prisma.request.deleteMany.mockResolvedValue({ count: 2 });
      prisma.folder.delete.mockResolvedValue({ id: 'f1' });
      await request(server()).delete('/collections/folders/f1').expect(200);
      const ids = prisma.request.deleteMany.mock.calls[0][0].where.folderId.in;
      expect([...ids].sort()).toEqual(['f1', 'f2', 'f3']);
    });

    it('guarda headers como arreglo y descarta propiedades desconocidas', async () => {
      prisma.request.create.mockResolvedValue({ id: 'r1' });
      await request(server())
        .post('/collections/requests')
        .send({
          name: 'n',
          protocol: 'REST',
          method: 'GET',
          url: 'http://x',
          collectionId: 'c1',
          headers: [{ key: 'a', value: 'b', enabled: true }],
          evil: true,
        })
        .expect(201);
      const data = prisma.request.create.mock.calls[0][0].data;
      expect(data.headers).toEqual([{ key: 'a', value: 'b', enabled: true }]);
      expect(data).not.toHaveProperty('evil');
    });

    it('rechaza headers que no sean lista ni objeto', async () => {
      await request(server())
        .post('/collections/requests')
        .send({ name: 'n', protocol: 'REST', url: 'u', collectionId: 'c1', headers: 'x' })
        .expect(400);
    });

    it('PUT permite mover a la raíz (folderId null) y vaciar auth', async () => {
      prisma.request.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.request.update.mockResolvedValue({ id: 'r1' });
      await request(server()).put('/collections/requests/r1').send({ folderId: null, auth: null }).expect(200);
      const data = prisma.request.update.mock.calls[0][0].data;
      expect(data.folderId).toBeNull();
      expect(data.auth).toBe(Prisma.DbNull);
    });
  });

  describe('Entornos', () => {
    it('PUT /environments/variables/:id llega al handler de variables (no al de entornos)', async () => {
      prisma.variable.findUnique.mockResolvedValue(null);
      const res = await request(server()).put('/environments/variables/v1').send({ enabled: false }).expect(404);
      expect(res.body.message).toContain('Variable');
    });

    it('actualiza una variable y valida el tipo', async () => {
      prisma.variable.findUnique.mockResolvedValue({ id: 'v1' });
      prisma.variable.update.mockResolvedValue({ id: 'v1', enabled: false });
      await request(server()).put('/environments/variables/v1').send({ enabled: false }).expect(200);
      expect(prisma.variable.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { enabled: false } });
      await request(server()).put('/environments/variables/v1').send({ enabled: 'si' }).expect(400);
    });

    it('DELETE de variable y PUT de entorno', async () => {
      prisma.variable.findUnique.mockResolvedValue({ id: 'v1' });
      prisma.variable.delete.mockResolvedValue({ id: 'v1' });
      await request(server()).delete('/environments/variables/v1').expect(200);
      prisma.environment.findUnique.mockResolvedValue({ id: 'e1', variables: [] });
      prisma.environment.update.mockResolvedValue({ id: 'e1', name: 'Prod', variables: [] });
      await request(server()).put('/environments/e1').send({ name: 'Prod', isGlobal: true }).expect(200);
    });

    it('GET sin workspaceId responde 400', async () => {
      await request(server()).get('/environments').expect(400);
    });
  });

  describe('Historial', () => {
    it('filtra por requestId y aplica limit', async () => {
      prisma.historyLog.findMany.mockResolvedValue([]);
      await request(server()).get('/history?requestId=r1&limit=5').expect(200);
      const arg = prisma.historyLog.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ requestId: 'r1' });
      expect(arg.take).toBe(5);
      expect(arg.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('limita el máximo a 200 y usa 50 por defecto', async () => {
      prisma.historyLog.findMany.mockResolvedValue([]);
      await request(server()).get('/history?limit=99999').expect(200);
      expect(prisma.historyLog.findMany.mock.calls[0][0].take).toBe(200);
      await request(server()).get('/history').expect(200);
      expect(prisma.historyLog.findMany.mock.calls[1][0].take).toBe(50);
    });

    it('GET :id responde 404 si no existe', async () => {
      prisma.historyLog.findUnique.mockResolvedValue(null);
      await request(server()).get('/history/nope').expect(404);
    });
  });

  describe('Ejecución', () => {
    it('valida el DTO (protocolo y url)', async () => {
      await request(server()).post('/execution/run').send({ protocol: 'GRPC', url: 'x' }).expect(400);
      await request(server()).post('/execution/run').send({ protocol: 'REST' }).expect(400);
      await request(server()).post('/execution/run').send({ protocol: 'REST', url: 'x', method: 'TRACE' }).expect(400);
    });

    it('REST: resuelve variables del entorno y registra el historial', async () => {
      prisma.environment.findMany.mockResolvedValue([]);
      prisma.environment.findUnique.mockResolvedValue({ variables: [{ key: 'base', value: 'https://api.test' }] });
      prisma.historyLog.create.mockResolvedValue({});
      http.request.mockReturnValue(of({ status: 200, statusText: 'OK', headers: {}, data: { ok: true } }));

      const res = await request(server())
        .post('/execution/run')
        .send({
          protocol: 'REST',
          method: 'GET',
          url: '{{base}}/users',
          environmentId: 'e1',
          workspaceId: 'w1',
          headers: { 'X-A': '1' },
        })
        .expect(201);

      expect(res.body.request.url).toBe('https://api.test/users');
      expect(res.body.response.status).toBe(200);
      expect(http.request.mock.calls[0][0].url).toBe('https://api.test/users');
      expect(prisma.historyLog.create).toHaveBeenCalledTimes(1);
    });

    it('SOAP por WSDL: un error ya no revienta con 500, devuelve error: true y queda en el historial', async () => {
      prisma.historyLog.create.mockResolvedValue({});
      (soap.createClientAsync as jest.Mock).mockRejectedValue(new Error('boom'));
      const res = await request(server())
        .post('/execution/run')
        .send({
          protocol: 'SOAP',
          url: 'http://x',
          wsdlUrl: 'http://x?wsdl',
          soapAction: 'Add',
          body: { intA: 1, intB: 2 },
        })
        .expect(201);
      expect(res.body.response.error).toBe(true);
      expect(res.body.response.message).toBe('boom');
      expect(prisma.historyLog.create.mock.calls[0][0].data.statusText).toBe('ERROR');
    });

    it('SOAP envelope crudo: un error de red devuelve error: true', async () => {
      prisma.historyLog.create.mockResolvedValue({});
      http.post.mockImplementation(() => {
        throw new Error('ECONNREFUSED');
      });
      const res = await request(server())
        .post('/execution/run')
        .send({ protocol: 'SOAP', url: 'http://x', body: '<xml/>' })
        .expect(201);
      expect(res.body.response.error).toBe(true);
      expect(res.body.response.message).toBe('ECONNREFUSED');
    });
  });
});
