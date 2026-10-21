import { existsSync } from 'node:fs';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer auto-loads .env — load it natively (Node >= 20.12).
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
