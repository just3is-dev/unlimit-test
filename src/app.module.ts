import { Module } from '@nestjs/common';

import { DesignSystemModule } from '@/design-system/design-system.module';

/**
 * Root application module.
 *
 * Feature modules are registered here as the project grows:
 *   - DesignSystemModule   ✓ (step 2)
 *   - LlmModule            (step 4)
 *   - PipelineModule       (step 7)
 *
 * Each agent is a NestJS provider inside PipelineModule, giving us
 * dependency injection for free — which maps cleanly onto the
 * multi-agent architecture (see ADR-001).
 */
@Module({
  imports: [DesignSystemModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
