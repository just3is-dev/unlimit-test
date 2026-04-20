import { Inject, Injectable, Logger } from '@nestjs/common';

import { LLM_PROVIDER, LLMProvider } from '@/llm/llm.provider';
import { PromptLoaderService } from '@/llm/prompt-loader.service';
import { GeneratorOutput, LLMJudgeOutput, LLMJudgeOutputSchema } from '@/pipeline/schemas';
import { SchemaRetry } from '@/reliability/schema-retry';

/**
 * LLMJudge — opt-in Stage 5 (enabled via USE_LLM_JUDGE=true).
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
export class LLMJudge {
  private readonly logger = new Logger(LLMJudge.name);
  private readonly enabled = process.env.USE_LLM_JUDGE === 'true';

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LLMProvider,
    private readonly prompts: PromptLoaderService,
    private readonly schemaRetry: SchemaRetry,
  ) {}

  /**
   * Returns a structured judgement, or `undefined` if USE_LLM_JUDGE is not set.
   *
   * @param description  - Original component description (user input)
   * @param generator    - Full generator output (files + states + tokens)
   */
  async evaluate(
    description: string,
    generator: GeneratorOutput,
  ): Promise<LLMJudgeOutput | undefined> {
    if (!this.enabled) return undefined;

    this.logger.log('LLMJudge enabled — evaluating generated code');

    const { files, states_covered, tokens_used } = generator.generated_code;

    const judgeInput = JSON.stringify({
      component_description: description,
      generated_code: files.map((f) => f.content).join('\n\n'),
      states_required: states_covered.map((s) => s.name),
      tokens_used,
    });

    const system = this.prompts.load('04-validator-judge', { judge_input: judgeInput });

    const result = await this.schemaRetry.run(async (feedbackPrompt?: string) => {
      const prompt = feedbackPrompt
        ? `Evaluate the component above.\n\n---\n${feedbackPrompt}`
        : 'Evaluate the component above.';

      return this.llm.generateObject({
        model: process.env.MODEL_JUDGE ?? 'claude-haiku-4-5',
        system,
        prompt,
        schema: LLMJudgeOutputSchema,
      });
    }, LLMJudgeOutputSchema);

    this.logger.log(`LLMJudge score: ${result.score}/100`);
    return result;
  }
}
