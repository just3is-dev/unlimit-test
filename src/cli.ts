import 'reflect-metadata';
import { readFileSync } from 'fs';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { PipelineService } from './pipeline/pipeline.service';

/**
 * CLI entrypoint — one of two interfaces over PipelineService.
 *
 * Usage:
 *   npm run cli -- <path-to-input.txt>
 *   npm run cli -- examples/01-payment-card/input.txt
 *
 * Reads the description from a file, runs the pipeline, and prints
 * the FinalOutput JSON to stdout. Errors go to stderr with exit code 1.
 */
async function main() {
  // Load .env before NestJS boots so providers pick up env vars
  const { config } = await import('dotenv');
  config();

  const [, , inputPath] = process.argv;

  if (!inputPath) {
    console.error('Usage: npm run cli -- <path-to-input.txt>');
    process.exit(1);
  }

  let description: string;
  try {
    description = readFileSync(inputPath, 'utf-8').trim();
  } catch {
    console.error(`Error: cannot read file "${inputPath}"`);
    process.exit(1);
  }

  if (description.length < 10) {
    console.error('Error: description must be at least 10 characters');
    process.exit(1);
  }

  // Bootstrap NestJS in standalone mode — no HTTP server, just DI
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const pipeline = app.get(PipelineService);
    const result = await pipeline.run(description);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Pipeline failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
