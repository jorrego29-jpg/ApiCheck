import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Configuración HTTP común de la app (CORS y validación global).
 * Se usa en main.ts y en las pruebas e2e para probar exactamente lo mismo.
 */
export function configureApp(app: INestApplication): void {
  // CORS: orígenes permitidos separados por coma (por defecto, el dev server de Angular).
  const origins = (process.env.CORS_ORIGIN ?? 'http://localhost:4200')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins });

  // Validación global de DTOs: descarta propiedades no declaradas y transforma tipos.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
