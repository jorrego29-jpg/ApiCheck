# Despliegue en Vercel

APICheck son dos proyectos de Vercel, uno por repo, más una base PostgreSQL en Neon:

| Repo | Proyecto en Vercel | Qué es |
| --- | --- | --- |
| `ApiCheckClient` | Angular (estático) | Sirve la interfaz y reenvía `/api/*` al backend (rewrite en su `vercel.json`) |
| `ApiCheck` | NestJS (Vercel Function) | La API; no necesita `vercel.json`, Vercel la detecta sola |

Los workflows de GitHub Actions solo prueban y compilan. El despliegue lo hace la integración Git de Vercel: cada push a `main` va a producción y cada PR obtiene un preview.

## 1. Backend (`ApiCheck`) — primero

1. En Vercel: **Add New → Project**, importa el repo `ApiCheck`. Deja el directorio raíz como está; el framework debe aparecer como NestJS.
2. Antes de pulsar *Deploy*, ve a **Storage → Create Database → Neon** (Marketplace) y conéctala a este proyecto para *Production* (y *Preview*, si quieres que los previews tengan su propia rama de base de datos). Neon añade `DATABASE_URL` y `DATABASE_URL_UNPOOLED` como variables de entorno.
3. Despliega. El build ejecuta `npm run vercel-build` (`scripts/vercel-build.mjs`): genera el cliente de Prisma, aplica las migraciones **solo en producción** (con la conexión directa, no la del pooler) y compila Nest.
4. Anota el dominio de producción del proyecto (por ejemplo `https://apicheck-api.vercel.app`). Prueba `GET /`: debe responder `Hello World!`.

## 2. Frontend (`ApiCheckClient`)

1. En el repo del cliente, abre `vercel.json` y cambia `https://backend.example.com` por el dominio de producción del backend. Commit y push.
2. En Vercel: **Add New → Project**, importa `ApiCheckClient` (framework Angular; el `vercel.json` ya fija el comando de build y la carpeta de salida).
3. Despliega y abre el dominio: la app debe mostrar *API conectada*.

Como el navegador solo habla con el dominio del cliente (Vercel reenvía `/api`), no hace falta CORS. `CORS_ORIGIN` en el backend solo importa si algún día se llama a la API desde otro origen.

## Qué cambia respecto a un servidor normal

- **No hay proceso permanente.** La API es una función que Vercel arranca bajo demanda; la primera petición tras un rato sin uso es más lenta (arranque en frío).
- **Duración:** hasta 300 s por petición (plan Hobby). Una petición de prueba más lenta que eso devuelve 504.
- **Tamaño:** una respuesta o un cuerpo de más de 4,5 MB falla con 413. Aplica a lo que APICheck devuelve al cliente, no a lo que descarga del servicio probado.
- **Las ejecuciones de APICheck salen desde Vercel**, no desde tu red: no puede probar servicios que solo existen en `localhost` o en una red privada.
- **Previews:** no aplican migraciones. Si el preview usa la base de producción, un esquema distinto puede fallar; por eso conviene la rama de base de datos por preview de Neon.

## Seguridad

APICheck ejecuta peticiones a cualquier URL que se le pida y no tiene login propio. Con el dominio público, cualquiera puede usar tu API como proxy. Activa en Vercel *Settings → Deployment Protection* en los dos proyectos (según tu plan, cubre también producción) o añade autenticación a la API antes de compartir el dominio.
