# Paper Prototype

Прогонка одного примера руками **до** написания кода — чтобы поймать архитектурные дыры на бумаге, а не на 90-й минуте имплементации. Берём пример №1 из `task.md` (Payment Card).

---

## Input

```
Payment card component. Shows card number (masked: **** **** **** 1234),
expiry date, cardholder name, card brand icon (Visa/Mastercard/Amex).
Used in merchant dashboard to display saved payment methods.
User can select a card or delete it.
```

---

## Стадия 1 — Parser (LLM)

Что должен извлечь:

```jsonc
{
  "component": {
    "name": "PaymentCard",
    "type": "card",
    "business_context": "Display of a saved payment method in the merchant dashboard"
  },
  "extraction": {
    "specified_states": ["default", "selected"],
    "tokens_referenced": [],
    "constraints": [
      "Card number must be masked except last 4 digits",
      "Show brand icon (Visa, Mastercard, Amex)",
      "User can select the card",
      "User can delete the card"
    ]
  }
}
```

Заметки:
- «select» → состояние `selected`. «delete» — действие, не состояние (порождает `deleting` / `error` дальше).
- `tokens_referenced` пустое — описание не упоминает конкретных цветов/размеров.
- Parser **не должен** придумывать состояния (loading/error и т.п.) — это работа Analyzer'а. Чёткое разделение ответственности.

---

## Стадия 2 — Analyzer (LLM)

Что должен flag-нуть, имея на вход Parser-output + контекст DS:

```jsonc
{
  "gap_analysis": {
    "missing_states": [
      "hover",            // карточка интерактивная
      "focus-visible",    // keyboard nav
      "disabled",         // карточка истекла или временно недоступна
      "deleting",         // во время удаления
      "error"             // удаление не удалось
    ],
    "accessibility_gaps": [
      "Masked card number must be readable by screen reader (e.g., aria-label='Card ending in 1234')",
      "Brand icon needs accessible name or be marked decorative",
      "Selectable card must be keyboard-activatable (button or role=button + tabIndex)",
      "Selected state must be announced (aria-pressed or aria-selected)",
      "Delete action must be confirmed (irreversible) and have an explicit aria-label"
    ],
    "responsive_gaps": [
      "Behavior on narrow viewports (<360px): wrapping of cardholder name, icon size",
      "Touch target for delete button on mobile (>= 44x44px)"
    ],
    "recommendations": [
      "Use Card with interactive=true and selected={isSelected}",
      "Use IconButton for delete action with aria-label",
      "Use Modal for delete confirmation",
      "Mask the card number visually but expose full last-4 to screen readers"
    ]
  }
}
```

Заметки:
- Analyzer'у **обязательно нужен** список компонентов (`components.json`) — иначе он порекомендует то, чего нет в DS. **Это правило для промпта.**
- Analyzer должен иметь «справочник типичных состояний» по типам компонентов: для `card` базовый набор это `default/hover/focus/selected/disabled` + контекст («с destructive-action» добавляет `deleting/error`). **Это few-shot в промпте.**
- `empty` сюда не относится — это состояние **списка карточек**, а не самой карточки. Хорошее напоминание: scope состояний = scope компонента.

---

## Стадия 3 — Generator (LLM)

Должен использовать (всё из DS):

| Категория | Что использует |
|---|---|
| Tokens | `--color-background`, `--color-foreground`, `--color-border`, `--color-muted-foreground`, `--color-focus-ring`, `--color-brand-primary`, `--color-danger`, `--spacing-3/4`, `--radius-md`, `--shadow-sm`, `--font-family-sans`, `--font-size-base/sm`, `--font-weight-medium/semibold` |
| Components | `Card`, `Icon` (`name="visa"`/`"mastercard"`/`"amex"`/`"check"`), `IconButton` (`icon=<Icon name="trash" />`, `aria-label="Delete card"`), `Modal` (для подтверждения) |

Покрываемые states (specified + recommended):
- `default` (CSS), `hover` (CSS), `focus-visible` (CSS), `selected` (prop + visual), `disabled` (prop), `deleting` (conditional render Spinner + disable), `error` (conditional render error message)

Output:

```jsonc
{
  "generated_code": {
    "framework": "react",
    "files": [
      { "filename": "PaymentCard.tsx", "content": "..." },
      { "filename": "PaymentCard.module.css", "content": "..." }   // или inline через style + var()
    ],
    "states_covered": ["default", "hover", "focus-visible", "selected", "disabled", "deleting", "error"],
    "tokens_used": ["--color-background", "--color-border", "..."]
  }
}
```

---

## Стадия 4 — Validator (детерминированный)

Что проверяет на этом примере:

**HallucinationGuard:**
- Все `var(--...)` из CSS — есть в `tokens.json` allow-list?
- Все JSX-компоненты, импортированные из `@unlimit/ui` — есть в `components.json`?
- Все prop-значения для enum-полей (например `<Icon name="diners" />` — `"diners"` нет в allowed values) — валидны?

**CoverageCheck:**
- Сопоставляет `gap_analysis.missing_states + extraction.specified_states` (= required) с `generated_code.states_covered` (= claimed). Делит claimed на:
  - **CSS-states** (`hover`, `focus-visible`, `selected`, `disabled`) — ищем `:hover`, `:focus-visible`, `[data-selected]` / `aria-pressed`, `:disabled` / `[disabled]` в коде.
  - **Functional states** (`deleting`, `error`, `empty`, `loading`) — ищем conditional rendering: `{loading && <Spinner />}`, `{error && <...>}`.
- Если состояние заявлено, но кода нет — `coverage = X/Y` снижается + `issues_found` пополняется.

**A11y deterministic checks** (выборка релевантного из общего чек-листа):
- IconButton без `aria-label` → fail
- Card с `interactive=true` без обработки клавиатуры → fail (но это уже инкапсулировано в Card; check на использование правильного prop)
- Modal без `title` → fail
- `<Icon name="..." />`, передающий смысл, без `aria-label` или `aria-hidden` → warning

**Output:**
```jsonc
{
  "validation": {
    "token_compliance": true,
    "states_coverage": "7/7",
    "accessibility_score": "6/7",
    "issues_found": [
      "Brand Icon has no aria-label and is not marked aria-hidden=true"
    ],
    "hallucinations_caught": []
  }
}
```

---

## Что выявил прогон — выводы для архитектуры

1. **Analyzer-у обязательно нужен `components.json` в контексте.** Иначе recommendations будут указывать на несуществующие компоненты. → Добавить в `prompts/02-analyzer.md` явную секцию инжекции DS.

2. **Нужен справочник типичных состояний по типам компонентов.** Это базовая «доменная память» агента. → Few-shot в `prompts/02-analyzer.md`: для `form` / `card` / `table` / `modal` / `page` — типовой набор обязательных state'ов.

3. **`states` имеют две природы — CSS и functional.** Это влияет и на Generator (как выражать), и на Validator (как искать). → В Zod-схему `GeneratorOutput.states_covered` добавить тег `kind: "css" | "functional"`. CoverageCheck парсит код по разным паттернам в зависимости от типа.

4. **Scope состояний = scope компонента.** `empty` — это про список, не про карточку. Правило для Parser/Analyzer: «не выходить за границы описываемого компонента». → Constraint в `prompts/01-parser.md` и `prompts/02-analyzer.md`.

5. **A11y-чек-лист — частично условный.** «Modal должен иметь title» применимо только если Modal используется. → Validator прогоняет правила, релевантные использованным компонентам. Список правил в `validator.agent.ts` хранится как `Record<componentName, A11yRule[]>` + общие правила.

6. **Маскирование данных vs screen reader.** Pattern «визуально замаскировано, для SR — полная информация о последних 4 цифрах» — это специфическая фича, которую Generator должен знать. → Включить в `prompts/03-generator.md` короткий гайдлайн по «sensitive data display» для финтех.

7. **PipelineContext должен прокидывать DS-контекст явно.** Каждый агент получает `{ tokens: string[], components: ComponentSpec[], conventions: ... }` через DI. Это однообразит интерфейс агентов и упрощает тесты.

---

## Что НЕ делаем после этого прогона

- Прогонять примеры 2 и 3 руками — выводы 1–7 уже стабильны, новые примеры скорее всего не дадут принципиально новых insights. Прогоним их **через реальный pipeline** для документации в `examples/`.
- Перерисовывать `plan.md` под каждый insight — занесём insights 1–7 в виде Open questions в §12 plan.md, **если** что-то из этого нужно обсудить отдельно перед кодингом. Большинство — это просто конкретика для промптов и схем, конкретизируется при имплементации.
