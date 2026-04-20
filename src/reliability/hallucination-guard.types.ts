export interface HallucinationResult {
  passed: boolean;
  /** CSS variables used in code but absent from the DS allow-list */
  unknownCssVars: string[];
  /** Components imported from @unlimit/ui but absent from the DS allow-list */
  unknownComponents: string[];
  /** Icon name values not in the DS Icon.name allow-list */
  unknownIconNames: string[];
  /**
   * Feedback prompt to send back to GeneratorAgent on failure.
   * Empty string when passed = true.
   */
  feedbackPrompt: string;
}
