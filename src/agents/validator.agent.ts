import { Injectable, Logger } from '@nestjs/common';

import { DesignSystemService } from '@/design-system/design-system.service';
import { PipelineContext } from '@/pipeline/pipeline.context';
import { GeneratorOutput, ValidatorOutput } from '@/pipeline/schemas';
import { CoverageCheck } from '@/reliability/coverage-check';
import { HallucinationGuard } from '@/reliability/hallucination-guard';

import { COMPONENT_A11Y_RULES } from './validator.rules';

/**
 * ValidatorAgent — Stage 4 (deterministic).
 *
 * Runs three independent checks on the generated code:
 *   1. HallucinationGuard — CSS vars and components against DS allow-list
 *   2. CoverageCheck     — all required states present in code
 *   3. A11y rules        — component-specific checks from components.json
 *
 * Does NOT call an LLM. LLMJudge is a separate opt-in step.
 * See ADR-002 for the deterministic-first reliability rationale.
 */
@Injectable()
export class ValidatorAgent {
  private readonly logger = new Logger(ValidatorAgent.name);

  constructor(
    private readonly ds: DesignSystemService,
    private readonly hallucinationGuard: HallucinationGuard,
    private readonly coverageCheck: CoverageCheck,
  ) {}

  async run(input: GeneratorOutput, context: PipelineContext): Promise<ValidatorOutput> {
    const { files, states_covered } = input.generated_code;
    const issues: string[] = [];
    const hallucinations: string[] = [];

    // ── 1. HallucinationGuard ──────────────────────────────────────────────
    const halResult = this.hallucinationGuard.check(files);

    hallucinations.push(
      ...halResult.unknownCssVars.map((v) => `Unknown CSS variable: ${v}`),
      ...halResult.unknownComponents.map((c) => `Unknown component: ${c}`),
      ...halResult.unknownIconNames.map((n) => `Unknown icon name: "${n}"`),
    );

    if (!halResult.passed) {
      this.logger.warn(`HallucinationGuard: ${hallucinations.length} violation(s)`);
    }

    // ── 2. CoverageCheck ──────────────────────────────────────────────────
    const covResult = this.coverageCheck.check(context.requiredStates, states_covered, files);

    if (!covResult.passed) {
      issues.push(...covResult.missingInCode.map((s) => `State not implemented in code: "${s}"`));
    }

    // ── 3. A11y rules ─────────────────────────────────────────────────────
    const allCode = files.map((f) => f.content).join('\n');
    const usedComponents = this.extractUsedComponents(allCode);
    const a11yIssues = this.runA11yRules(usedComponents, allCode);
    issues.push(...a11yIssues);

    // ── Assemble result ───────────────────────────────────────────────────
    const totalA11yChecks = usedComponents.reduce(
      (sum, c) => sum + (COMPONENT_A11Y_RULES[c]?.length ?? 0),
      0,
    );
    const passedA11yChecks = totalA11yChecks - a11yIssues.length;

    this.logger.log(
      `Validation complete — hallucinations: ${hallucinations.length}, ` +
        `coverage: ${covResult.ratio}, a11y: ${passedA11yChecks}/${totalA11yChecks}`,
    );

    return {
      validation: {
        token_compliance: halResult.passed,
        states_coverage: covResult.ratio,
        accessibility_score: `${passedA11yChecks}/${totalA11yChecks}`,
        issues_found: issues,
        hallucinations_caught: hallucinations,
      },
    };
  }

  private extractUsedComponents(code: string): string[] {
    const { componentNames } = this.ds.getContext();
    // Extract component names from @unlimit/ui imports
    const importMatches = code.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]@unlimit\/ui['"]/g);
    const used = new Set<string>();
    for (const match of importMatches) {
      match[1]
        .split(',')
        .map((n) =>
          n
            .trim()
            .split(/\s+as\s+/)[0]
            .trim(),
        )
        .filter((n) => componentNames.includes(n))
        .forEach((n) => used.add(n));
    }
    return [...used];
  }

  private runA11yRules(usedComponents: string[], code: string): string[] {
    const issues: string[] = [];
    for (const component of usedComponents) {
      const rules = COMPONENT_A11Y_RULES[component] ?? [];
      for (const rule of rules) {
        if (!rule.test(code)) {
          issues.push(rule.description);
        }
      }
    }
    return issues;
  }
}
