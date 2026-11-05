// Pruebas de integración contra una base PostgreSQL real con las migraciones aplicadas.
// Las usa el job `smoke` del CI; en local: con DATABASE_URL apuntando a una base migrada,
// `npx jest --config ./test/jest-e2e.json db`.
//
// Cubren lo que las pruebas con Prisma simulado no ven: restricciones y cascadas del schema,
// campos Json (la regresión de AxiosHeaders) y consultas con relaciones (historial por workspace).
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { HttpService } from './../src/execution/http.service';
import { AxiosHeaders } from 'axios';
import { of } from 'rxjs';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { configureApp } from './../src/app.setup';


jest.setTimeout(30000);

describe('Backend con PostgreSQL real (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = { request: jest.fn(), post: jest.fn() };
  const tag = `ci-${Date.now()}`;
  const server = () => app.getHttpServer();

  let workspaceId: string;
  let collectionId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(HttpService)
      .useValue(http)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.historyLog.deleteMany({ where: { executedUrl: { contains: tag } } });
      if (workspaceId) await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    }
    if (app) await app.close();
  });

  it('crea un workspace y lo devuelve con sus contadores', async () => {
    const created = await request(server()).post('/workspaces').send({ name: tag }).expect(201);
    workspaceId = created.body.id;

    const found = await request(server()).get(`/workspaces/${workspaceId}`).expect(200);
    expect(found.body.name).toBe(tag);
    expect(found.body._count).toEqual({ collections: 0, environments: 0 });
  });

  it('responde 404 con un workspace que no existe', async () => {
    await request(server()).get('/workspaces/00000000-0000-0000-0000-000000000000').expect(404);
  });

  it('rechaza una colección de un workspace inexistente (clave foránea)', async () => {
    const res = await request(server())
      .post('/collections')
      .send({ name: 'huérfana', workspaceId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('arma el árbol de carpetas anidadas con sus peticiones', async () => {
    const collection = await request(server())
      .post('/collections')
      .send({ name: 'árbol', workspaceId })
      .expect(201);
    collectionId = collection.body.id;

    const parent = await request(server())
      .post('/collections/folders')
      .send({ name: 'padre', collectionId })
      .expect(201);
    const child = await request(server())
      .post('/collections/folders')
      .send({ name: 'hija', collectionId, parentId: parent.body.id })
      .expect(201);
    const nested = await request(server())
      .post('/collections/requests')
      .send({
        name: 'anidada',
        protocol: 'REST',
        method: 'GET',
        url: `https://${tag}.test/nested`,
        collectionId,
        folderId: child.body.id,
        headers: [{ key: 'X-A', value: '1', enabled: true }],
      })
      .expect(201);
    await request(server())
      .post('/collections/requests')
      .send({ name: 'raíz', protocol: 'REST', method: 'GET', url: `https://${tag}.test/root`, collectionId })
      .expect(201);

    const tree = await request(server()).get(`/collections/${collectionId}/tree`).expect(200);
    expect(tree.body.requests.map((r: any) => r.name)).toEqual(['raíz']);
    expect(tree.body.folders).toHaveLength(1);
    expect(tree.body.folders[0].children[0].requests[0].id).toBe(nested.body.id);

    // Los campos Json se guardan y se leen tal cual.
    const saved = await request(server()).get(`/collections/requests/${nested.body.id}`).expect(200);
    expect(saved.body.headers).toEqual([{ key: 'X-A', value: '1', enabled: true }]);
  });

  it('no permite mover una carpeta dentro de su propia subcarpeta', async () => {
    const parent = await request(server())
      .post('/collections/folders')
      .send({ name: 'ciclo-padre', collectionId })
      .expect(201);
    const child = await request(server())
      .post('/collections/folders')
      .send({ name: 'ciclo-hija', collectionId, parentId: parent.body.id })
      .expect(201);
    const grandchild = await request(server())
      .post('/collections/folders')
      .send({ name: 'ciclo-nieta', collectionId, parentId: child.body.id })
      .expect(201);

    await request(server())
      .put(`/collections/folders/${parent.body.id}`)
      .send({ parentId: grandchild.body.id })
      .expect(400);
  });

  it('al borrar una carpeta borra sus subcarpetas y todas sus peticiones', async () => {
    const top = await request(server())
      .post('/collections/folders')
      .send({ name: 'borrar', collectionId })
      .expect(201);
    const sub = await request(server())
      .post('/collections/folders')
      .send({ name: 'borrar-sub', collectionId, parentId: top.body.id })
      .expect(201);
    const req = await request(server())
      .post('/collections/requests')
      .send({
        name: 'se va',
        protocol: 'REST',
        method: 'GET',
        url: `https://${tag}.test/gone`,
        collectionId,
        folderId: sub.body.id,
      })
      .expect(201);

    await request(server()).delete(`/collections/folders/${top.body.id}`).expect(200);

    await request(server()).get(`/collections/requests/${req.body.id}`).expect(404);
    expect(await prisma.folder.findUnique({ where: { id: sub.body.id } })).toBeNull();
  });

  it('ejecuta con variables (global + entorno, sin las deshabilitadas) y guarda el historial', async () => {
    await request(server())
      .post('/environments')
      .send({
        name: 'Globals',
        workspaceId,
        isGlobal: true,
        variables: [
          { key: 'host', value: `global-${tag}.test` },
          { key: 'token', value: 'global-token' },
        ],
      })
      .expect(201);
    const env = await request(server())
      .post('/environments')
      .send({
        name: 'Dev',
        workspaceId,
        variables: [
          { key: 'host', value: `dev-${tag}.test` },
          { key: 'token', value: 'disabled-token', enabled: false },
        ],
      })
      .expect(201);

    const req = await request(server())
      .post('/collections/requests')
      .send({ name: 'run', protocol: 'REST', method: 'GET', url: 'https://{{host}}/users', collectionId })
      .expect(201);

    // Cabeceras reales de axios: una instancia de AxiosHeaders, no un objeto plano (regresión del historial).
    http.request.mockReturnValue(
      of({
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders({ 'content-type': 'application/json' }),
        data: { ok: true },
      }),
    );

    const run = await request(server())
      .post('/execution/run')
      .send({
        requestId: req.body.id,
        protocol: 'REST',
        method: 'GET',
        url: 'https://{{host}}/users',
        headers: { Authorization: 'Bearer {{token}}' },
        environmentId: env.body.id,
        workspaceId,
      })
      .expect(201);

    expect(run.body.request.url).toBe(`https://dev-${tag}.test/users`);
    expect(run.body.request.headers.Authorization).toBe('Bearer global-token');
    expect(run.body.response.status).toBe(200);

    const history = await request(server()).get(`/history?requestId=${req.body.id}`).expect(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0]).toMatchObject({ status: 200, method: 'GET' });
    expect(history.body[0].responseBody).toBeUndefined(); // el listado no trae el cuerpo

    const detail = await request(server()).get(`/history/${history.body[0].id}`).expect(200);
    expect(detail.body.responseHeaders).toEqual({ 'content-type': 'application/json' });
    expect(detail.body.requestHeaders).toEqual({ Authorization: 'Bearer global-token' });
    expect(JSON.parse(detail.body.responseBody)).toEqual({ ok: true });

    const byWorkspace = await request(server()).get(`/history?workspaceId=${workspaceId}`).expect(200);
    expect(byWorkspace.body.map((h: any) => h.id)).toContain(history.body[0].id);

    const otherWorkspace = await request(server())
      .get('/history?workspaceId=00000000-0000-0000-0000-000000000000')
      .expect(200);
    expect(otherWorkspace.body.map((h: any) => h.id)).not.toContain(history.body[0].id);
  });

  it('respeta el límite del historial', async () => {
    const res = await request(server()).get(`/history?workspaceId=${workspaceId}&limit=1`).expect(200);
    expect(res.body).toHaveLength(1);
  });

  it('al borrar el workspace caen en cascada sus datos y el historial se conserva sin petición', async () => {
    const logs = await prisma.historyLog.findMany({ where: { executedUrl: { contains: tag } } });
    expect(logs.length).toBeGreaterThan(0);

    await prisma.workspace.delete({ where: { id: workspaceId } });

    expect(await prisma.collection.count({ where: { workspaceId } })).toBe(0);
    expect(await prisma.environment.count({ where: { workspaceId } })).toBe(0);
    const after = await prisma.historyLog.findMany({ where: { executedUrl: { contains: tag } } });
    expect(after).toHaveLength(logs.length);
    expect(after.every((l) => l.requestId === null)).toBe(true);
    workspaceId = '';
  });
});
