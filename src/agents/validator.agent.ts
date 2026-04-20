import { Injectable } from '@nestjs/common';

import { DesignSystemService } from '@/design-system/design-system.service';
import { PipelineContext } from '@/pipeline/pipeline.context';
import { GeneratorOutput, ValidatorOutput } from '@/pipeline/schemas';

/**
 * ValidatorAgent — Stage 4.
 * Deterministic validation: HallucinationGuard + CoverageCheck + a11y rules.
 * Does NOT call an LLM (unless USE_LLM_JUDGE=true, handled by LLMJudge).
 *
 * Implemented in step 13.
 */
@Injectable()
export class ValidatorAgent {
  constructor(private readonly ds: DesignSystemService) {}

  async run(_input: GeneratorOutput, _context: PipelineContext): Promise<ValidatorOutput> {
    // Stub: returns a passing validation result.
    // Real implementation in step 13 wires HallucinationGuard + CoverageCheck.
    const required = _context.requiredStates.length;
    const covered = _input.generated_code.states_covered.length;

    return {
      validation: {
        token_compliance: true,
        states_coverage: `${Math.min(covered, required)}/${required}`,
        accessibility_score: '0/0',
        issues_found: [],
        hallucinations_caught: [],
      },
    };
  }
}
