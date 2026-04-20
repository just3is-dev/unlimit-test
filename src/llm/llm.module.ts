import { Module } from '@nestjs/common';

import { AnthropicProvider } from './anthropic.provider';
import { LLM_PROVIDER } from './llm.provider';
import { PromptLoaderService } from './prompt-loader.service';

/**
 * LlmModule — provides the LLMProvider under the `LLM_PROVIDER` token,
 * and PromptLoaderService for all agents that need prompt templates.
 *
 * To swap to a different backend (e.g. OpenAI), replace `AnthropicProvider`
 * here — nothing else changes. All agents inject `LLM_PROVIDER`, not the
 * concrete class.
 */
@Module({
  providers: [
    {
      provide: LLM_PROVIDER,
      useClass: AnthropicProvider,
    },
    PromptLoaderService,
  ],
  exports: [LLM_PROVIDER, PromptLoaderService],
})
export class LlmModule {}
