# APICheck — API

Backend de **APICheck**, una aplicación tipo Postman para probar servicios **REST** y **SOAP**. Guarda los workspaces, colecciones, peticiones y entornos, ejecuta las peticiones y registra cada ejecución en un historial.

El cliente web está en el repo [ApiCheckClient](https://github.com/jorrego29-jpg/ApiCheckClient).

## Stack

- [NestJS](https://nestjs.com) 11 (TypeScript)
- [Prisma](https://www.prisma.io) 7 con PostgreSQL (adaptador `pg`)
- `axios` para las peticiones REST y `soap` para WSDL y sobres SOAP
- Jest para las pruebas

## Requisitos

- Node.js 22 o superior
- Una base de datos PostgreSQL accesible

## Puesta en marcha

```bash
npm install
cp .env.example .env        # y ajusta los valores
npx prisma migrate deploy   # crea las tablas (en desarrollo también sirve `npx prisma migrate dev`)
npm run start:dev           # http://localhost:3000, con recarga automática
```

### Variables de entorno

| Variable | Descripción | Por defecto |
| --- | --- | --- |
| `DATABASE_URL` | Cadena de conexión de PostgreSQL | — (obligatoria) |
| `PORT` | Puerto HTTP | `3000` |
| `CORS_ORIGIN` | Orígenes permitidos, separados por comas | `http://localhost:4200` |

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run start:dev` | Arranca en modo desarrollo con recarga |
| `npm run build` | Genera el cliente de Prisma y compila a `dist/` (ver [DESPLIEGUE.md](DESPLIEGUE.md) para las migraciones en Vercel) |
| `npm run start:prod` | Arranca la versión compilada |
| `npm test` | Pruebas unitarias |
| `npm run test:cov` | Pruebas unitarias con cobertura |
| `npm run lint` | ESLint (con `--fix`) |

## Pruebas

```bash
npm test                                                    # unitarias
npx jest --config ./test/jest-e2e.json phase0-backend       # e2e con Prisma simulado
```

La suite e2e de `phase0-backend` no necesita base de datos ni red. `test/app.e2e-spec.ts` es la plantilla de Nest y sí exige una base real, por eso se ejecuta aparte.

## API

Sin prefijo (`GET /`, `POST /execution/run`…). Devuelve `Hello World!` en `GET /`, que el cliente usa para comprobar la conexión.

| Recurso | Rutas |
| --- | --- |
| Workspaces | `POST /workspaces`, `GET /workspaces`, `GET /workspaces/:id` |
| Colecciones | `POST /collections`, `GET /collections?workspaceId=`, `GET /collections/:id/tree`, `PUT` y `DELETE /collections/:id` |
| Carpetas | `POST /collections/folders`, `PUT` y `DELETE /collections/folders/:id` |
| Peticiones | `POST /collections/requests`, `GET`, `PUT` y `DELETE /collections/requests/:id` |
| Entornos | `POST /environments`, `GET /environments?workspaceId=`, `GET`, `PUT` y `DELETE /environments/:id` |
| Variables | `POST /environments/:id/variables`, `PUT` y `DELETE /environments/variables/:id` |
| Ejecución | `POST /execution/run`, `GET /execution/soap/inspect-wsdl?url=` |
| Historial | `GET /history?workspaceId=&requestId=&limit=`, `GET /history/:id` |

### Ejecutar una petición

`POST /execution/run` recibe el protocolo (`REST` o `SOAP`), la URL, los headers, el cuerpo y, opcionalmente, `environmentId`, `workspaceId` y `variables`.

- Las `{{variables}}` de la URL, los headers y el cuerpo se sustituyen con las del entorno global del workspace, las del entorno elegido y las enviadas en `variables`, en ese orden de prioridad creciente.
- En **SOAP** con `wsdlUrl` la operación se invoca vía WSDL (`soapAction` es el nombre de la operación y `body` los argumentos). Sin `wsdlUrl` se envía el envelope XML tal cual al endpoint.
- Un fallo de red del destino no es un error HTTP: la respuesta trae `error: true` y el mensaje.
- Cada ejecución queda en el historial con la URL, el estado, los headers, el cuerpo de la respuesta, la duración y el tamaño. `GET /history` no devuelve los cuerpos; `GET /history/:id` sí.

## Estructura

```text
src/
  workspaces/ collections/ environments/   CRUD de datos
  execution/                               ejecución REST/SOAP, parser de WSDL, variables
  history/                                 historial de ejecuciones
  prisma/                                  PrismaService
  app.setup.ts                             CORS y validación global (compartido con las pruebas)
prisma/                                    schema y migraciones
scripts/build.mjs                          build (Prisma + migraciones en Vercel + Nest)
test/                                      pruebas e2e
```

## CI y despliegue

- **Flujo de ramas**: se trabaja en `develop` y se integra a `main` con un Pull Request `develop` → `main` (o desde `hotfix/*`). El merge a `main` es lo que despliega a producción.
- **GitHub Actions** (`.github/workflows/ci-cd.yml`) corre en cada push y PR a `main` y `develop`. En un PR prueba el resultado del merge, no solo la rama de origen. Tiene tres jobs:
  - *Pruebas*: `npm ci`, `npm run build` (el mismo comando que ejecuta Vercel, sin generar Prisma antes), las pruebas unitarias y las e2e con Prisma simulado.
  - *Build de producción y prueba de humo*: levanta un PostgreSQL y ejecuta el build con `VERCEL_ENV=production` (genera el cliente y aplica las migraciones en una base vacía). Después comprueba con `prisma migrate diff` que `schema.prisma` no tenga cambios sin migración, corre todas las suites e2e contra la base real (`test/db.e2e-spec.ts` cubre cascadas, campos Json, variables de entorno e historial) y arranca la API compilada para ejecutar `scripts/smoke.mjs`.
  - *Integración develop → main* (solo en PR hacia `main`): exige que el PR venga de `develop` o `hotfix/*`, que no se modifiquen ni borren migraciones que ya están en `main` y que las migraciones nuevas sean posteriores a la última de `main`.
  - Para que frenen un despliegue defectuoso, en GitHub (*Settings → Rules*) protege `main` exigiendo un PR y que pasen los tres checks antes del merge.
- **En local**, con una base migrada en `DATABASE_URL`: `npx jest --config ./test/jest-e2e.json --runInBand` (todas las e2e) y, con la API en marcha, `BASE_URL=http://127.0.0.1:3000 node scripts/smoke.mjs`.
- **Vercel** despliega con su integración de GitHub (producción desde `main`, previews en PR), con la base de datos en Neon. Los pasos están en [DESPLIEGUE.md](DESPLIEGUE.md).

> APICheck ejecuta peticiones a cualquier URL que se le indique y no tiene autenticación propia: no lo expongas públicamente sin protección.
