import { Injectable, Logger } from '@nestjs/common';

import { AnalyzerAgent } from '@/agents/analyzer.agent';
import { GeneratorAgent } from '@/agents/generator.agent';
import { ParserAgent } from '@/agents/parser.agent';
import { ValidatorAgent } from '@/agents/validator.agent';
import { DesignSystemService } from '@/design-system/design-system.service';
import { LLMJudge } from '@/reliability/llm-judge';

import { PipelineContext } from './pipeline.context';
import { FinalOutput } from './schemas';

/**
 * PipelineService — the single orchestrator for the 4-stage pipeline.
 *
 * All three interfaces (HTTP, CLI, MCP) are thin facades over this service.
 * See ADR-004 for why three interfaces share one service.
 *
 * Flow:
 *   description → Parser → Analyzer → Generator → Validator → [LLMJudge] → FinalOutput
 *
 * Each stage writes its output to PipelineContext. Stages are sequential
 * (each depends on the previous). The context is discarded after the call.
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly ds: DesignSystemService,
    private readonly parser: ParserAgent,
    private readonly analyzer: AnalyzerAgent,
    private readonly generator: GeneratorAgent,
    private readonly validator: ValidatorAgent,
    private readonly judge: LLMJudge,
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

    // Stage 3 — Generator
    this.logger.log('Stage 3/4: Generator');
    context.generatorOutput = await this.generator.run(context.analyzerOutput, context);

    // Stage 4 — Validator
    this.logger.log('Stage 4/4: Validator');
    context.validatorOutput = await this.validator.run(context.generatorOutput, context);

    // Stage 5 — LLMJudge (opt-in via USE_LLM_JUDGE=true)
    context.judgeOutput = await this.judge.evaluate(description, context.generatorOutput);

    this.logger.log('Pipeline complete');
    return context.toFinalOutput();
  }
}
