import { z } from 'zod';

/**
 * Options for a single structured-output LLM call.
 *
 * @template S - Zod schema that defines the expected output shape.
 */
export interface GenerateObjectOptions<S extends z.ZodType> {
  /** Provider-specific model identifier, e.g. "claude-haiku-4-5". */
  model: string;
  /** System-level instruction (role, constraints, DS context). */
  system: string;
  /** User-turn prompt (the actual request). */
  prompt: string;
  /** Zod schema — validated against the LLM response. */
  schema: S;
  /** Max tokens in the completion. Defaults to 4096. */
  maxTokens?: number;
  /** Sampling temperature. Defaults to 0 for deterministic structured output. */
  temperature?: number;
}

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
