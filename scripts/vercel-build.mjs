// Build del backend en Vercel (lo ejecuta el script `vercel-build` de package.json):
// 1. genera el cliente de Prisma,
// 2. aplica las migraciones, solo en producción (los previews no tocan la base de producción),
// 3. compila Nest.
import { spawnSync } from 'node:child_process';

function run(args, env = {}) {
  const result = spawnSync('npx', ['--no-install', ...args], {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(['prisma', 'generate']);

if (process.env.VERCEL_ENV === 'production') {
  // Las migraciones deben ir por la conexión directa: el pooler de Neon (pgbouncer) no soporta
  // bien los bloqueos que usa `migrate`. La integración de Neon la expone como DATABASE_URL_UNPOOLED.
  const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;
  run(['prisma', 'migrate', 'deploy'], direct ? { DATABASE_URL: direct } : {});
} else {
  console.log(`VERCEL_ENV=${process.env.VERCEL_ENV ?? '(local)'}: se omiten las migraciones.`);
}

run(['nest', 'build']);
