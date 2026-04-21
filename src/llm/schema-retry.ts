import { z } from 'zod';
import { Injectable, Logger } from '@nestjs/common';

import type { AttemptFn, SchemaRetryOptions } from './schema-retry.types';

export type { AttemptFn, SchemaRetryOptions } from './schema-retry.types';

/**
 * SchemaRetry — reliability wrapper for LLM calls that must conform to a Zod schema.
 *
 * Strategy:
 *  1. Call `fn()` (no feedback on first attempt).
 *  2. Validate the result against `schema`.
 *  3. On failure, build a feedback prompt describing the exact Zod error.
 *  4. Call `fn(feedbackPrompt)` and repeat up to `maxAttempts` times.
 *  5. Throw if all attempts are exhausted.
 *
 * This is the primary LLM reliability mechanism (see ADR-002).
 * HallucinationGuard and StateCoverageGuard add separate re-prompt loops on top.
 */
@Injectable()
export class SchemaRetry {
  private readonly logger = new Logger(SchemaRetry.name);

  private readonly defaultMaxAttempts: number = Math.max(
    1,
    parseInt(process.env.MAX_SCHEMA_RETRIES ?? '3', 10),
  );

  async run<S extends z.ZodType>(
    fn: AttemptFn<unknown>,
    schema: S,
    options: SchemaRetryOptions = {},
  ): Promise<z.infer<S>> {
    const maxAttempts = options.maxAttempts ?? this.defaultMaxAttempts;
    let lastError: z.ZodError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const feedbackPrompt = lastError ? this.buildFeedback(lastError, attempt) : undefined;

      if (feedbackPrompt) {
        this.logger.warn(`Attempt ${attempt}/${maxAttempts} — retrying with schema feedback`);
      }

      const raw = await fn(feedbackPrompt);
      const parsed = schema.safeParse(raw);

      if (parsed.success) {
        if (attempt > 1) {
          this.logger.log(`Schema validated on attempt ${attempt}`);
        }
        return parsed.data;
      }

      lastError = parsed.error;
      this.logger.warn(
        `Attempt ${attempt}/${maxAttempts} failed schema validation: ` +
          parsed.error.issues.map((i) => `${i.path.join('.')} — ${i.message}`).join('; '),
      );
    }

    throw new Error(
      `SchemaRetry exhausted ${maxAttempts} attempts. Last error: ${lastError!.message}`,
    );
  }

  /**
   * Builds a concise feedback prompt from a ZodError so the model knows
   * exactly what to fix on the next attempt.
   */
  private buildFeedback(error: z.ZodError, attempt: number): string {
    const issues = error.issues
      .map((issue) => {
        const path = issue.path.length ? issue.path.join('.') : '(root)';
        return `  - ${path}: ${issue.message}`;
      })
      .join('\n');

    return (
      `Your previous response (attempt ${attempt - 1}) failed JSON schema validation. ` +
      `Fix the following issues and respond with valid JSON only:\n${issues}`
    );
  }
}
