import { Module } from '@nestjs/common';

import { AnalyzerAgent } from '@/agents/analyzer.agent';
import { GeneratorAgent } from '@/agents/generator.agent';
import { ParserAgent } from '@/agents/parser.agent';
import { ValidatorAgent } from '@/agents/validator.agent';
import { DesignSystemModule } from '@/design-system/design-system.module';
import { LlmModule } from '@/llm/llm.module';
import { CoverageCheck } from '@/reliability/coverage-check';
import { HallucinationGuard } from '@/reliability/hallucination-guard';
import { LLMJudge } from '@/reliability/llm-judge';
import { SchemaRetry } from '@/reliability/schema-retry';

import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [DesignSystemModule, LlmModule],
  controllers: [PipelineController],
  providers: [
    SchemaRetry,
    HallucinationGuard,
    CoverageCheck,
    LLMJudge,
    ParserAgent,
    AnalyzerAgent,
    GeneratorAgent,
    ValidatorAgent,
    PipelineService,
  ],
  exports: [PipelineService],
})
export class PipelineModule {}
