# ADR-001: Manual Orchestration Over AI Frameworks

**Status:** Accepted  
**Date:** 2026-04-20

## Context

Building a multi-agent pipeline requires coordinating several LLM calls with typed
data passing between stages. The ecosystem offers ready-made frameworks for this:
LangChain, LlamaIndex, AutoGen, and others.

## Options Considered

**AI orchestration framework (LangChain / LlamaIndex)**  
Provides chains, tool calling, memory, and agent loops out of the box. Adds value
for dynamic, graph-based flows where agents choose their own next steps at runtime.

**Manual orchestration via a plain NestJS service**  
Each agent is a plain `@Injectable()`. Stages are called sequentially in TypeScript
with explicit typed inputs and outputs defined as Zod schemas.

## Decision

Manual orchestration. No AI framework dependency.

## Rationale

The pipeline has a fixed, linear topology known at compile time:
`Parser → Analyzer → Generator → Validator`. Framework abstractions (chains, tools,
agent loops) add value for dynamic flows — they add only indirection here.

Manual code keeps every prompt, retry, and token budget explicit and visible.
Each stage is a plain class with a typed `run()` method, testable without mocking
framework internals.

## Consequences

- Zero framework lock-in — swapping models, adding stages, or changing retry logic
  is a TypeScript change only.
- Reliability mechanisms (`SchemaRetry`, `HallucinationGuard`, `CoverageCheck`) fit
  the problem exactly rather than being squeezed into a framework's extension points.
- Infrastructure code (prompt loading, retry, schema validation) is written from
  scratch — the explicit cost accepted for the benefits above.
