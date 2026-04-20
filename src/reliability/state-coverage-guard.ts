import { Injectable, Logger } from '@nestjs/common';

import { StateCovered } from '@/pipeline/pipeline.schemas';

import { CSS_STATE_PATTERNS, FUNCTIONAL_STATE_PATTERNS } from './state-coverage-guard.patterns';
import { StateCoverageResult } from './state-coverage-guard.types';

export type { StateCoverageResult } from './state-coverage-guard.types';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Extracts the base state key from a possibly annotated state name.
 * The Analyzer often returns states with rationale appended after " — ".
 *
 *   "hover — card should have a distinct hover style"  →  "hover"
 *   "focus-visible — keyboard focus ring must be..."   →  "focus-visible"
 *   "loading"                                          →  "loading"
 */
function normalizeStateName(state: string): string {
  return state.split(' — ')[0].split(' - ')[0].trim();
}

/**
 * StateCoverageGuard — verifies that every required state is expressed in the
 * generated code using the appropriate pattern for its kind.
 *
 * State kinds:
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
 *
 * See ADR-002 for the deterministic-first reliability rationale.
 */
@Injectable()
export class StateCoverageGuard {
  private readonly logger = new Logger(StateCoverageGuard.name);

  check(
    requiredStates: string[],
    statesCovered: StateCovered[],
    files: Array<{ filename: string; content: string }>,
  ): StateCoverageResult {
    const code = files.map((f) => f.content).join('\n');
    // coveredMap keyed by normalized short name, e.g. "hover"
    const coveredMap = new Map(statesCovered.map((s) => [s.name, s.kind]));

    const missingInCode: string[] = [];

    for (const state of requiredStates) {
      // Skip "default" — base state is always considered present
      if (normalizeStateName(state) === 'default') continue;

      // Normalize: "hover — card should have..." → "hover"
      const baseName = normalizeStateName(state);
      const kind = coveredMap.get(baseName);

      if (!kind) {
        // Not even claimed by the generator
        missingInCode.push(state);
        continue;
      }

      if (!this.stateFoundInCode(baseName, kind, code)) {
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
        lines.push(`  - "${state}": not claimed in states_covered — add it with the correct kind`);
      }
    }

    lines.push('');
    lines.push('Regenerate the component ensuring all listed states are visibly implemented.');
    return lines.join('\n');
  }
}
