import { Inject, Logger } from '@nestjs/common';
import { z } from 'zod';

import { PromptLoaderService } from '@/llm/prompt-loader.service';
import { LLM_PROVIDER, LLMProvider } from '@/llm/llm.provider';
import { PipelineContext } from '@/pipeline/pipeline.context';
import { SchemaRetry } from '@/reliability/schema-retry';

/**
 * BaseAgent<TInput, TOutput> — shared infrastructure for all pipeline agents.
 *
 * Each concrete agent (Parser, Analyzer, Generator, Validator) extends this
 * and implements only `run()`. Everything else — prompt loading, LLM call,
 * schema retry — is handled here.
 *
 * DI note: concrete agents are NestJS providers. They call `super()` with
 * the injected dependencies. The `@Inject` decorators here are used as
 * documentation; actual injection happens in each subclass constructor.
 */
export abstract class BaseAgent<TInput, TOutput> {
  protected readonly logger: Logger;

  constructor(
    protected readonly agentName: string,
    @Inject(LLM_PROVIDER) protected readonly llm: LLMProvider,
    protected readonly prompts: PromptLoaderService,
    protected readonly schemaRetry: SchemaRetry,
  ) {
    this.logger = new Logger(agentName);
  }

  /**
   * Execute the agent for a given input and pipeline context.
   * Implemented by each concrete agent.
   */
  abstract run(input: TInput, context: PipelineContext): Promise<TOutput>;

  /**
   * Convenience wrapper used by concrete agents:
   *  1. Loads and renders the prompt template.
   *  2. Calls the LLM via SchemaRetry (retry-with-feedback on Zod failure).
   *  3. Returns the validated, typed output.
   *
   * @param promptName - e.g. '01-parser'
   * @param variables  - Placeholder values for {{variable}} in the prompt
   * @param schema     - Zod schema to validate and type the LLM response
   * @param model      - Model identifier, e.g. process.env.MODEL_PARSER
   * @param maxTokens  - Optional token cap (default: 4096)
   */
  protected async generate<S extends z.ZodType>(opts: {
    promptName: string;
    variables: Record<string, string>;
    schema: S;
    model: string;
    maxTokens?: number;
  }): Promise<z.infer<S>> {
    const { promptName, variables, schema, model, maxTokens } = opts;

    // Load the system prompt (with DS context and few-shot examples injected)
    const system = this.prompts.load(promptName, variables);

    return this.schemaRetry.run(
      async (feedbackPrompt?: string) => {
        // On retry: append feedback to the user prompt so the model self-corrects
        const prompt = feedbackPrompt
          ? `${variables['description'] ?? variables['parser_output'] ?? variables['analyzer_output'] ?? ''}\n\n${feedbackPrompt}`
          : (variables['description'] ?? variables['parser_output'] ?? variables['analyzer_output'] ?? '');

        return this.llm.generateObject({ model, system, prompt, schema, maxTokens });
      },
      schema,
    );
  }
}
