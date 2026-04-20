import { Inject, Injectable } from '@nestjs/common';

import { DesignSystemService } from '@/design-system/design-system.service';
import { LLM_PROVIDER, LLMProvider } from '@/llm/llm.provider';
import { PromptLoaderService } from '@/llm/prompt-loader.service';
import { PipelineContext } from '@/pipeline/pipeline.context';
import { AnalyzerOutput, GeneratorOutput, GeneratorOutputSchema } from '@/pipeline/schemas';
import { SchemaRetry } from '@/reliability/schema-retry';

import { BaseAgent } from './base.agent';

/**
 * GeneratorAgent — Stage 3.
 *
 * Generates a React functional component that:
 *   - Uses only DS tokens (var(--...)) and components (from @unlimit/ui)
 *   - Covers all states from specified_states + missing_states
 *   - Tags each state with kind: 'css' | 'functional' for StateCoverageGuard
 *
 * DS context injected: component specs, CSS variable values, conventions.
 * maxTokens = 16000 — complex multi-step components (KYC wizard, etc.) can be long.
 *
 * Model: MODEL_GENERATOR (Sonnet) — code generation with DS constraints.
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

  async run(
    input: AnalyzerOutput,
    context: PipelineContext,
    externalFeedback?: string,
  ): Promise<GeneratorOutput> {
    const { componentSpecs, cssVariableValues, importBase } = this.ds.getContext();

    const cssWithValues = Object.entries(cssVariableValues)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    // Combine parser + analyzer output as the user-turn input
    const basePrompt = JSON.stringify(
      {
        component: context.parserOutput?.component,
        extraction: context.parserOutput?.extraction,
        gap_analysis: input.gap_analysis,
      },
      null,
      2,
    );

    // On retry: append guard feedback so the model can fix specific issues
    const userPrompt = externalFeedback
      ? `${basePrompt}\n\n---\nPREVIOUS ATTEMPT ISSUES (fix all before regenerating):\n${externalFeedback}`
      : basePrompt;

    return this.generate({
      promptName: '03-generator',
      systemVars: {
        component_specs: JSON.stringify(componentSpecs, null, 2),
        css_variables_with_values: cssWithValues,
        token_convention: '--{category}-{key}, e.g. --color-brand-primary',
        import_convention: `import { ComponentName } from '${importBase}'`,
      },
      userPrompt,
      schema: GeneratorOutputSchema,
      model: process.env.MODEL_GENERATOR ?? 'claude-sonnet-4-6',
      maxTokens: 16000,
    });
  }
}
