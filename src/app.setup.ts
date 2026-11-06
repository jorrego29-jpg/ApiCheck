import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Configuración HTTP común de la app (CORS, límite de cuerpo y validación global).
 * Se usa en main.ts y en las pruebas e2e para probar exactamente lo mismo.
 */
export function configureApp(app: INestApplication): void {
  // Límite del cuerpo de la petición (Express trae 100kb, poco para un sobre SOAP con un documento en base64).
  // Por encima responde 413. En Vercel el tope real es 4,5 MB, antes de llegar aquí.
  const limit = process.env.BODY_LIMIT ?? '10mb';
  const express = app as NestExpressApplication;
  express.useBodyParser('json', { limit });
  express.useBodyParser('urlencoded', { limit, extended: true });
  express.useBodyParser('text', { limit });

  // CORS: orígenes permitidos separados por coma (por defecto, el dev server de Angular).
  const origins = (process.env.CORS_ORIGIN ?? 'http://localhost:4200')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins });

  // Validación global de DTOs: descarta propiedades no declaradas y transforma tipos.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
