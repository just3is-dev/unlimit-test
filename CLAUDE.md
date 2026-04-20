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
| `src/pipeline/` | `PipelineService` (orchestrator), `PipelineContext` (shared state), `schemas.ts` (all Zod schemas + `FinalOutputSchema`) |
| `src/agents/` | `BaseAgent`, `ParserAgent`, `AnalyzerAgent`, `GeneratorAgent`, `ValidatorAgent` |
| `src/llm/` | `LLMProvider` interface, `AnthropicProvider` (Vercel AI SDK), `PromptLoaderService` |
| `src/reliability/` | `SchemaRetry`, `HallucinationGuard`, `CoverageCheck`, `LLMJudge` (opt-in via `USE_LLM_JUDGE=true`) |
| `prompts/` | Prompt files (`01-parser.md` … `04-validator-judge.md`) — loaded at runtime, not inlined |
| `design-system/` | `tokens.json` + `components.json` — single source of truth for the DS allow-lists |
| `examples/` | Three worked examples (`01-payment-card`, `02-transaction-table`, `03-kyc-wizard`) each with `input.txt`, `output.json`, `Component.tsx` |
| `docs/adr/` | Three ADRs documenting key architectural decisions |
| `test/` | Unit tests for the three reliability guards |

### Key conventions

- **Token CSS variables**: `--{category}-{key}` e.g. `--color-brand-primary` (see `tokens.json` `convention` field).
- **Components import**: `import { Button } from '@unlimit/ui'` (see `components.json` `import-base`).
- **States have two kinds**: `css` (hover, focus-visible, selected, disabled — expressed as pseudo-classes/attributes) and `functional` (loading, error, deleting — expressed as conditional JSX). `CoverageCheck` uses different regex patterns per kind.
- **Prompts are files**: `PromptLoaderService` reads `prompts/*.md` and injects `{{variable}}` placeholders at call time. Never inline prompts.
- **Models per stage** (cost-aware): Parser → `MODEL_PARSER` (Haiku), Analyzer/Generator → `MODEL_ANALYZER`/`MODEL_GENERATOR` (Sonnet), Judge → `MODEL_JUDGE` (Haiku). All overridable via ENV.

### Reliability sub-system (`src/reliability/`)

Four independent mechanisms run after `GeneratorAgent`:

1. **`SchemaRetry`** — wraps every LLM call; on Zod failure, re-prompts with the specific validation error.
2. **`HallucinationGuard`** — regex-extracts `var(--)` and `@unlimit/ui` imports from generated code; checks against `DesignSystemService` allow-lists.
3. **`CoverageCheck`** — verifies that every state in `gap_analysis.missing_states + extraction.specified_states` appears in the generated code (css states via pseudo-class patterns, functional states via conditional-render patterns).
4. **`LLMJudge`** — opt-in 5th LLM call (`USE_LLM_JUDGE=true`); returns 0-100 a11y score with Zod-validated structured output.
