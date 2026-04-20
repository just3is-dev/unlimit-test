# ADR-002: Deterministic-First Reliability Sub-System

**Status:** Accepted  
**Date:** 2026-04-20

## Context

LLM outputs can fail in two ways: structurally (invalid JSON, schema mismatch) and
semantically (hallucinated tokens, missing states). The pipeline needs to catch both
without making quality checks expensive or non-deterministic themselves.

## Options Considered

**LLM-based quality evaluator for all validation**  
A single LLM call scores every aspect of the output. Simple to implement, flexible.
But it adds latency and cost to every request, is non-deterministic, and is hard to
unit-test.

**Deterministic checks only**  
Layer mechanisms from cheapest to most expensive: schema retry → regex guards.
Most failures are caught without any extra LLM call. No qualitative LLM scoring.

## Decision

Deterministic-first: schema validation and regex-based guards run on every request.
No LLM calls in the validation path.

## Rationale

The common failure modes — schema mismatch, wrong DS tokens, uncovered states, missing
aria attributes — are mechanical and fully detectable with deterministic code. Using an
LLM to catch them would be slower, costlier, and harder to test. Each deterministic check
is a plain class with unit tests.

All three guards follow the same contract (`.check() → { passed, feedbackPrompt }`) so
they can be composed uniformly in the Generator retry loop and their results stored in
`PipelineContext` for `ValidatorAgent` to consume without re-running the checks.

On regex vs AST for `StateCoverageGuard` and `A11yGuard`: AST analysis (Babel + custom
visitor) would be more precise but adds a heavy dependency for marginal gain. Regex
patterns — scoped to JSX operators (`&&`, `?`) for state coverage and to tag attributes
for a11y — are sufficient for the generated code patterns in this project.

## Consequences

- Schema validation, DS compliance, state coverage, and accessibility rules are all
  verified with no extra LLM calls — low latency, low cost, fully testable.
- Regex-based guards can produce false negatives for states or attributes implemented
  via non-standard syntax (e.g. CSS-in-JS libraries, dynamic prop spreading).
