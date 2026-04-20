import { z } from 'zod';
import { Inject, Logger } from '@nestjs/common';

import { LLM_PROVIDER, LLMProvider } from '@/llm/llm.provider';
import { PromptLoaderService } from '@/llm/prompt-loader.service';
import { PipelineContext } from '@/pipeline/pipeline.context';
import { SchemaRetry } from '@/reliability/schema-retry';

/**
 * BaseAgent<TInput, TOutput> — shared infrastructure for all pipeline agents.
 *
 * Each concrete agent (Parser, Analyzer, Generator, Validator) extends this
 * and implements only `run()`. Everything else — prompt loading, LLM call,
 * schema retry — is handled here.
 *
 * System / prompt split:
 *   system = prompt file content (role, instructions, DS context, few-shot examples)
 *   prompt = the actual user input for this call (description, parser output, etc.)
 *
 * On SchemaRetry failure the feedback is appended to the user prompt so the
 * model receives both the original input and the correction instruction.
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
   * Core LLM call with schema validation + retry-with-feedback.
   *
   * @param promptName  - Prompt file name without extension, e.g. '01-parser'
   * @param systemVars  - Variables injected into the system prompt template
   * @param userPrompt  - The actual user-turn input (description, prior stage JSON, etc.)
   * @param schema      - Zod schema to validate the LLM response
   * @param model       - Model identifier from ENV, e.g. process.env.MODEL_PARSER
   * @param maxTokens   - Token cap for the completion (default: 4096)
   */
  protected async generate<S extends z.ZodType>(opts: {
    promptName: string;
    systemVars: Record<string, string>;
    userPrompt: string;
    schema: S;
    model: string;
    maxTokens?: number;
  }): Promise<z.infer<S>> {
    const { promptName, systemVars, userPrompt, schema, model, maxTokens } = opts;

    // System prompt: role + instructions + DS context + few-shot examples
    const system = this.prompts.load(promptName, systemVars);

    return this.schemaRetry.run(async (feedbackPrompt?: string) => {
      // On retry: append schema-error feedback so the model self-corrects.
      // Original input stays visible so the model has full context.
      const prompt = feedbackPrompt ? `${userPrompt}\n\n---\n${feedbackPrompt}` : userPrompt;

      return this.llm.generateObject({ model, system, prompt, schema, maxTokens });
    }, schema);
  }
}
