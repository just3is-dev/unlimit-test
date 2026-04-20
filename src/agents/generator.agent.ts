import { Inject, Injectable } from '@nestjs/common';

import { DesignSystemService } from '@/design-system/design-system.service';
import { PromptLoaderService } from '@/llm/prompt-loader.service';
import { LLM_PROVIDER, LLMProvider } from '@/llm/llm.provider';
import { AnalyzerOutput, GeneratorOutput, GeneratorOutputSchema } from '@/pipeline/schemas';
import { PipelineContext } from '@/pipeline/pipeline.context';
import { SchemaRetry } from '@/reliability/schema-retry';

import { BaseAgent } from './base.agent';

/**
 * GeneratorAgent — Stage 3.
 * Generates a React component that covers all required states and uses
 * only DS tokens and components.
 *
 * Model: MODEL_GENERATOR (Sonnet) — code generation with DS constraints.
 * Implemented in step 10.
 */
@Injectable()
export class GeneratorAgent extends BaseAgent<AnalyzerOutput, GeneratorOutput> {
  constructor(
    @Inject(LLM_PROVIDER) llm: LLMProvider,
    prompts: PromptLoaderService,
    schemaRetry: SchemaRetry,
    private readonly ds: DesignSystemService,
  ) {
    super('GeneratorAgent', llm, prompts, schemaRetry);
  }

  async run(input: AnalyzerOutput, context: PipelineContext): Promise<GeneratorOutput> {
    const { componentSpecs, cssVariableValues, importBase } = this.ds.getContext();

    const cssWithValues = Object.entries(cssVariableValues)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    return this.generate({
      promptName: '03-generator',
      variables: {
        analyzer_output: JSON.stringify(
          { ...context.parserOutput, gap_analysis: input.gap_analysis },
          null,
          2,
        ),
        component_specs: JSON.stringify(componentSpecs, null, 2),
        css_variables_with_values: cssWithValues,
        token_convention: '--{category}-{key}, e.g. --color-brand-primary',
        import_convention: `import { ComponentName } from '${importBase}'`,
      },
      schema: GeneratorOutputSchema,
      model: process.env.MODEL_GENERATOR ?? 'claude-sonnet-4-6',
      maxTokens: 8192,
    });
  }
}
