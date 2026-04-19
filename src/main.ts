import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * HTTP entrypoint — one of three interfaces over PipelineService.
 *
 * Interfaces:
 *   POST /pipeline  →  this file (HTTP)
 *   src/cli.ts      →  CLI (step 16)
 *   src/mcp.ts      →  MCP server (step 17)
 *
 * See ADR-004 for why we expose three interfaces over one service.
 */
async function bootstrap() {
  // Load .env before anything else
  const { config } = await import('dotenv');
  config();

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Design-to-Code Agent listening on http://localhost:${port}`);
}

bootstrap();
