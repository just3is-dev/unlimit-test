import { Injectable, Logger } from '@nestjs/common';

import { AnalyzerAgent } from '@/agents/analyzer.agent';
import { GeneratorAgent } from '@/agents/generator.agent';
import { ParserAgent } from '@/agents/parser.agent';
import { ValidatorAgent } from '@/agents/validator.agent';
import { DesignSystemService } from '@/design-system/design-system.service';
import { A11yGuard } from '@/reliability/a11y-guard';
import { HallucinationGuard } from '@/reliability/hallucination-guard';
import { StateCoverageGuard } from '@/reliability/state-coverage-guard';

import { PipelineContext } from './pipeline.context';
import { FinalOutput } from './pipeline.schemas';

/**
 * PipelineService — the single orchestrator for the 4-stage pipeline.
 *
 * Two interfaces (HTTP, CLI) are thin facades over this service.
 *
 * Flow:
 *   description → Parser → Analyzer → Generator → Validator → FinalOutput
 *
 * Each stage writes its output to PipelineContext. Stages are sequential
 * (each depends on the previous). The context is discarded after the call.
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  /**
   * How many times to retry the Generator after a guard failure.
   * Total Generator calls = 1 (initial) + MAX_GENERATOR_RETRIES.
   */
  private static readonly MAX_GENERATOR_RETRIES = 1;

  constructor(
    private readonly ds: DesignSystemService,
    private readonly parser: ParserAgent,
    private readonly analyzer: AnalyzerAgent,
    private readonly generator: GeneratorAgent,
    private readonly validator: ValidatorAgent,
    private readonly hallucinationGuard: HallucinationGuard,
    private readonly stateCoverageGuard: StateCoverageGuard,
    private readonly a11yGuard: A11yGuard,
  ) {}

  async run(description: string): Promise<FinalOutput> {
    this.logger.log(`Pipeline start — input length: ${description.length} chars`);
    const context = new PipelineContext(description, this.ds.getContext());

    // Stage 1 — Parser
    this.logger.log('Stage 1/4: Parser');
    context.parserOutput = await this.parser.run(description, context);

    // Stage 2 — Analyzer
    this.logger.log('Stage 2/4: Analyzer');
    context.analyzerOutput = await this.analyzer.run(context.parserOutput, context);

    // Stage 3 — Generator with guard-feedback retry loop.
    //
    // Guards run AFTER every Generator call (including the last retry), so
    // context.hallucinationResult / coverageResult / a11yResult always reflect
    // the actual final output. ValidatorAgent reads them from context instead of
    // re-running the same checks a second time.
    this.logger.log('Stage 3/4: Generator');
    context.generatorOutput = await this.generator.run(context.analyzerOutput, context);

    for (let attempt = 0; attempt <= PipelineService.MAX_GENERATOR_RETRIES; attempt++) {
      const { files, states_covered } = context.generatorOutput.generated_code;

      context.hallucinationResult = this.hallucinationGuard.check(files);
      context.coverageResult = this.stateCoverageGuard.check(
        context.requiredStates,
        states_covered,
        files,
      );
      context.a11yResult = this.a11yGuard.check(files);

      const allPassed =
        context.hallucinationResult.passed &&
        context.coverageResult.passed &&
        context.a11yResult.passed;

      if (allPassed || attempt === PipelineService.MAX_GENERATOR_RETRIES) break;

      const feedback = [
        context.hallucinationResult.feedbackPrompt,
        context.coverageResult.feedbackPrompt,
        context.a11yResult.feedbackPrompt,
      ]
        .filter(Boolean)
        .join('\n\n');

      this.logger.warn(
        `Stage 3 retry ${attempt + 1}/${PipelineService.MAX_GENERATOR_RETRIES} — ` +
          `hallucinations=${!context.hallucinationResult.passed}, ` +
          `stateCoverage=${!context.coverageResult.passed}, ` +
          `a11y=${!context.a11yResult.passed}`,
      );

      context.generatorOutput = await this.generator.run(context.analyzerOutput, context, feedback);
    }

    // Stage 4 — Validator
    this.logger.log('Stage 4/4: Validator');
    context.validatorOutput = await this.validator.run(context.generatorOutput, context);

    this.logger.log('Pipeline complete');
    return context.toFinalOutput();
  }
}
