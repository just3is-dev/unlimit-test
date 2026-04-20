export interface CoverageResult {
  /** "covered/required", e.g. "7/7" */
  ratio: string;
  covered: number;
  required: number;
  /** States that are required but not found in the code */
  missingInCode: string[];
  passed: boolean;
  /** Feedback prompt for GeneratorAgent re-prompt on failure */
  feedbackPrompt: string;
}
