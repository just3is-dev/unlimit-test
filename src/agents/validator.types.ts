/**
 * A11y rules applied to generated code, keyed by DS component name.
 * Each rule has a description and a test function.
 */
export interface A11yRule {
  description: string;
  test: (code: string) => boolean; // returns true = PASS
}
