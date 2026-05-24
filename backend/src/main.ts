import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
    optionsSuccessStatus: 204,
  });

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
