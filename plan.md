# Plan: Design-to-Code Pipeline Agent

Тестовое задание Unlimit / AI Solution Architect. Документ живой — правим по ходу.

**Формат сдачи:** submit → HR → reviewer. Диалога с ревьюером не будет. Весь архитектурный reasoning должен быть материализован в коде и документации репо (ADR, Reviewer FAQ, README). Это сдвигает приоритет на документацию.

---

## 1. Что строим и под что

**Что.** Multi-agent pipeline: по текстовому описанию UI-компонента на выходе структурированный JSON (по схеме из `task.md`) + готовый React-компонент, с детерминированной валидацией против дизайн-системы.

**Под какую роль.** Team Lead of Web Development в Unlimit (Belgrade). Стек команды: Next.js / React / PHP. Ключевые пункты оценки (AI-Native Skills из вакансии):

- **Agent Architecture Design** — orchestration, tool use, memory, contexts
- **LLM Integration Patterns** — RAG, function calling, structured output, JSON schema validation, retry/fallback
- **MCP / Tool Protocol** — designing and integrating MCP servers, tools for AI agents
- **Design System as Code** — automation pipeline: Figma → Tokens → Components → Code → QA, AI at every stage
- **Prompt System Design** — prompts as engineering artifacts
- **AI Reliability Engineering** — validation, hallucination detection, graceful degradation, structured error handling
- **Frontend AI Architecture** — AI-assisted code generation, component-driven approach

Архитектурное мышление и reliability-паттерны оцениваются выше, чем идеальный сгенерированный компонент. Плюс — без возможности защиты решения голосом — документация должна предвосхищать вопросы.

---

## 2. Decisions & assumptions

Выбор + альтернативы. Развёрнутое обоснование «неочевидных» решений — в соответствующем ADR (см. §11).

| Решение | Выбрано | Альтернативы | Почему (кратко) | ADR |
|---|---|---|---|---|
| Язык / рантайм | TypeScript + Node.js | Python | Совпадает с frontend-стеком Unlimit (Next.js/React); единый язык pipeline и генерируемых компонентов; стек кандидата | — |
| Backend-фреймворк | NestJS | Plain Node, Express, Fastify | DI + modules ложатся на multi-agent 1-в-1 (каждый агент = provider); стек кандидата (выше шанс сделать чисто за отведённое время) | — |
| LLM-слой | Vercel AI SDK + `@ai-sdk/anthropic` | `@anthropic-ai/sdk` напрямую, LangChain | Zod-based `generateObject` из коробки, встроенный provider abstraction, меньше boilerplate; оркестрация pipeline остаётся явной | ADR-002 |
| LLM-провайдер | Anthropic Claude | OpenAI only | Надёжный baseline для structured output; абстракция ниже упрощает swap | — |
| Модели по стадиям | Haiku для Parser; Sonnet для Analyzer/Generator | Sonnet везде | Cost-aware: дешёвая модель на извлечении, дорогая на reasoning/генерации | ADR-005 |
| AI-оркестратор | ручной (Nest services + `PipelineService`) | LangGraph.js, CrewAI, Mastra, Anthropic Agent SDK | Линейный 4-stage pipeline — не профиль графовых фреймворков; reliability должен быть виден explicitly, не спрятан в DSL | **ADR-001** |
| Валидация схем | Zod | class-validator, ajv | DX + типы выводятся из схемы; удобно формировать feedback при retry | — |
| Целевой фреймворк генерации | React (FC + CSS-переменные) | Angular, Vue, HTML+CSS | Совпадает со стеком Unlimit | — |
| Интерфейсы | HTTP + CLI + MCP | только HTTP, только CLI | Три фасада над одним `PipelineService`: HTTP — production-style; CLI — прогон примеров в репо; MCP — прямой скилл из вакансии | ADR-004 |
| Design System | свой mini-набор (`tokens.json` + `components.json`) | Material, Carbon, shadcn | Полный контроль над allow-list; демонстрирует «tokens as code» | ADR-006 |
| Validator (a11y) | детерминированный чек-лист + opt-in LLM-judge | только детерминированный, только LLM-judge | Baseline reliability + дополнительный signal по ENV-флагу; trade-off явный | ADR-003 |
| Vision / Figma input | не в MVP | Claude Vision API | Описан как extension point; время ценнее вложить в reliability/docs | — |
| Контейнеризация | без Dockerfile | multi-stage Docker | Оверинженеринг для тестового; Node + npm у ревьюеров есть; в README — кратко в `Out of scope` | — |

---

## 3. Архитектура pipeline

Маппинг на «Design System as Code» из вакансии:

```
Figma  →  Tokens      →  Components   →  Code        →  QA
(skip)    (context)      (context)       (Generator)    (Validator)
            ▲              ▲                 ▲             ▲
            └── DesignSystemService (allow-list для anti-hallucination)
```

Три интерфейса-фасада над одним `PipelineService`:

```
[HTTP POST /pipeline]    [CLI: pnpm run:example]    [MCP tool: generate_component]
           \                      |                             /
            \                     |                            /
             ──────────►   PipelineService   ◄──────────
                                  │
       ┌──────────┬───────────────┼───────────────┬──────────┐
       ▼          ▼               ▼               ▼          ▼
   [Parser]  [Analyzer]      [Generator]     [Validator]  [Reliability]
   Haiku     Sonnet          Sonnet          deterministic   SchemaRetry,
                                             + opt LLM       HallucinationGuard,
                                                             CoverageCheck,
                                                             LLMJudge (opt-in)
```

Каждый агент — NestJS-сервис, наследник `BaseAgent<TInput, TOutput>`, с собственной Zod-схемой I/O. Общий `PipelineContext` прокидывает результаты стадий + DS-контекст (tokens, components, conventions) через DI.

**Две природы состояний** (выявлено в `paper-prototype.md`, влияет на Generator и Validator):
- **CSS-states** (`hover`, `focus-visible`, `selected`, `disabled`) — псевдоклассы / атрибуты
- **Functional states** (`loading`, `error`, `empty`, `deleting`) — conditional rendering в JSX

Отражено в `GeneratorOutput.states_covered[].kind: "css" | "functional"`; `CoverageCheck` использует разные паттерны поиска.

---

## 4. AI Reliability — отдельная подсистема

Модуль `src/reliability/` — четыре независимых механизма:

1. **`SchemaRetry`** — wrapper над LLM-вызовом. Zod-валидация; при неудаче — повтор с feedback-промптом («previous response failed schema at …, fix and retry»). Max retries через ENV.
2. **`HallucinationGuard`** — детерминированная пост-проверка Generator output. Regex по коду вытаскивает использованные CSS-переменные и имена компонентов; сверка с allow-list из `DesignSystemService`. При несоответствии — возврат в Generator со списком запрещённых.
3. **`CoverageCheck`** — проверяет покрытие required states. Для CSS-states — регэксп по `:hover` / `[aria-pressed]` / `[disabled]`. Для functional — по conditional render-паттернам. При неполном покрытии — re-prompt со списком недостающих.
4. **`LLMJudge` (opt-in, ENV `USE_LLM_JUDGE=true`)** — 5-й LLM-вызов: рубрика a11y, скор 0-100, обоснование со строгой Zod-схемой ответа. Trade-off с reliability описан в ADR-003.

В README — отдельная секция `How we handle LLM unreliability` с диаграммой и log output одного прогона.

---

## 5. Prompts as engineering artifacts

Все промпты — в `prompts/*.md`, не inline-строки. Структура каждого файла:

```
## Role
## System
## Input schema
## Output schema
## Constraints (+ design-system injection rules)
## Few-shot examples
## Chain-of-thought hint (если применимо)
```

Загружаются через `PromptLoaderService`, доступны через DI. Закрывает «Prompt System Design».

---

## 6. Структура репозитория

```
design-to-code-agent/
├── README.md                       # включая architecture diagram + Reviewer FAQ
├── plan.md                         # этот файл
├── paper-prototype.md              # прогонка на Payment Card (ловит дизайн-дыры)
├── docs/
│   └── adr/
│       ├── 001-ai-framework-choice.md
│       ├── 002-vercel-ai-sdk-as-llm-layer.md
│       ├── 003-deterministic-validator-with-optional-judge.md
│       ├── 004-three-interfaces-http-cli-mcp.md
│       ├── 005-mixed-model-strategy.md
│       └── 006-design-system-conventions.md
│
├── package.json
├── tsconfig.json
├── nest-cli.json
├── .env.example                    # ANTHROPIC_API_KEY, MODEL_*, MAX_RETRIES, USE_LLM_JUDGE
│
├── design-system/
│   ├── tokens.json                 # готово
│   └── components.json             # готово
│
├── prompts/
│   ├── 01-parser.md
│   ├── 02-analyzer.md
│   ├── 03-generator.md
│   └── 04-validator-judge.md       # для opt-in LLM-judge
│
├── src/
│   ├── main.ts                     # HTTP bootstrap
│   ├── cli.ts                      # CLI entrypoint
│   ├── mcp.ts                      # MCP server entrypoint
│   ├── app.module.ts
│   │
│   ├── pipeline/
│   │   ├── pipeline.controller.ts  # HTTP
│   │   ├── pipeline.service.ts     # orchestrator
│   │   ├── pipeline.context.ts     # shared state
│   │   └── schemas.ts              # Zod для всех стадий + FinalOutputSchema
│   │
│   ├── agents/
│   │   ├── base.agent.ts           # общий wrapper (prompt + generateObject + retry)
│   │   ├── parser.agent.ts
│   │   ├── analyzer.agent.ts
│   │   ├── generator.agent.ts
│   │   └── validator.agent.ts
│   │
│   ├── llm/
│   │   ├── llm.provider.ts         # интерфейс
│   │   ├── anthropic.provider.ts
│   │   └── prompt-loader.service.ts
│   │
│   ├── reliability/
│   │   ├── schema-retry.ts
│   │   ├── hallucination-guard.ts
│   │   ├── coverage-check.ts
│   │   └── llm-judge.ts            # opt-in
│   │
│   └── design-system/
│       └── design-system.service.ts
│
├── examples/
│   ├── 01-payment-card/            # input.txt + output.json + Component.tsx
│   ├── 02-transaction-table/
│   └── 03-kyc-wizard/
│
└── test/
    ├── schema-retry.spec.ts
    ├── hallucination-guard.spec.ts
    └── coverage-check.spec.ts
```

---

## 7. Expected output — схема ТЗ

| Поле | Заполняется |
|---|---|
| `component.*` | Parser |
| `extraction.*` | Parser |
| `gap_analysis.*` | Analyzer |
| `generated_code.*` | Generator |
| `validation.*` | Validator (+ опционально Judge) |

`FinalOutputSchema` (Zod) собирает всё в один JSON, совместимый с примером из `task.md`.

---

## 8. Бюджет и качество

«~3 часа» в задании — индикатор scope и фокуса, **не жёсткий cap**. Реализация идёт с AI-ассистированием: boilerplate, schema plumbing, драфт ADR и README пишутся в разы быстрее. Приоритет — **качество и полнота сигналов, а не экономия времени**. Не режем:

- 6 ADR + Reviewer FAQ в README
- Тесты на все три reliability-guard'а
- Полировку всех трёх примеров (input + output + Component.tsx в `examples/`)
- MCP-сервер в MVP
- LLM-judge как opt-in
- Provider abstraction для LLM

Если что-то явно не укладывается — режем по правилу «сохраняем документацию и reliability, режем украшательство».

Порядок реализации — §14.

---

## 9. Out of scope — для секции в README

- **Vision / Figma input** — описан как extension point (короткий sketch: как добавить Claude Vision поверх текущего pipeline)
- **Реальный pixel-perfect diffing** — упомянут в `task.md` как проблема, но сильнее решается валидацией токенов
- **Компиляция сгенерированного кода в проде** — оффлайн AST/regex достаточны для MVP
- **RAG по реальной кодовой базе** — упомянуть как естественное следующее звено
- **Persistence / история** — pipeline stateless
- **Docker / CI / observability / structured logging** — production-готовность, за рамками MVP

---

## 10. AI usage — заготовка для README

- **LLM-слой:** Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) с Zod-based `generateObject`
- **Провайдер:** Anthropic Claude через абстракцию `LLMProvider` (легко swap на OpenAI/Gemini)
- **Распределение по стадиям (cost-aware):**
  - Parser → `claude-haiku-4-5`
  - Analyzer → `claude-sonnet-4-6`
  - Generator → `claude-sonnet-4-6`
  - Validator (детерминированный) — без LLM
  - Validator-judge (opt-in) → `claude-haiku-4-5`
- **ENV:** `ANTHROPIC_API_KEY`, `MODEL_PARSER`, `MODEL_ANALYZER`, `MODEL_GENERATOR`, `MODEL_JUDGE`, `MAX_RETRIES`, `USE_LLM_JUDGE`
- **Что сработало / не сработало** — заполняется по факту после прогонки трёх примеров

---

## 11. ADR structure

Все ADR — короткие (150–300 слов), формат: **Context → Decision → Consequences → Alternatives considered**.

- **ADR-001 — AI framework choice and its architectural impact.** Центральный документ. Ключевая рамка: выбор AI-фреймворка — это не выбор инструмента, а выбор архитектурной парадигмы. Сравнительная таблица (LangGraph.js / CrewAI / Mastra / Anthropic Agent SDK / Vercel AI SDK + manual) в терминах «какую архитектуру каждый навязывает». Объяснение: для линейного 4-stage pipeline выбран explicit orchestrator, чтобы reliability-механизмы оставались видимыми и инспектируемыми.
- **ADR-002 — Vercel AI SDK as the LLM layer.** Что делегируем библиотеке (structured output, provider abstraction), что оставляем себе (retry with feedback, PromptLoader, оркестрация). Почему не LangChain (heavyweight), не голый Anthropic SDK (лишний boilerplate).
- **ADR-003 — Deterministic validator with opt-in LLM-judge.** Reliability vs richness. По умолчанию — воспроизводимый детерминированный чек; LLM-judge включается ENV-флагом для обогащённого скоринга; риск дополнительной unreliability явно описан.
- **ADR-004 — Three interfaces: HTTP, CLI, MCP.** Один `PipelineService`, три фасада. HTTP — production-style; CLI — воспроизводимость примеров в репо; MCP — composability агентов + скилл из вакансии.
- **ADR-005 — Mixed model strategy (Haiku + Sonnet).** Cost-aware design. Haiku — на извлечении, Sonnet — на reasoning/генерации. Настраивается через ENV.
- **ADR-006 — Design system scope and CSS-variable convention.** `tokens.json` + `components.json` — единственный источник истины. Конвенция `--{category}-{key}`. Allow-list как основа `HallucinationGuard`.

---

## 12. Reviewer FAQ — заготовка для README

Преэмптивные ответы на наиболее вероятные вопросы (каждый — 2–3 предложения + ссылка на соответствующий ADR / секцию):

- **Why no agent framework (LangGraph / CrewAI / etc.)?** → ADR-001
- **Why three interfaces instead of one?** → ADR-004
- **Why deterministic validator by default?** → ADR-003
- **Why no Docker / CI?** → §9 Out of scope
- **Why no Figma / Vision integration?** → extension point, §9

---

## 13. Decisions log

Закрытые вопросы (для истории):

- [x] MCP в MVP? — **Да**, третий интерфейс-фасад
- [x] Микс моделей Haiku + Sonnet? — **Да**, cost-aware
- [x] LLM-as-judge в MVP? — **Opt-in** через ENV-флаг; trade-off в ADR-003
- [x] Dockerfile? — **Нет**, оверинженеринг для тестового
- [x] Agent framework (LangGraph / CrewAI / Mastra)? — **Нет**, центральный ADR-001 объясняет решение через призму «фреймворк = архитектурная парадигма»
- [x] Python? — **Нет**, не требуется оправдывать (ТЗ разрешает любой язык); не пишем ADR на этот счёт
- [x] Provider abstraction? — **Да**, в MVP (база под ADR-002)

Открытых вопросов нет — готовы к реализации (§14).

---

## 14. План кодинга по шагам

Детализация §8 в последовательность самодостаточных шагов. Каждый — проверяемый коммит.

1. **Nest-bootstrap + зависимости** — `package.json`, `tsconfig.json`, `nest-cli.json`, `.env.example`, корневой `AppModule`
2. **DesignSystemService** — загрузка tokens.json + components.json, flatten в allow-list CSS-переменных и имён компонентов
3. **Zod-схемы + `PipelineContext`** — все стадии + `FinalOutputSchema`, совместимая с примером из `task.md`
4. **LLMProvider абстракция + AnthropicProvider** — через Vercel AI SDK (`generateObject` с Zod)
5. **PromptLoaderService** — загрузка `prompts/*.md`, кеширование, подстановка переменных
6. **BaseAgent + SchemaRetry** — общий wrapper с retry/feedback; юнит-тест на SchemaRetry
7. **PipelineService skeleton** — прогонка dummy-агентов end-to-end (без LLM, заглушки) — валидируем интерфейсы
8. **Parser agent + `prompts/01-parser.md`** — первый real LLM-агент, прогоняем на Payment Card
9. **Analyzer agent + `prompts/02-analyzer.md`** — с DS-контекстом + few-shot по типам компонентов
10. **Generator agent + `prompts/03-generator.md`** — основной, со sensitive-data guideline для финтеха
11. **HallucinationGuard + юнит-тест** — парсинг кода, сверка с allow-list, re-prompt при провале
12. **CoverageCheck + юнит-тест** — разделение CSS / functional states, re-prompt на недостачу
13. **Validator agent (deterministic)** — собирает HallucinationGuard + CoverageCheck + a11y rules, релевантные использованным компонентам
14. **LLMJudge (opt-in) + `prompts/04-validator-judge.md`** — 5-й вызов под ENV-флагом
15. **HTTP-контроллер** — `POST /pipeline`, валидация входа через Zod
16. **CLI** — thin entrypoint поверх `PipelineService`, прогон через аргумент-файл
17. **MCP-сервер** — tool `generate_component(description)`, обёртка над `PipelineService`
18. **Прогон 3 примеров → `examples/`** — input.txt + output.json + Component.tsx + (если CSS отдельно) Component.module.css
19. **6 ADR-файлов** — по шаблону Context / Decision / Consequences / Alternatives considered
20. **README** — архитектурная диаграмма (ASCII или Mermaid), how to run (3 интерфейса), Reviewer FAQ, Out of scope, AI usage, что сработало / не сработало

Итог: 20 шагов, каждый самодостаточный. Порядок — топологический (зависимости снизу вверх). Можно идти последовательно или параллелить связанные (например, промпт + агент).
