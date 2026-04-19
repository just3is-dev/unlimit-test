/**
 * Typed representation of design-system/components.json
 */
export interface PropSpec {
  type?: string;
  values?: string[];
  default?: string | boolean;
  required?: boolean;
  note?: string;
}

export interface ComponentSpec {
  description: string;
  props: Record<string, PropSpec>;
  a11y: string;
}

export interface ComponentsJson {
  name: string;
  version: string;
  'import-base': string;
  convention: string;
  components: Record<string, ComponentSpec>;
}

/**
 * Typed representation of design-system/tokens.json
 * Top-level keys are categories; values are flat string maps.
 */
export interface TokensJson {
  $schema: string;
  name: string;
  version: string;
  convention: string;
  [category: string]: string | Record<string, string>;
}

/**
 * The shape passed to every agent as design-system context.
 * Agents use this for prompt injection and hallucination prevention.
 */
export interface DesignSystemContext {
  /** Allowed CSS custom-property names, e.g. "--color-brand-primary" */
  cssVariables: string[];

  /** Allowed component names, e.g. "Button", "Card" */
  componentNames: string[];

  /**
   * Full component specs for Analyzer / Generator prompts.
   * Key: component name.
   */
  componentSpecs: Record<string, ComponentSpec>;

  /**
   * Allowed values per Icon.name prop (special-cased for hallucination guard).
   */
  iconNames: string[];

  /**
   * Flat CSS-variable → value map (for reference in prompts).
   * e.g. { "--color-brand-primary": "#5B6CFF" }
   */
  cssVariableValues: Record<string, string>;

  /** Token import base, e.g. "@unlimit/ui" */
  importBase: string;
}
