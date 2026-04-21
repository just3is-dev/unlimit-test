# CLAUDE.md

This file provides guidance when working with code in this repository.

## Commands

```bash
npm run start:dev      # HTTP server with watch (port 3000)
npm run build          # compile to dist/
npm run start:prod     # run compiled output

npm run cli -- examples/01-payment-card/input.txt   # CLI interface
npm run run:examples   # regenerate all three examples

npm test               # run all Jest tests
npm test -- --testPathPattern=schema-retry   # run a single test file
npm run test:cov       # coverage report

npm run lint           # ESLint --fix
npm run format         # Prettier
```

Copy `.env.example` → `.env` and set `ANTHROPIC_API_KEY` before running.

## Architecture

A **4-stage multi-agent pipeline** over a single `PipelineService`. Two interfaces
(HTTP / CLI) are thin facades over the same service.

```
POST /pipeline          src/cli.ts
        \                   |
         ──────────►  PipelineService  ◄────────
                            │
         ┌──────────────────┼──────────────────┐
         ▼          ▼       ▼       ▼           ▼
      Parser    Analyzer  Generator  Validator  Reliability
      (Haiku)   (Sonnet)  (Sonnet)  (determ.)  sub-system
```

Each agent lives in `src/agents/` and extends `BaseAgent<TInput, TOutput>` — a wrapper
that handles prompt loading, `generateObject` (Vercel AI SDK + Zod schema), and
retry-with-feedback via `SchemaRetry`.

### Module map

| Directory | Purpose |
|---|---|
| `src/design-system/` | `DesignSystemService` — loads `design-system/*.json` at startup, exposes CSS-variable and component allow-lists used by `HallucinationGuard` |
| `src/pipeline/` | `PipelineService` (orchestrator), `PipelineContext` (shared state), `pipeline.schemas.ts` (all Zod schemas + `FinalOutputSchema`) |
| `src/agents/` | `BaseAgent`, `ParserAgent`, `AnalyzerAgent`, `GeneratorAgent`, `ValidatorAgent` |
| `src/llm/` | `LLMProvider` interface, `AnthropicProvider` (Vercel AI SDK), `PromptLoaderService`, `SchemaRetry` (structured-output retry wrapper) |
| `src/reliability/` | `HallucinationGuard`, `StateCoverageGuard`, `A11yGuard` — deterministic post-generation guards |
| `prompts/` | Prompt files (`01-parser.md` … `03-generator.md`) — loaded at runtime, not inlined |
| `design-system/` | `tokens.json` + `components.json` — single source of truth for the DS allow-lists |
| `examples/` | Three worked examples (`01-payment-card`, `02-transaction-table`, `03-kyc-wizard`) each with `input.txt`, `output.json`, `Component.tsx` |
| `docs/adr/` | Three ADRs documenting key architectural decisions |
| `test/` | Unit tests for `SchemaRetry`, the three guards, and `PipelineService` orchestration |

### Key conventions

- **Token CSS variables**: `--{category}-{key}` e.g. `--color-brand-primary` (see `tokens.json` `convention` field).
- **Components import**: `import { Button } from '@unlimit/ui'` (see `components.json` `import-base`).
- **States have two kinds**: `css` (hover, focus-visible, selected, disabled — expressed as pseudo-classes/attributes) and `functional` (loading, error, deleting — expressed as conditional JSX). `StateCoverageGuard` uses different regex patterns per kind.
- **Prompts are files**: `PromptLoaderService` reads `prompts/*.md` and injects `{{variable}}` placeholders at call time. Never inline prompts.
- **Models per stage** (cost-aware): Parser → `MODEL_PARSER` (Haiku), Analyzer/Generator → `MODEL_ANALYZER`/`MODEL_GENERATOR` (Sonnet). All overridable via ENV.

### LLM call reliability (`src/llm/schema-retry.ts`)

**`SchemaRetry`** wraps every `generateObject` call inside `BaseAgent.generate()`. On Zod schema failure it extracts per-field errors and re-prompts the model with specific correction instructions (up to `MAX_SCHEMA_RETRIES` attempts). Transparent to the caller — agents always receive a validated result or an exception.

### Guard sub-system (`src/reliability/`)

Three deterministic guards run in `PipelineService` after every `GeneratorAgent` call. All follow the same contract: `.check() → { passed, feedbackPrompt, ... }`. Results are saved to `PipelineContext`; on failure the feedback prompts are combined and fed into a Generator retry. `ValidatorAgent` reads results from context without re-running the checks.

1. **`HallucinationGuard`** — regex-extracts `var(--)` and `@unlimit/ui` imports from generated code; checks against `DesignSystemService` allow-lists.
2. **`StateCoverageGuard`** — verifies that every state in `gap_analysis.missing_states + extraction.specified_states` appears in the generated code (css states via pseudo-class patterns, functional states via conditional-render patterns).
3. **`A11yGuard`** — runs component-specific a11y rules from `a11y-guard.rules.ts`; checks aria attributes, label props, and other accessibility requirements deterministically.

