import { Injectable, Logger } from '@nestjs/common';

import { PipelineContext } from '@/pipeline/pipeline.context';
import { GeneratorOutput, ValidatorOutput } from '@/pipeline/pipeline.schemas';
import { A11yGuard } from '@/reliability/a11y-guard';
import { HallucinationGuard } from '@/reliability/hallucination-guard';
import { StateCoverageGuard } from '@/reliability/state-coverage-guard';

/**
 * ValidatorAgent — Stage 4 (deterministic).
 *
 * Aggregates results from three independent guards run against the generated code:
 *   1. HallucinationGuard   — CSS vars and components against DS allow-list
 *   2. StateCoverageGuard   — all required states present in code
 *   3. A11yGuard            — component-specific accessibility rules
 *
 * Does NOT call an LLM. QualityEvaluator is a separate opt-in step.
 * See ADR-002 for the deterministic-first reliability rationale.
 */
@Injectable()
export class ValidatorAgent {
  private readonly logger = new Logger(ValidatorAgent.name);

  constructor(
    private readonly hallucinationGuard: HallucinationGuard,
    private readonly stateCoverageGuard: StateCoverageGuard,
    private readonly a11yGuard: A11yGuard,
  ) {}

  async run(input: GeneratorOutput, context: PipelineContext): Promise<ValidatorOutput> {
    const { files, states_covered } = input.generated_code;

    // ── 1. HallucinationGuard ──────────────────────────────────────────────
    const halResult = this.hallucinationGuard.check(files);
    const hallucinations: string[] = [
      ...halResult.unknownCssVars.map((v) => `Unknown CSS variable: ${v}`),
      ...halResult.unknownComponents.map((c) => `Unknown component: ${c}`),
      ...halResult.unknownIconNames.map((n) => `Unknown icon name: "${n}"`),
    ];

    if (!halResult.passed) {
      this.logger.warn(`HallucinationGuard: ${hallucinations.length} violation(s)`);
    }

    // ── 2. StateCoverageGuard ─────────────────────────────────────────────
    const covResult = this.stateCoverageGuard.check(context.requiredStates, states_covered, files);
    const coverageIssues = covResult.missingInCode.map(
      (s) => `State not implemented in code: "${s}"`,
    );

    if (!covResult.passed) {
      this.logger.warn(`StateCoverageGuard: ${coverageIssues.length} missing state(s)`);
    }

    // ── 3. A11yGuard ──────────────────────────────────────────────────────
    const a11yResult = this.a11yGuard.check(files);

    if (!a11yResult.passed) {
      this.logger.warn(`A11yGuard: ${a11yResult.issues.length} issue(s)`);
    }

    // ── Assemble result ───────────────────────────────────────────────────
    const issues = [...coverageIssues, ...a11yResult.issues];

    this.logger.log(
      `Validation complete — hallucinations: ${hallucinations.length}, ` +
        `coverage: ${covResult.ratio}, a11y: ${a11yResult.score}`,
    );

    return {
      validation: {
        token_compliance: halResult.passed,
        states_coverage: covResult.ratio,
        accessibility_score: a11yResult.score,
        issues_found: issues,
        hallucinations_caught: hallucinations,
      },
    };
  }
}
