import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

/**
 * HTTP entrypoint — one of two interfaces over PipelineService.
 *
 * Interfaces:
 *   POST /pipeline  →  this file (HTTP)
 *   src/cli.ts      →  CLI
 */
async function bootstrap() {
  // Load .env before anything else
  const { config } = await import('dotenv');
  config();

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Design-to-Code Agent listening on http://localhost:${port}`);
}

bootstrap();
