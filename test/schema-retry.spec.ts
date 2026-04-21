import { z } from 'zod';

import { SchemaRetry } from '@/llm/schema-retry';

const schema = z.object({
  name: z.string(),
  value: z.number(),
});

describe('SchemaRetry', () => {
  let retry: SchemaRetry;

  beforeEach(() => {
    // Set MAX_SCHEMA_RETRIES via env so SchemaRetry picks it up
    process.env.MAX_SCHEMA_RETRIES = '3';
    retry = new SchemaRetry();
  });

  it('returns result immediately when first attempt is valid', async () => {
    const fn = jest.fn().mockResolvedValue({ name: 'foo', value: 42 });

    const result = await retry.run(fn, schema);

    expect(result).toEqual({ name: 'foo', value: 42 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(undefined); // no feedback on first attempt
  });

  it('retries with feedback when first attempt fails schema', async () => {
    const fn = jest
      .fn()
      .mockResolvedValueOnce({ name: 123, value: 'not-a-number' }) // invalid
      .mockResolvedValueOnce({ name: 'bar', value: 7 }); // valid

    const result = await retry.run(fn, schema);

    expect(result).toEqual({ name: 'bar', value: 7 });
    expect(fn).toHaveBeenCalledTimes(2);

    // Second call must receive a non-empty feedback string
    const feedbackArg = fn.mock.calls[1][0] as string;
    expect(typeof feedbackArg).toBe('string');
    expect(feedbackArg.length).toBeGreaterThan(0);
    expect(feedbackArg).toContain('failed JSON schema validation');
  });

  it('feedback message includes the specific field path and error', async () => {
    const fn = jest
      .fn()
      .mockResolvedValueOnce({ name: 123, value: 'bad' }) // both fields wrong
      .mockResolvedValueOnce({ name: 'ok', value: 1 });

    await retry.run(fn, schema);

    const feedback = fn.mock.calls[1][0] as string;
    // Should mention the failing paths
    expect(feedback).toContain('name');
    expect(feedback).toContain('value');
  });

  it('throws after exhausting maxAttempts', async () => {
    const fn = jest.fn().mockResolvedValue({ wrong: true }); // always invalid

    await expect(retry.run(fn, schema, { maxAttempts: 2 })).rejects.toThrow(
      'SchemaRetry exhausted 2 attempts',
    );
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('respects maxAttempts override over env default', async () => {
    process.env.MAX_SCHEMA_RETRIES = '5';
    retry = new SchemaRetry();

    const fn = jest.fn().mockResolvedValue({ wrong: true });

    await expect(retry.run(fn, schema, { maxAttempts: 1 })).rejects.toThrow(
      'SchemaRetry exhausted 1 attempts',
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('no feedback prompt on the first attempt', async () => {
    const fn = jest.fn().mockResolvedValue({ name: 'x', value: 0 });

    await retry.run(fn, schema);

    expect(fn.mock.calls[0][0]).toBeUndefined();
  });
});
