/**
 * run-examples.ts — generates output.json + Component.tsx for all three examples.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/run-examples.ts
 *
 * For each examples/0X-* folder that contains input.txt:
 *   1. Runs the pipeline
 *   2. Writes output.json (full FinalOutput)
 *   3. Writes Component.tsx (first generated file's content)
 */
import 'reflect-metadata';
import { writeFileSync, readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { PipelineService } from '../src/pipeline/pipeline.service';
import { FinalOutput } from '../src/pipeline/pipeline.schemas';

async function main() {
  const { config } = await import('dotenv');
  config();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const pipeline = app.get(PipelineService);
  const examplesDir = join(__dirname, '..', 'examples');

  const examples = readdirSync(examplesDir)
    .filter((name) => existsSync(join(examplesDir, name, 'input.txt')))
    .sort();

  console.log(`Found ${examples.length} example(s): ${examples.join(', ')}\n`);

  for (const example of examples) {
    const exampleDir = join(examplesDir, example);
    const inputPath = join(exampleDir, 'input.txt');
    const description = readFileSync(inputPath, 'utf-8').trim();

    console.log(`▶ Running: ${example}`);
    console.log(`  Input: ${description.slice(0, 80)}...`);

    let result: FinalOutput;
    try {
      result = await pipeline.run(description);
    } catch (err) {
      console.error(`  ✗ Failed: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    // Write full output.json
    const outputPath = join(exampleDir, 'output.json');
    writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`  ✓ output.json written`);

    // Write Component.tsx — first file from generated_code.files
    // @ts-nocheck is prepended to signal this is generated output, not source code
    const firstFile = result.generated_code.files[0];
    if (firstFile) {
      const componentPath = join(exampleDir, firstFile.filename);
      writeFileSync(componentPath, `// @ts-nocheck\n${firstFile.content}`, 'utf-8');
      console.log(`  ✓ ${firstFile.filename} written`);
    }

    console.log(
      `  ✓ Validation: token_compliance=${result.validation.token_compliance}, ` +
        `coverage=${result.validation.states_coverage}, ` +
        `a11y=${result.validation.accessibility_score}`,
    );

    if (result.validation.hallucinations_caught.length > 0) {
      console.warn(`  ⚠ Hallucinations: ${result.validation.hallucinations_caught.join(', ')}`);
    }
  }

  await app.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
