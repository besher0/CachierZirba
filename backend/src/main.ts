import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  // Keep browser/web clients working by default in non-production environments.
  // Production can still be locked down via ENABLE_CORS=false.
  const enableCors =
    process.env.ENABLE_CORS === 'true' ||
    (process.env.ENABLE_CORS !== 'false' && process.env.NODE_ENV !== 'production');
  if (enableCors) {
    const rawOrigins = process.env.CORS_ORIGINS;
    let origins: string[] | true = true;
    if (rawOrigins) {
      origins = rawOrigins.split(',').map((s) => s.trim());
    }

    app.enableCors({ origin: origins });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
    }),
  );
  app.setGlobalPrefix('api');

  const portValue = process.env.BACKEND_PORT ?? '3000';
  const port = Number(portValue);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid BACKEND_PORT value: ${portValue}`);
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`Backend listening on http://0.0.0.0:${port}/api`);
}

void bootstrap();
