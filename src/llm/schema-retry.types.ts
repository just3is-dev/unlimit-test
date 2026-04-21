/**
 * Callback type for a single LLM attempt.
 *
 * @param feedbackPrompt - On retry, contains a description of the previous
 *   failure so the model can correct itself. Undefined on the first attempt.
 */
export type AttemptFn<T> = (feedbackPrompt?: string) => Promise<T>;

export interface SchemaRetryOptions {
  /** Total attempts including the first (1 = no retries, 3 = first + 2 retries). Defaults to MAX_SCHEMA_RETRIES env or 3. */
  maxAttempts?: number;
}
