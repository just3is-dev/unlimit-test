import { Inject, Injectable, Logger } from '@nestjs/common';

import { LLM_PROVIDER, LLMProvider } from '@/llm/llm.provider';
import { PromptLoaderService } from '@/llm/prompt-loader.service';
import {
  GeneratorOutput,
  QualityEvaluatorOutput,
  QualityEvaluatorOutputSchema,
} from '@/pipeline/pipeline.schemas';
import { SchemaRetry } from '@/reliability/schema-retry';

/**
 * QualityEvaluator — opt-in Stage 5 (enabled via USE_QUALITY_EVALUATOR=true).
 *
 * Provides a qualitative 0-100 a11y + code-quality assessment on top of the
 * deterministic ValidatorAgent. Returns a structured score with per-category
 * breakdown, issues, and strengths.
 *
 * Intentionally separate from ValidatorAgent so the deterministic pipeline
 * can run fast without an extra LLM call in normal operation.
 * See ADR-002 for the deterministic-first rationale.
 */
@Injectable()
export class QualityEvaluator {
  private readonly logger = new Logger(QualityEvaluator.name);
  private readonly enabled = process.env.USE_QUALITY_EVALUATOR === 'true';

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LLMProvider,
    private readonly prompts: PromptLoaderService,
    private readonly schemaRetry: SchemaRetry,
  ) {}

  /**
   * Returns a structured evaluation, or `undefined` if USE_QUALITY_EVALUATOR is not set.
   *
   * @param description  - Original component description (user input)
   * @param generator    - Full generator output (files + states + tokens)
   */
  async evaluate(
    description: string,
    generator: GeneratorOutput,
  ): Promise<QualityEvaluatorOutput | undefined> {
    if (!this.enabled) return undefined;

    this.logger.log('QualityEvaluator enabled — evaluating generated code');

    const { files, states_covered, tokens_used } = generator.generated_code;

    const evaluatorInput = JSON.stringify({
      component_description: description,
      generated_code: files.map((f) => f.content).join('\n\n'),
      states_required: states_covered.map((s) => s.name),
      tokens_used,
    });

    const system = this.prompts.load('04-validator-judge', { judge_input: evaluatorInput });

    const result = await this.schemaRetry.run(async (feedbackPrompt?: string) => {
      const prompt = feedbackPrompt
        ? `Evaluate the component above.\n\n---\n${feedbackPrompt}`
        : 'Evaluate the component above.';

      return this.llm.generateObject({
        model: process.env.MODEL_QUALITY_EVALUATOR ?? 'claude-haiku-4-5',
        system,
        prompt,
        schema: QualityEvaluatorOutputSchema,
      });
    }, QualityEvaluatorOutputSchema);

    this.logger.log(`QualityEvaluator score: ${result.score}/100`);
    return result;
  }
}
