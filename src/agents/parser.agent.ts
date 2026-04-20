import { Inject, Injectable } from '@nestjs/common';

import { LLM_PROVIDER, LLMProvider } from '@/llm/llm.provider';
import { PromptLoaderService } from '@/llm/prompt-loader.service';
import { SchemaRetry } from '@/llm/schema-retry';
import { PipelineContext } from '@/pipeline/pipeline.context';
import { ParserOutput, ParserOutputSchema } from '@/pipeline/pipeline.schemas';

import { BaseAgent } from './base.agent';

/**
 * ParserAgent — Stage 1.
 *
 * Extracts structured component metadata from a plain-text description:
 *   - component.name / type / business_context
 *   - extraction.specified_states (ONLY what is explicitly mentioned)
 *   - extraction.tokens_referenced
 *   - extraction.constraints
 *
 * Model: MODEL_PARSER (Haiku) — extraction task, no deep reasoning needed.
 * See ADR-003 for mixed-model cost rationale.
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
      systemVars: {}, // 01-parser.md has no injected DS variables
      userPrompt: description, // clean separation: prompt file = system, input = user
      schema: ParserOutputSchema,
      model: process.env.MODEL_PARSER ?? 'claude-haiku-4-5',
    });
  }
}
