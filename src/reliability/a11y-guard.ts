import { Injectable, Logger } from '@nestjs/common';

import { DesignSystemService } from '@/design-system/design-system.service';

import { COMPONENT_A11Y_RULES } from './a11y-guard.rules';
import type { A11yResult } from './a11y-guard.types';

export type { A11yResult } from './a11y-guard.types';

/**
 * A11yGuard — deterministic post-check on generated code.
 *
 * Runs component-specific accessibility rules from `a11y-guard.rules.ts` against
 * the generated TSX. Each rule corresponds to an `a11y` constraint in
 * `components.json` that can be verified statically via regex.
 *
 * Only DS components actually imported in the generated code are checked —
 * rules for unused components are skipped.
 *
 * Returns a structured result with `feedbackPrompt` so PipelineService can
 * feed a11y failures back into the Generator retry loop, matching the same
 * contract as HallucinationGuard and StateCoverageGuard.
 *
 * See ADR-002 for the deterministic-first reliability rationale.
 */
@Injectable()
export class A11yGuard {
  private readonly logger = new Logger(A11yGuard.name);

  // Matches: import { Button, Card } from '@unlimit/ui'
  private static readonly IMPORT_RE = /import\s*\{([^}]+)\}\s*from\s*['"]@unlimit\/ui['"]/g;

  constructor(private readonly ds: DesignSystemService) {}

  /**
   * Run all applicable a11y rules against the generated files.
   * @param files - Array of { filename, content } from GeneratorOutput
   */
  check(files: Array<{ filename: string; content: string }>): A11yResult {
    const allCode = files.map((f) => f.content).join('\n');
    const usedComponents = this.extractUsedComponents(allCode);

    const issues: string[] = [];
    let totalChecks = 0;

    for (const component of usedComponents) {
      const rules = COMPONENT_A11Y_RULES[component] ?? [];
      totalChecks += rules.length;
      for (const rule of rules) {
        if (!rule.test(allCode)) {
          issues.push(rule.description);
        }
      }
    }

    const passedChecks = totalChecks - issues.length;
    const passed = issues.length === 0;

    if (!passed) {
      this.logger.warn(`A11y issues: [${issues.join(' | ')}]`);
    }

    return {
      passed,
      totalChecks,
      passedChecks,
      score: `${passedChecks}/${totalChecks}`,
      issues,
      feedbackPrompt: passed ? '' : this.buildFeedback(issues),
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns DS component names that are actually imported in the generated code.
   * Only components present in the DS allow-list are returned — unknown imports
   * are handled by HallucinationGuard, not here.
   */
  private extractUsedComponents(code: string): string[] {
    const { componentNames } = this.ds.getContext();
    const used = new Set<string>();

    for (const match of code.matchAll(A11yGuard.IMPORT_RE)) {
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

  private buildFeedback(issues: string[]): string {
    const lines = ['The generated component has accessibility issues that must be fixed:', ''];

    issues.forEach((issue) => lines.push(`  - ${issue}`));
    lines.push('');
    lines.push(
      'Fix these issues and regenerate the component ensuring all accessibility requirements are met.',
    );

    return lines.join('\n');
  }
}
