/**
 * CSS state → regex patterns to find evidence in code.
 *
 * A state is "covered" if ANY of its patterns matches in the full code string.
 * Patterns are intentionally broad — we're checking intent, not AST.
 */
export const CSS_STATE_PATTERNS: Record<string, RegExp[]> = {
  default: [/.+/], // base state always present if code exists
  hover: [/:hover/, /onMouseEnter/, /onMouseLeave/],
  'focus-visible': [/:focus-visible/, /:focus/, /onFocus/, /aria-focused/],
  focus: [/:focus/, /onFocus/],
  selected: [/aria-pressed/, /aria-selected/, /\bselected\b/, /data-selected/, /isSelected/],
  disabled: [/\bdisabled\b/, /:disabled/, /aria-disabled/],
  active: [/:active/, /aria-pressed/],
  pressed: [/aria-pressed/],
  invalid: [/aria-invalid/, /role=.alert/, /isInvalid/, /error/],
};

/**
 * Functional state → regex patterns to detect conditional rendering in JSX.
 *
 * Patterns are scoped to JSX usage contexts (conditional expressions, component
 * props, role attributes) to avoid false positives from comments or text content.
 */
export const FUNCTIONAL_STATE_PATTERNS: Record<string, RegExp[]> = {
  loading: [/\bisLoading\b\s*[&?]/, /\bloading\b\s*[&?]/, /<Spinner/, /role=["']status["']/],
  error: [/\berror\b\s*[&?]/, /\bisError\b/, /role=["']alert["']/, /aria-live/],
  deleting: [/\bisDeleting\b/, /\bdeleting\b\s*[&?]/],
  empty: [/\bisEmpty\b/, /\.length\s*===?\s*0/, /\bempty\b\s*[&?]/],
  success: [/\bisSuccess\b/, /\bsuccess\b\s*[&?]/],
  uploading: [/\bisUploading\b/, /\buploading\b\s*[&?]/],
  pending: [/\bpending\b\s*[&?]/, /\bisPending\b/],
  approved: [/\bisApproved\b/, /status\s*===?\s*["']approved["']/],
  rejected: [/\bisRejected\b/, /status\s*===?\s*["']rejected["']/],
};
