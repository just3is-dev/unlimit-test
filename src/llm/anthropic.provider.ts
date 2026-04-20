import { createAnthropic } from '@ai-sdk/anthropic';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { generateObject } from 'ai';
import { z } from 'zod';

import { GenerateObjectOptions, LLMProvider } from './llm.provider';

/**
 * AnthropicProvider — concrete LLMProvider backed by Anthropic Claude
 * via the Vercel AI SDK (`ai` + `@ai-sdk/anthropic`).
 *
 * What we delegate to the SDK:
 *  - HTTP transport, auth headers, retries on 429/5xx
 *  - Structured output via `generateObject` (JSON mode + Zod validation)
 *  - Provider abstraction (swap to OpenAI: replace this class only)
 *
 * What we keep explicit:
 *  - Retry-with-feedback on Zod schema failure (SchemaRetry, step 6)
 *  - Prompt loading and variable injection (PromptLoaderService, step 5)
 *  - Pipeline orchestration (PipelineService, step 7)
 *
 * See ADR-002 for full rationale.
 */
@Injectable()
export class AnthropicProvider extends LLMProvider implements OnModuleInit {
  private readonly logger = new Logger(AnthropicProvider.name);
  private anthropic!: ReturnType<typeof createAnthropic>;

  onModuleInit(): void {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set. Copy .env.example → .env and fill it in.');
    }
    this.anthropic = createAnthropic({ apiKey });
    this.logger.log('Anthropic provider initialised');
  }

  async generateObject<S extends z.ZodType>(
    options: GenerateObjectOptions<S>,
  ): Promise<z.infer<S>> {
    const { model, system, prompt, schema, maxTokens = 4096, temperature = 0 } = options;

    this.logger.debug(`generateObject model=${model} maxTokens=${maxTokens}`);

    const result = await generateObject({
      model: this.anthropic(model),
      system,
      prompt,
      schema,
      maxTokens,
      temperature,
    });

    return result.object;
  }
}
