# unlimit-test — Design-to-Code Pipeline Agent

A multi-agent NestJS pipeline that takes a UI component description and produces a
React component with design system compliance, state coverage analysis, and
accessibility validation.

---

## Quick Start

```bash
cp .env.example .env          # add ANTHROPIC_API_KEY
npm install
npm run cli -- examples/01-payment-card/input.txt
```

The HTTP API is also available:

```bash
npm run start:dev             # starts on port 3000
curl -X POST http://localhost:3000/pipeline \
  -H "Content-Type: application/json" \
  -d '{"description": "Payment card component..."}'
```

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | — | Anthropic API key |
| `MODEL_PARSER` | | `claude-haiku-4-5` | Model for Parser stage |
| `MODEL_ANALYZER` | | `claude-sonnet-4-6` | Model for Analyzer stage |
| `MODEL_GENERATOR` | | `claude-sonnet-4-6` | Model for Generator stage |
| `MODEL_JUDGE` | | `claude-haiku-4-5` | Model for LLMJudge stage |
| `USE_LLM_JUDGE` | | `false` | Enable opt-in a11y scoring stage |
| `MAX_RETRIES` | | `3` | Schema retry attempts per stage |

### Tests

```bash
npm test              # run all unit tests
npm run test:cov      # with coverage report
```

35 unit tests cover the reliability sub-system: `SchemaRetry`, `HallucinationGuard`, and `CoverageCheck`.

---

## Pipeline Architecture

```
Input (text description)
        │
        ▼
┌─────────────┐    Extracts: component type, states,
│   Parser    │    tokens, business context
│  (Haiku)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐    Identifies: missing states,
│  Analyzer   │    accessibility gaps, recommendations
│  (Sonnet)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐    Generates: React component using
│  Generator  │    DS tokens and covering all states
│  (Sonnet)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐    Checks: token compliance,
│  Validator  │    state coverage, accessibility rules
│ (no LLM)   │
└──────┬──────┘
       │
       ▼
  FinalOutput (JSON)
```

### C1 — System Context

```mermaid
C4Context
    title System Context — Design-to-Code Pipeline Agent

    Person(dev, "Developer", "Writes a UI component description in plain text")
    System(pipeline, "Design-to-Code Pipeline", "Generates a React component with state coverage and DS compliance")
    System_Ext(anthropic, "Anthropic API", "Claude Haiku and Sonnet models")

    Rel(dev, pipeline, "Sends description", "CLI / HTTP API")
    Rel(pipeline, anthropic, "LLM calls per stage", "HTTPS")
```

### C2 — Containers

```mermaid
C4Container
    title Container Diagram — Design-to-Code Pipeline Agent

    Person(dev, "Developer")

    Container_Boundary(app, "NestJS Application") {
        Container(cli, "CLI", "ts-node", "Reads input file, prints FinalOutput JSON to stdout")
        Container(http, "HTTP API", "NestJS/Express", "POST /pipeline → FinalOutput JSON")
        Container(svc, "PipelineService", "NestJS Service", "Orchestrates the 4-stage pipeline")
        Container(agents, "Agents", "NestJS Services", "Parser (Haiku) → Analyzer (Sonnet) → Generator (Sonnet) → Validator")
        Container(reliability, "Reliability", "TypeScript", "SchemaRetry · HallucinationGuard · CoverageCheck · LLMJudge")
        Container(ds, "DesignSystemService", "NestJS Service", "Loads tokens.json and components.json at startup")
    }

    System_Ext(anthropic, "Anthropic API", "Claude models via Vercel AI SDK")

    Rel(dev, cli, "npm run cli --")
    Rel(dev, http, "POST /pipeline")
    Rel(cli, svc, "run(description)")
    Rel(http, svc, "run(description)")
    Rel(svc, agents, "calls sequentially")
    Rel(svc, ds, "getContext()")
    Rel(agents, reliability, "wrapped by SchemaRetry")
    Rel(agents, anthropic, "generateObject()", "HTTPS")
```

Each stage has a typed Zod schema. Structured output is handled by the Vercel AI SDK
(`generateObject`). On schema validation failure, `SchemaRetry` re-prompts the model
with per-field error feedback (up to 3 attempts).

### Reliability sub-system

Validation runs without any LLM calls:

- **SchemaRetry** — wraps every LLM call; re-prompts with Zod error details on failure
- **HallucinationGuard** — checks generated code against DS token and component allow-lists
- **CoverageCheck** — verifies every required state is implemented in the generated code
- **LLMJudge** — opt-in a11y scoring via `USE_LLM_JUDGE=true` (uses Haiku)

### Model strategy

| Stage     | Model  | Reason                                      |
|-----------|--------|---------------------------------------------|
| Parser    | Haiku  | Structured extraction — low reasoning load  |
| Analyzer  | Sonnet | Gap analysis requires DS knowledge          |
| Generator | Sonnet | Code generation with DS constraints         |
| LLMJudge  | Haiku  | Rubric scoring — structured output          |

All models are overridable via ENV: `MODEL_PARSER`, `MODEL_ANALYZER`, `MODEL_GENERATOR`, `MODEL_JUDGE`.

---

## Examples

Three worked examples are in `examples/`. Each contains `input.txt`, `output.json`,
and the generated `Component.tsx`.

| Example | States coverage | Token compliance | A11y score |
|---|---|---|---|
| Payment card | 5/7 | ✅ | 2/3 |
| Transaction table | 6/12 | ✅ | 2/3 |
| KYC wizard | 5/19 | ✅ | 1/2 |

To regenerate all examples:

```bash
npm run run:examples
```

---

## Architecture Decisions

Three ADRs in `docs/adr/` document the key choices:

- **[ADR-001](docs/adr/ADR-001-manual-orchestration.md)** — Manual orchestration over AI frameworks (LangChain/LlamaIndex)
- **[ADR-002](docs/adr/ADR-002-deterministic-first-reliability.md)** — Deterministic-first reliability (no LLM in the default validation path)
- **[ADR-003](docs/adr/ADR-003-mixed-model-strategy.md)** — Mixed-model strategy for cost optimisation

---

## Trade-offs and Known Limitations

**State coverage is incomplete for complex components.** The KYC wizard has 19
required states; the generator covers 5. The gap exists because complex multi-step
components produce long output that hits the model's instruction-following limits.
Better prompt decomposition (generate each step separately) would improve this.

**CoverageCheck uses regex, not AST.** Regex patterns scoped to JSX operators
(`&&`, `?`) work well for the generated code style but can miss states implemented
via CSS-in-JS or inline `<style>` blocks. AST-based analysis would be more accurate
but adds significant complexity.

**Design system is a stub.** `design-system/tokens.json` and `components.json` are
representative fixtures, not a real DS. A production integration would connect to
Figma Tokens, Style Dictionary, or a component registry.

---

## AI Usage

**Model:** Claude (Anthropic) — `claude-sonnet-4-6` for Analyzer and Generator,
`claude-haiku-4-5` for Parser and the optional LLM judge.

**Where AI was used:**

- *Parser* — structured extraction of component type, states, tokens, and business context from free-text descriptions
- *Analyzer* — gap analysis: identifying missing states and accessibility issues not mentioned in the description
- *Generator* — React component generation using design system constraints
- *LLMJudge (opt-in)* — accessibility scoring with per-category breakdown

**What worked well:**

- `generateObject` with Zod schemas produces reliable structured output; schema failures are rare and self-correct via `SchemaRetry`
- Haiku is sufficient for extraction and scoring tasks — no quality loss observed compared to Sonnet for those stages
- The Analyzer reliably surfaces missing states (hover, focus, loading, error) even when the input description says nothing about them

**What didn't work as well:**

- State coverage degrades on complex components: the Generator loses track of required states in long outputs
- Generated component code is functional but not idiomatic — structure, naming, and separation of concerns reflect prompt instructions rather than team conventions
- `CoverageCheck` regex patterns miss some valid state implementations, leading to false negatives in the coverage report
