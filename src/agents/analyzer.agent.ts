import { Inject, Injectable } from '@nestjs/common';

import { DesignSystemService } from '@/design-system/design-system.service';
import { PromptLoaderService } from '@/llm/prompt-loader.service';
import { LLM_PROVIDER, LLMProvider } from '@/llm/llm.provider';
import { AnalyzerOutput, AnalyzerOutputSchema, ParserOutput } from '@/pipeline/schemas';
import { PipelineContext } from '@/pipeline/pipeline.context';
import { SchemaRetry } from '@/reliability/schema-retry';

import { BaseAgent } from './base.agent';

/**
 * AnalyzerAgent — Stage 2.
 * Identifies missing states, a11y gaps, responsive gaps, and DS-aware
 * recommendations given the parser output + design system context.
 *
 * Model: MODEL_ANALYZER (Sonnet) — reasoning over DS constraints.
 * Implemented in step 9.
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

    const componentSpecsJson = JSON.stringify(componentSpecs, null, 2);
    const cssVariablesList = cssVariables.join('\n');

    return this.generate({
      promptName: '02-analyzer',
      variables: {
        parser_output: JSON.stringify(input, null, 2),
        component_specs: componentSpecsJson,
        css_variables: cssVariablesList,
      },
      schema: AnalyzerOutputSchema,
      model: process.env.MODEL_ANALYZER ?? 'claude-sonnet-4-6',
    });
  }
}
