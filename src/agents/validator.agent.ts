import { Injectable, Logger } from '@nestjs/common';

import { PipelineContext } from '@/pipeline/pipeline.context';
import { GeneratorOutput, ValidatorOutput } from '@/pipeline/pipeline.schemas';

/**
 * ValidatorAgent — Stage 4 (deterministic).
 *
 * Assembles the final validation report from guard results already stored in
 * PipelineContext by PipelineService. All three guards run exactly once per
 * request — in the Stage 3 retry loop — and their results are passed here via
 * context rather than being re-executed.
 *
 * Does NOT call an LLM. QualityEvaluator is a separate opt-in step.
 * See ADR-002 for the deterministic-first reliability rationale.
 */
@Injectable()
export class ValidatorAgent {
  private readonly logger = new Logger(ValidatorAgent.name);

  async run(_input: GeneratorOutput, context: PipelineContext): Promise<ValidatorOutput> {
    const { hallucinationResult, coverageResult, a11yResult } = context;

    if (!hallucinationResult || !coverageResult || !a11yResult) {
      throw new Error(
        'ValidatorAgent: guard results missing from context — guards must run before Stage 4',
      );
    }

    // ── 1. HallucinationGuard ──────────────────────────────────────────────
    const hallucinations: string[] = [
      ...hallucinationResult.unknownCssVars.map((v) => `Unknown CSS variable: ${v}`),
      ...hallucinationResult.unknownComponents.map((c) => `Unknown component: ${c}`),
      ...hallucinationResult.unknownIconNames.map((n) => `Unknown icon name: "${n}"`),
    ];

    if (!hallucinationResult.passed) {
      this.logger.warn(`HallucinationGuard: ${hallucinations.length} violation(s)`);
    }

    // ── 2. StateCoverageGuard ─────────────────────────────────────────────
    const coverageIssues = coverageResult.missingInCode.map(
      (s) => `State not implemented in code: "${s}"`,
    );

    if (!coverageResult.passed) {
      this.logger.warn(`StateCoverageGuard: ${coverageIssues.length} missing state(s)`);
    }

    // ── 3. A11yGuard ──────────────────────────────────────────────────────
    if (!a11yResult.passed) {
      this.logger.warn(`A11yGuard: ${a11yResult.issues.length} issue(s)`);
    }

    // ── Assemble result ───────────────────────────────────────────────────
    const issues = [...coverageIssues, ...a11yResult.issues];

    this.logger.log(
      `Validation complete — hallucinations: ${hallucinations.length}, ` +
        `coverage: ${coverageResult.ratio}, a11y: ${a11yResult.score}`,
    );

    return {
      validation: {
        token_compliance: hallucinationResult.passed,
        states_coverage: coverageResult.ratio,
        accessibility_score: a11yResult.score,
        issues_found: issues,
        hallucinations_caught: hallucinations,
      },
    };
  }
}
