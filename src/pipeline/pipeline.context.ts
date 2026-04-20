import { DesignSystemContext } from '@/design-system/design-system.types';

import {
  AnalyzerOutput,
  FinalOutput,
  GeneratorOutput,
  LLMJudgeOutput,
  ParserOutput,
  ValidatorOutput,
} from './pipeline.schemas';

/**
 * PipelineContext — shared state threaded through all four pipeline stages.
 *
 * Created once per request by PipelineService and passed to each agent.
 * Agents read previous stages' outputs and write their own.
 *
 * Design notes:
 * - All stage outputs are optional: only set after the stage completes.
 * - `dsContext` is injected at construction time from DesignSystemService
 *   and never mutated — it is read-only design-system context for all agents.
 * - `toFinalOutput()` assembles the task.md-compatible response.
 */
export class PipelineContext {
  /** Original user-provided component description. */
  readonly input: string;

  /** Read-only DS context: CSS vars, component specs, icon names, etc. */
  readonly dsContext: DesignSystemContext;

  parserOutput?: ParserOutput;
  analyzerOutput?: AnalyzerOutput;
  generatorOutput?: GeneratorOutput;
  validatorOutput?: ValidatorOutput;
  judgeOutput?: LLMJudgeOutput;

  constructor(input: string, dsContext: DesignSystemContext) {
    this.input = input;
    this.dsContext = dsContext;
  }

  /**
   * Returns all required states: those specified in the input +
   * those identified as missing by the Analyzer.
   * Used by StateCoverageGuard and ValidatorAgent.
   */
  get requiredStates(): string[] {
    const specified = this.parserOutput?.extraction.specified_states ?? [];
    const missing = this.analyzerOutput?.gap_analysis.missing_states ?? [];
    return [...new Set([...specified, ...missing])];
  }

  /**
   * Assembles the final task.md-compatible output from all stage results.
   * Throws if any stage has not completed yet.
   */
  toFinalOutput(): FinalOutput {
    if (!this.parserOutput) throw new Error('Pipeline incomplete: Parser has not run');
    if (!this.analyzerOutput) throw new Error('Pipeline incomplete: Analyzer has not run');
    if (!this.generatorOutput) throw new Error('Pipeline incomplete: Generator has not run');
    if (!this.validatorOutput) throw new Error('Pipeline incomplete: Validator has not run');

    const { component, extraction } = this.parserOutput;
    const { gap_analysis } = this.analyzerOutput;
    const { generated_code } = this.generatorOutput;
    const { validation } = this.validatorOutput;

    return {
      component,
      extraction,
      gap_analysis,
      generated_code: {
        framework: generated_code.framework,
        files: generated_code.files,
        // Flatten internal {name, kind} → string[], deduplicate (model sometimes repeats entries)
        states_covered: [...new Set(generated_code.states_covered.map((s) => s.name))],
        tokens_used: generated_code.tokens_used,
      },
      validation,
      ...(this.judgeOutput && { judge: this.judgeOutput }),
    };
  }
}
