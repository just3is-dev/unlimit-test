import { readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * PromptLoaderService — loads prompt files from `prompts/*.md` at startup,
 * caches them in memory, and injects `{{variable}}` placeholders at call time.
 *
 * Design rationale:
 *  - Prompts are engineering artifacts, not inline strings. Keeping them in
 *    dedicated .md files makes them diffable, reviewable, and editable without
 *    touching TypeScript.
 *  - Caching avoids repeated disk reads on every LLM call.
 *  - `{{variable}}` syntax is simple and grep-friendly. Variables are injected
 *    at call time so the cached template stays reusable.
 *
 * Usage:
 *   const system = this.prompts.load('01-parser', { conventions: '...' });
 */
@Injectable()
export class PromptLoaderService implements OnModuleInit {
  private readonly logger = new Logger(PromptLoaderService.name);
  private readonly cache = new Map<string, string>();

  // process.cwd() resolves to the project root regardless of whether we're
  // running via ts-node (src/llm/) or compiled output (dist/src/llm/).
  private readonly promptsDir = join(process.cwd(), 'prompts');

  onModuleInit(): void {
    // Pre-warm the cache for all known prompt files
    const knownPrompts = ['01-parser', '02-analyzer', '03-generator'];
    let loaded = 0;
    for (const name of knownPrompts) {
      try {
        this.loadIntoCache(name);
        loaded++;
      } catch {
        // Non-fatal: prompt may not exist yet during development
        this.logger.warn(`Prompt not found, skipping: prompts/${name}.md`);
      }
    }
    this.logger.log(`Loaded ${loaded}/${knownPrompts.length} prompt files`);
  }

  /**
   * Returns the prompt template with all `{{key}}` placeholders replaced.
   *
   * @param name - Prompt file name without extension, e.g. `'01-parser'`
   * @param variables - Map of placeholder → value, e.g. `{ css_variables: '...' }`
   * @throws if the prompt file does not exist and was not pre-cached
   */
  load(name: string, variables: Record<string, string> = {}): string {
    if (!this.cache.has(name)) {
      this.loadIntoCache(name);
    }

    let template = this.cache.get(name)!;

    for (const [key, value] of Object.entries(variables)) {
      template = template.replaceAll(`{{${key}}}`, value);
    }

    // Warn if any unreplaced placeholders remain.
    // Only match {{snake_case_names}} — not CSS-in-JS objects like {{ display: 'flex' }}
    // that may appear inside injected content.
    const remaining = template.match(/\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/g);
    if (remaining) {
      this.logger.warn(`Prompt "${name}" has unreplaced placeholders: ${remaining.join(', ')}`);
    }

    return template;
  }

  private loadIntoCache(name: string): void {
    const filePath = join(this.promptsDir, `${name}.md`);
    const content = readFileSync(filePath, 'utf-8');
    this.cache.set(name, content);
  }
}
