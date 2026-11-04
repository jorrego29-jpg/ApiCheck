# Despliegue de APICheck en un VPS con Docker

Cada repo tiene su propio workflow (`.github/workflows/ci-cd.yml`):

| Evento | Qué pasa |
| --- | --- |
| PR o push a `develop` / `main` | Pruebas y compilación |
| Push (merge) a `main` | Lo anterior + imagen en GHCR + despliegue por SSH |

- **ApiCheck** (backend): publica `ghcr.io/<dueño>/apicheck-api`, copia `docker-compose.yml` y `Caddyfile` al VPS, aplica las migraciones de Prisma y reinicia la API.
- **ApiCheckClient** (frontend): publica `ghcr.io/<dueño>/apicheck-web` (nginx con el Angular) y reinicia solo ese contenedor.
- En el VPS corren cuatro contenedores: `db` (PostgreSQL), `api`, `web` y `caddy`. Solo Caddy publica puertos (80/443): reparte `/api/*` a la API y el resto al cliente, y pide usuario y contraseña.

## 1. Preparar el VPS (una vez)

Como root en el servidor (Ubuntu/Debian):

```bash
curl -fsSL https://get.docker.com | sh
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /opt/apicheck && chown deploy:deploy /opt/apicheck
```

Clave SSH solo para desplegar (en tu PC):

```bash
ssh-keygen -t ed25519 -f apicheck_deploy -C "github-actions" -N ""
# Pega apicheck_deploy.pub en /home/deploy/.ssh/authorized_keys del VPS
ssh-keyscan -p 22 IP_DEL_VPS        # su salida va en el secret VPS_KNOWN_HOSTS
```

Crea `/opt/apicheck/.env` a partir de `deploy/.env.example` y rellénalo (contraseña de la base, dominio, usuario y hash de acceso). Si usas dominio, apunta su DNS (registro A) al VPS antes del primer despliegue; sin dominio, `SITE_ADDRESS=:80` sirve por HTTP, pero la contraseña viajaría sin cifrar.

## 2. Configurar GitHub (en los dos repos)

En *Settings → Environments* crea el environment **`production`** (aquí puedes exigir aprobación manual antes de cada despliegue). Y en *Settings → Secrets and variables → Actions*:

| Tipo | Nombre | Valor |
| --- | --- | --- |
| Secret | `VPS_HOST` | IP o dominio del VPS |
| Secret | `VPS_USER` | `deploy` |
| Secret | `VPS_SSH_KEY` | contenido de `apicheck_deploy` (la clave privada) |
| Secret | `VPS_KNOWN_HOSTS` | salida de `ssh-keyscan` |
| Variable (opcional) | `VPS_PORT` | puerto SSH si no es 22 |
| Variable (opcional) | `DEPLOY_PATH` | carpeta en el VPS si no es `/opt/apicheck` |

Las imágenes en GHCR son privadas por defecto: el despliegue entra al registro con el token temporal del workflow, no hace falta crear ningún token personal.

## 3. Primer despliegue

1. Merge a `main` en **ApiCheck**: levanta base, API y Caddy.
2. Merge a `main` en **ApiCheckClient**: levanta el cliente.

Hasta el paso 2 la web responde 502; es normal. Después abre `https://tu-dominio` y entra con el usuario y la contraseña del `.env`.

## Día a día

- **Rollback**: en *Actions* abre una ejecución antigua que desplegó bien y pulsa *Re-run all jobs*; reconstruye esa versión y la vuelve a desplegar. Las migraciones de base de datos no se deshacen.
- **Logs**: `docker compose logs -f api` en `/opt/apicheck`.
- **Copia de seguridad**: `docker compose exec -T db pg_dump -U apicheck apicheck > backup.sql`.

## Seguridad

APICheck ejecuta peticiones a la URL que se le indique, y no tiene login propio. Por eso Caddy exige contraseña a todo: sin ella, cualquiera en internet podría usar el servidor para llegar a la base de datos o a otros servicios internos del VPS. No quites el `basic_auth` del `Caddyfile` mientras la app sea pública.
