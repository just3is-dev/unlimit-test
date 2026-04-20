# ADR-002: Deterministic-First Reliability Sub-System

**Status:** Accepted  
**Date:** 2026-04-20

## Context

LLM outputs can fail in two ways: structurally (invalid JSON, schema mismatch) and
semantically (hallucinated tokens, missing states). The pipeline needs to catch both
without making quality checks expensive or non-deterministic themselves.

## Options Considered

**LLM judge for all validation**  
A single LLM call scores every aspect of the output. Simple to implement, flexible.
But it adds latency and cost to every request, is non-deterministic, and is hard to
unit-test.

**Deterministic checks first, LLM judge opt-in**  
Layer mechanisms from cheapest to most expensive: schema retry → regex guards →
optional LLM judge. Most failures are caught without any extra LLM call.

## Decision

Deterministic-first: schema validation and regex-based checks run on every request.
LLM judge is opt-in via `USE_LLM_JUDGE=true`.

## Rationale

The common failure modes — schema mismatch, wrong DS tokens, uncovered states — are
mechanical and fully detectable with deterministic code. Using an LLM to catch them
would be slower, costlier, and harder to test. Each deterministic check is a plain
class with unit tests; the LLM judge adds a quality score on top without replacing them.

On regex vs AST for `CoverageCheck`: AST analysis (Babel + custom visitor) would be
more precise but adds a heavy dependency for marginal gain. Regex patterns scoped to
JSX operators (`&&`, `?`) are sufficient for the generated code patterns in this project.

## Consequences

- Schema validation, DS compliance, and state coverage are verified with no extra LLM
  calls — low latency, low cost, fully testable.
- `LLMJudge` is additive: disabling it doesn't affect the pipeline output.
- Regex-based `CoverageCheck` can produce false negatives for CSS states implemented
  via non-standard syntax (e.g. CSS-in-JS libraries).
