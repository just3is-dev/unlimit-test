import { z } from 'zod';

// ---------------------------------------------------------------------------
// Stage 1 — Parser
// ---------------------------------------------------------------------------

export const ComponentTypeSchema = z.enum(['form', 'card', 'table', 'modal', 'page']);

export const ParserOutputSchema = z.object({
  component: z.object({
    name: z.string().describe('PascalCase component name, e.g. PaymentCard'),
    type: ComponentTypeSchema,
    business_context: z.string().describe('One-sentence business context'),
  }),
  extraction: z.object({
    /**
     * States explicitly mentioned in the input description.
     * Parser must NOT invent states — that is Analyzer's job.
     */
    specified_states: z.array(z.string()),
    /** CSS variable names or token references mentioned in the description (often empty). */
    tokens_referenced: z.array(z.string()),
    /** Hard constraints from the description (masking rules, file limits, etc.). */
    constraints: z.array(z.string()),
  }),
});

export type ParserOutput = z.infer<typeof ParserOutputSchema>;

// ---------------------------------------------------------------------------
// Stage 2 — Analyzer
// ---------------------------------------------------------------------------

export const AnalyzerOutputSchema = z.object({
  gap_analysis: z.object({
    /**
     * States implied but not specified: hover, focus-visible, loading, error, etc.
     * Scope = the single component being described (not its container).
     */
    missing_states: z.array(z.string()),
    /** ARIA, contrast, keyboard-nav gaps. */
    accessibility_gaps: z.array(z.string()),
    /** Responsive-breakpoint concerns. */
    responsive_gaps: z.array(z.string()),
    /** DS-aware recommendations: which components / props to use. */
    recommendations: z.array(z.string()),
  }),
});

export type AnalyzerOutput = z.infer<typeof AnalyzerOutputSchema>;

// ---------------------------------------------------------------------------
// Stage 3 — Generator
// ---------------------------------------------------------------------------

/**
 * States have two natures:
 *  - css       → expressed via pseudo-classes/attributes (:hover, [aria-pressed], :disabled)
 *  - functional → expressed via conditional JSX ({loading && <Spinner />})
 *
 * StateCoverageGuard uses different regex patterns per kind.
 */
export const StateCoveredSchema = z.object({
  name: z.string(),
  kind: z.enum(['css', 'functional']),
});

export const GeneratedFileSchema = z.object({
  filename: z.string(),
  content: z.string(),
});

export const GeneratorOutputSchema = z.object({
  generated_code: z.object({
    framework: z.literal('react'),
    files: z.array(GeneratedFileSchema).min(1),
    /**
     * Every state the generated code covers, tagged by kind.
     * Must include all states from specified_states + missing_states.
     */
    states_covered: z.array(StateCoveredSchema),
    /** CSS custom-property names actually used, e.g. "--color-brand-primary". */
    tokens_used: z.array(z.string()),
  }),
});

export type GeneratorOutput = z.infer<typeof GeneratorOutputSchema>;
export type StateCovered = z.infer<typeof StateCoveredSchema>;
export type GeneratedFile = z.infer<typeof GeneratedFileSchema>;

// ---------------------------------------------------------------------------
// Stage 4 — Validator
// ---------------------------------------------------------------------------

export const ValidatorOutputSchema = z.object({
  validation: z.object({
    /** True if every var(--…) in generated code is in the DS allow-list. */
    token_compliance: z.boolean(),
    /** "covered/required", e.g. "7/7". */
    states_coverage: z.string().regex(/^\d+\/\d+$/),
    /** "score/total", e.g. "6/7". */
    accessibility_score: z.string(),
    /** Descriptions of found issues (a11y, coverage gaps). */
    issues_found: z.array(z.string()),
    /** Tokens / components that were hallucinated (not in DS). */
    hallucinations_caught: z.array(z.string()),
  }),
});

export type ValidatorOutput = z.infer<typeof ValidatorOutputSchema>;

// ---------------------------------------------------------------------------
// Stage 5 — QualityEvaluator (opt-in, USE_QUALITY_EVALUATOR=true)
// ---------------------------------------------------------------------------

export const QualityEvaluatorOutputSchema = z.object({
  score: z.number().int().min(0).max(100),
  breakdown: z.object({
    aria_correctness: z.number().int().min(0).max(30),
    keyboard_navigation: z.number().int().min(0).max(25),
    state_coverage: z.number().int().min(0).max(20),
    token_compliance: z.number().int().min(0).max(15),
    code_quality: z.number().int().min(0).max(10),
  }),
  issues: z.array(z.string()),
  strengths: z.array(z.string()),
});

export type QualityEvaluatorOutput = z.infer<typeof QualityEvaluatorOutputSchema>;

// ---------------------------------------------------------------------------
// Final output — task.md-compatible combined schema
// ---------------------------------------------------------------------------

/**
 * FinalOutputSchema assembles all stage outputs into the shape
 * required by task.md. Note: states_covered is flattened to string[]
 * (the internal kind tag is only needed during validation).
 */
export const FinalOutputSchema = z.object({
  component: ParserOutputSchema.shape.component,
  extraction: ParserOutputSchema.shape.extraction,
  gap_analysis: AnalyzerOutputSchema.shape.gap_analysis,
  generated_code: z.object({
    framework: z.string(),
    files: z.array(GeneratedFileSchema),
    states_covered: z.array(z.string()),
    tokens_used: z.array(z.string()),
  }),
  validation: ValidatorOutputSchema.shape.validation,
  /** Present only when USE_QUALITY_EVALUATOR=true. */
  quality: QualityEvaluatorOutputSchema.optional(),
});

export type FinalOutput = z.infer<typeof FinalOutputSchema>;
