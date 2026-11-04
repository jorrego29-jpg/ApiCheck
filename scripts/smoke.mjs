// Prueba de humo del backend ya compilado, con las migraciones aplicadas y una base PostgreSQL real.
// La usa el CI (ver .github/workflows/ci-cd.yml); en local: BASE_URL=http://127.0.0.1:3000 node scripts/smoke.mjs
//
// Cubre lo que las pruebas unitarias (con Prisma simulado) no ven: el cliente de Prisma generado,
// las migraciones, el arranque de la app y que las ejecuciones se guarden en el historial.

const base = (process.env.BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

async function call(method, path, body) {
  const response = await fetch(base + path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = text;
  try {
    json = JSON.parse(text);
  } catch {
    // Respuesta que no es JSON (p. ej. "Hello World!"): se deja como texto.
  }
  return { status: response.status, body: json };
}

function check(name, ok, detail) {
  if (!ok) {
    console.error(`✗ ${name}`);
    if (detail !== undefined) console.error(JSON.stringify(detail, null, 2));
    process.exit(1);
  }
  console.log(`✓ ${name}`);
}

async function waitForServer(seconds = 60) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    try {
      await fetch(base + '/');
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  console.error(`✗ El servidor no respondió en ${base} tras ${seconds} s`);
  process.exit(1);
}

await waitForServer();

const root = await call('GET', '/');
check('GET / responde "Hello World!"', root.status === 200 && root.body === 'Hello World!', root);

const workspace = await call('POST', '/workspaces', { name: 'smoke' });
check('crea un workspace', workspace.status === 201 && workspace.body.id, workspace);
const workspaceId = workspace.body.id;

const workspaces = await call('GET', '/workspaces');
check(
  'lista el workspace creado',
  Array.isArray(workspaces.body) && workspaces.body.some((w) => w.id === workspaceId),
  workspaces,
);

const collection = await call('POST', '/collections', { name: 'smoke', workspaceId });
check('crea una colección', collection.status === 201 && collection.body.id, collection);

const request = await call('POST', '/collections/requests', {
  name: 'self',
  protocol: 'REST',
  method: 'GET',
  url: base + '/',
  collectionId: collection.body.id,
});
check('crea una petición', request.status === 201 && request.body.id, request);
const requestId = request.body.id;

const tree = await call('GET', `/collections/${collection.body.id}/tree`);
check(
  'el árbol de la colección incluye la petición',
  tree.status === 200 && JSON.stringify(tree.body).includes(requestId),
  tree,
);

// La app se llama a sí misma: ejercita el ejecutor REST sin depender de internet.
const run = await call('POST', '/execution/run', {
  requestId,
  protocol: 'REST',
  method: 'GET',
  url: base + '/',
  workspaceId,
});
check(
  'ejecuta una petición REST y recibe 200',
  run.body?.response?.status === 200 && run.body.response.data === 'Hello World!',
  run,
);

// Regresión: una respuesta correcta no se guardaba en el historial (los headers de axios no eran JSON plano).
const history = await call('GET', `/history?requestId=${requestId}`);
check(
  'la ejecución quedó en el historial',
  Array.isArray(history.body) && history.body.length === 1 && history.body[0].status === 200,
  history,
);

const byWorkspace = await call('GET', `/history?workspaceId=${workspaceId}`);
check(
  'el historial se filtra por workspace',
  Array.isArray(byWorkspace.body) && byWorkspace.body.length === 1,
  byWorkspace,
);

const detail = await call('GET', `/history/${history.body[0].id}`);
check(
  'el detalle guarda el cuerpo de la respuesta',
  detail.status === 200 && String(detail.body.responseBody).includes('Hello World'),
  detail,
);

console.log('\nPrueba de humo superada.');
