# ADR-003: Mixed-Model Strategy for Cost Optimisation

**Status:** Accepted  
**Date:** 2026-04-20

## Context

The pipeline has 4 stages overall; only the first 3 involve LLM calls (Parser, Analyzer,
Generator) — Validator is deterministic. Each LLM stage has a different reasoning load:
structured extraction is simpler than code generation with design system constraints.

## Options Considered

**Same model for all stages (Sonnet)**  
Simplest to configure. But uses the most expensive model for tasks that don't
require it — Parser is a straightforward structured-output task.

**Model per stage matched to task complexity**  
Haiku for low-reasoning stages, Sonnet where inference depth matters. All
overridable via ENV variables.

## Decision

Assign models per stage based on task complexity:

| Stage | Model | Reasoning |
|---|---|---|
| Parser | Haiku | Structured extraction from short text |
| Analyzer | Sonnet | Gap analysis requires DS knowledge and inference |
| Generator | Sonnet | Code generation with DS constraints |

`temperature = 0` for all stages — every stage uses `generateObject` with a Zod
schema. Any temperature above 0 increases schema validation failures.
`maxTokens` varies: 4096 for Parser/Analyzer, 16000 for Generator (component
code can be long).

All model defaults are overridable via ENV (`MODEL_PARSER`, `MODEL_ANALYZER`, `MODEL_GENERATOR`).

## Consequences

- Haiku is ~20× cheaper than Sonnet — significant cost reduction for the Parser stage.
- Each stage can be upgraded independently by changing one ENV variable.
- Haiku may occasionally require more `SchemaRetry` attempts on complex extractions,
  though this was not observed in the three worked examples.
