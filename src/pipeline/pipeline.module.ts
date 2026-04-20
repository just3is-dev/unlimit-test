import { Module } from '@nestjs/common';

import { AnalyzerAgent } from '@/agents/analyzer.agent';
import { GeneratorAgent } from '@/agents/generator.agent';
import { ParserAgent } from '@/agents/parser.agent';
import { ValidatorAgent } from '@/agents/validator.agent';
import { DesignSystemModule } from '@/design-system/design-system.module';
import { LlmModule } from '@/llm/llm.module';
import { SchemaRetry } from '@/llm/schema-retry';
import { A11yGuard } from '@/reliability/a11y-guard';
import { HallucinationGuard } from '@/reliability/hallucination-guard';
import { StateCoverageGuard } from '@/reliability/state-coverage-guard';

import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [DesignSystemModule, LlmModule],
  controllers: [PipelineController],
  providers: [
    SchemaRetry,
    HallucinationGuard,
    A11yGuard,
    StateCoverageGuard,
    ParserAgent,
    AnalyzerAgent,
    GeneratorAgent,
    ValidatorAgent,
    PipelineService,
  ],
  exports: [PipelineService],
})
export class PipelineModule {}
