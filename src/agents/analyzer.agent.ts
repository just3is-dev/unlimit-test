import { Inject, Injectable } from '@nestjs/common';

import { DesignSystemService } from '@/design-system/design-system.service';
import { LLM_PROVIDER, LLMProvider } from '@/llm/llm.provider';
import { PromptLoaderService } from '@/llm/prompt-loader.service';
import { PipelineContext } from '@/pipeline/pipeline.context';
import { AnalyzerOutput, AnalyzerOutputSchema, ParserOutput } from '@/pipeline/schemas';
import { SchemaRetry } from '@/reliability/schema-retry';

import { BaseAgent } from './base.agent';

/**
 * AnalyzerAgent — Stage 2.
 *
 * Identifies gaps in the component spec:
 *   - missing_states (hover, focus-visible, loading, error, etc.)
 *   - accessibility_gaps (ARIA, contrast, keyboard nav)
 *   - responsive_gaps (breakpoints, touch targets)
 *   - recommendations (DS-aware: which components and props to use)
 *
 * DS context is injected into the system prompt so the model only
 * recommends components and tokens that actually exist. See paper-prototype.md §1.
 *
 * Model: MODEL_ANALYZER (Sonnet) — reasoning over DS constraints.
 */
@Injectable()
export class AnalyzerAgent extends BaseAgent<ParserOutput, AnalyzerOutput> {
  constructor(
    @Inject(LLM_PROVIDER) llm: LLMProvider,
    prompts: PromptLoaderService,
    schemaRetry: SchemaRetry,
    private readonly ds: DesignSystemService,
  ) {
    super('AnalyzerAgent', llm, prompts, schemaRetry);
  }

  async run(input: ParserOutput, _context: PipelineContext): Promise<AnalyzerOutput> {
    const { componentSpecs, cssVariables } = this.ds.getContext();

    return this.generate({
      promptName: '02-analyzer',
      systemVars: {
        component_specs: JSON.stringify(componentSpecs, null, 2),
        css_variables: cssVariables.join('\n'),
      },
      userPrompt: JSON.stringify(input, null, 2),
      schema: AnalyzerOutputSchema,
      model: process.env.MODEL_ANALYZER ?? 'claude-sonnet-4-6',
    });
  }
}
