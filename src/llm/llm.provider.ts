import { z } from 'zod';

import type { GenerateObjectOptions } from './llm.types';

export type { GenerateObjectOptions } from './llm.types';

/**
 * LLMProvider — thin abstraction over any LLM backend.
 *
 * Concrete implementations (AnthropicProvider, OpenAIProvider, …) are
 * registered in LlmModule and injected by token `LLM_PROVIDER`.
 *
 * The abstraction deliberately exposes only `generateObject` — the single
 * primitive used by every agent. This keeps the swap surface minimal.
 */
export abstract class LLMProvider {
  /**
   * Call the LLM and validate the response against `options.schema`.
   * Returns the Zod-inferred type on success.
   * Throws on API error or schema mismatch (SchemaRetry wraps this).
   */
  abstract generateObject<S extends z.ZodType>(
    options: GenerateObjectOptions<S>,
  ): Promise<z.infer<S>>;
}

/** DI injection token — use instead of the class to keep it swappable. */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
