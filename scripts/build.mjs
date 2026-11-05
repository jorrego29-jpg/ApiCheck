// Script `npm run build`. Vercel lo ejecuta tal cual (no usa `vercel-build` con NestJS):
// 1. genera el cliente de Prisma (sin él no compilan los tipos de @prisma/client),
// 2. aplica las migraciones, solo en producción de Vercel (previews y builds locales no tocan la base),
// 3. compila Nest.
import { spawnSync } from 'node:child_process';

function run(args, env = {}) {
  const result = spawnSync('npx', ['--no-install', ...args], {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// prisma.config.ts exige DATABASE_URL aunque `generate` no se conecte: si no hay (un preview sin base conectada), basta un valor de relleno.
run(['prisma', 'generate'], {
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://build:build@localhost:5432/build',
});

if (process.env.VERCEL_ENV === 'production') {
  // Las migraciones deben ir por la conexión directa: el pooler de Neon (pgbouncer) no soporta
  // bien los bloqueos que usa `migrate`. La integración de Neon la expone como DATABASE_URL_UNPOOLED.
  const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;
  if (!direct && !process.env.DATABASE_URL) {
    console.error(
      '\n✗ Build de producción sin base de datos: no existe DATABASE_URL_UNPOOLED ni DATABASE_URL.\n' +
        '  En Vercel: Storage → tu base de Neon → Connect Project → este proyecto, con "Production" marcado,\n' +
        '  y vuelve a desplegar. Revisa en Settings → Environment Variables que aparezcan en Production.\n',
    );
    process.exit(1);
  }
  run(['prisma', 'migrate', 'deploy'], direct ? { DATABASE_URL: direct } : {});
} else {
  console.log(`VERCEL_ENV=${process.env.VERCEL_ENV ?? '(no definido)'}: se omiten las migraciones.`);
}

run(['nest', 'build']);
