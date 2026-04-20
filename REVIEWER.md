# 15-Minute Reviewer Tour

If you have limited time, here is the shortest path through the codebase that covers
the most interesting decisions.

---

## 1. Orchestration — `src/pipeline/pipeline.service.ts`

The single place where all four stages are wired together. Shows the generator
retry loop: after `GeneratorAgent` runs, all three guards (`HallucinationGuard`,
`StateCoverageGuard`, `A11yGuard`) inspect the output and save results to
`PipelineContext`. If any guard fails, their feedback prompts are combined and fed
into a `GeneratorAgent` retry. Guards always run after the final Generator call so
`ValidatorAgent` can read the results from context without re-running them.

## 2. Agent contract — `src/agents/base.agent.ts`

Every agent extends `BaseAgent<TInput, TOutput>`. The base class handles prompt
loading, the `generateObject` call, and `SchemaRetry`. Concrete agents implement
only `run()`. Note the comment on why `@Inject` is absent from the base class
constructor — a non-obvious NestJS metadata collision.

## 3. Structured output + retry — `src/llm/schema-retry.ts`

The core reliability primitive. On Zod schema failure, it extracts per-field error
messages and re-prompts the model with specific correction instructions. Used by
every agent via `BaseAgent.generate()`.

## 4. Deterministic guards — `src/reliability/`

Three guards run without any LLM call, all following the same contract:
`.check() → { passed, feedbackPrompt, ... }`. `HallucinationGuard` validates CSS
variables and component imports against the design system allow-lists.
`StateCoverageGuard` verifies that every required state is detectable in the generated
code — CSS states via pseudo-class patterns, functional states via JSX conditional
patterns. `A11yGuard` runs component-specific accessibility rules from
`a11y-guard.rules.ts` — backed by a brace-aware mini-parser (`extractTags`) that
handles word boundaries (`<Modal` ≠ `<ModalContent`) and nested JSX props
(`icon={<Icon ... />}`) that trip up naive `[^>]*` regex.

All three produce a `feedbackPrompt` consumed by the Generator retry loop in step 1.

## 5. One worked example — `examples/01-payment-card/output.json`

A complete end-to-end output: parser extraction, gap analysis, generated component,
validation result. The companion `PaymentCard.tsx` is the actual generated React
component.

---

## Architecture decisions

Three ADRs in `docs/adr/` explain the non-obvious choices:

- **ADR-001** — why manual orchestration instead of LangChain/LlamaIndex
- **ADR-002** — why validation is deterministic instead of LLM-based
- **ADR-003** — why different models per stage (cost vs. quality trade-off)
