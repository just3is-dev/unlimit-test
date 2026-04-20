import { Module } from '@nestjs/common';

import { DesignSystemModule } from '@/design-system/design-system.module';
import { LlmModule } from '@/llm/llm.module';
import { PipelineModule } from '@/pipeline/pipeline.module';

/**
 * Root application module.
 *
 * Feature modules:
 *   - DesignSystemModule
 *   - LlmModule
 *   - PipelineModule
 */
@Module({
  imports: [DesignSystemModule, LlmModule, PipelineModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
