/**
 * Rule contract for a single component-level a11y check.
 * Returns true = PASS, false = FAIL.
 */
export interface A11yRule {
  description: string;
  test: (code: string) => boolean;
}

export interface A11yResult {
  passed: boolean;
  totalChecks: number;
  passedChecks: number;
  /** Formatted as "passed/total", e.g. "4/4" */
  score: string;
  /** Descriptions of failed rules */
  issues: string[];
  /** Feedback prompt for GeneratorAgent re-prompt on failure. Empty when passed = true. */
  feedbackPrompt: string;
}
