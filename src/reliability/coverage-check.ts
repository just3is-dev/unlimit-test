import { Injectable, Logger } from '@nestjs/common';

import { StateCovered } from '@/pipeline/schemas';

import { CSS_STATE_PATTERNS, FUNCTIONAL_STATE_PATTERNS } from './coverage-check.patterns';
import { CoverageResult } from './coverage-check.types';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * CoverageCheck — verifies that every required state is expressed in the
 * generated code using the appropriate pattern for its kind.
 *
 * State kinds (from paper-prototype.md §Выводы #3):
 *   css        → pseudo-classes / aria-attributes (:hover, aria-pressed, [disabled])
 *   functional → conditional JSX ({loading && <Spinner />})
 *
 * Required states = specified_states ∪ missing_states (from PipelineContext.requiredStates).
 * The GeneratorOutput.states_covered[] provides the claimed coverage with kind tags.
 *
 * Two-layer check:
 *   1. Claimed: is the state in states_covered[]?
 *   2. Actual:  does the code contain the expected pattern for that state's kind?
 * Both must pass. This prevents the model from claiming coverage it didn't implement.
 */
@Injectable()
export class CoverageCheck {
  private readonly logger = new Logger(CoverageCheck.name);

  check(
    requiredStates: string[],
    statesCovered: StateCovered[],
    files: Array<{ filename: string; content: string }>,
  ): CoverageResult {
    const code = files.map((f) => f.content).join('\n');
    const coveredMap = new Map(statesCovered.map((s) => [s.name, s.kind]));

    const missingInCode: string[] = [];

    for (const state of requiredStates) {
      // Skip "default" — base state is always considered present
      if (state === 'default') continue;

      const kind = coveredMap.get(state);

      if (!kind) {
        // Not even claimed by the generator
        missingInCode.push(state);
        continue;
      }

      if (!this.stateFoundInCode(state, kind, code)) {
        missingInCode.push(state);
      }
    }

    const effectiveRequired = requiredStates.filter((s) => s !== 'default').length;
    const covered = effectiveRequired - missingInCode.length;
    const passed = missingInCode.length === 0;

    if (!passed) {
      this.logger.warn(
        `Coverage incomplete: ${covered}/${effectiveRequired} — missing: [${missingInCode.join(', ')}]`,
      );
    }

    return {
      ratio: `${covered}/${effectiveRequired}`,
      covered,
      required: effectiveRequired,
      missingInCode,
      passed,
      feedbackPrompt: passed ? '' : this.buildFeedback(missingInCode, coveredMap),
    };
  }

  private stateFoundInCode(state: string, kind: 'css' | 'functional', code: string): boolean {
    const patterns =
      kind === 'css'
        ? (CSS_STATE_PATTERNS[state] ?? [new RegExp(state, 'i')])
        : (FUNCTIONAL_STATE_PATTERNS[state] ?? [new RegExp(state, 'i')]);

    return patterns.some((re) => re.test(code));
  }

  private buildFeedback(
    missingInCode: string[],
    coveredMap: Map<string, 'css' | 'functional'>,
  ): string {
    const lines = [
      'The following required states are missing or not implemented correctly in the code:',
      '',
    ];

    for (const state of missingInCode) {
      const kind = coveredMap.get(state);
      if (kind === 'css') {
        lines.push(`  - "${state}" (CSS state): add :${state} pseudo-class or aria attribute`);
      } else if (kind === 'functional') {
        lines.push(
          `  - "${state}" (functional): add conditional JSX — e.g. {is${capitalize(state)} && <...>}`,
        );
      } else {
        lines.push(
          `  - "${state}": not claimed in states_covered — add it with the correct kind`,
        );
      }
    }

    lines.push('');
    lines.push('Regenerate the component ensuring all listed states are visibly implemented.');
    return lines.join('\n');
  }
}
