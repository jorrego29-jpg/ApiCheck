import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Load .env natively (Node >= 20.12) — Nest does not auto-load it.
if (existsSync('.env')) process.loadEnvFile('.env');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
