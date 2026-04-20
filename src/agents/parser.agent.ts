import { Inject, Injectable } from '@nestjs/common';

import { PromptLoaderService } from '@/llm/prompt-loader.service';
import { LLM_PROVIDER, LLMProvider } from '@/llm/llm.provider';
import { ParserOutput, ParserOutputSchema } from '@/pipeline/schemas';
import { PipelineContext } from '@/pipeline/pipeline.context';
import { SchemaRetry } from '@/reliability/schema-retry';

import { BaseAgent } from './base.agent';

/**
 * ParserAgent — Stage 1.
 * Extracts component type, specified states, token references, and constraints
 * from the plain-text description.
 *
 * Model: MODEL_PARSER (Haiku) — extraction only, no deep reasoning needed.
 * Implemented in step 8.
 */
@Injectable()
export class ParserAgent extends BaseAgent<string, ParserOutput> {
  constructor(
    @Inject(LLM_PROVIDER) llm: LLMProvider,
    prompts: PromptLoaderService,
    schemaRetry: SchemaRetry,
  ) {
    super('ParserAgent', llm, prompts, schemaRetry);
  }

  async run(description: string, _context: PipelineContext): Promise<ParserOutput> {
    return this.generate({
      promptName: '01-parser',
      variables: { description },
      schema: ParserOutputSchema,
      model: process.env.MODEL_PARSER ?? 'claude-haiku-4-5',
    });
  }
}
