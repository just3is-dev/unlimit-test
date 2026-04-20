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
