import { readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import {
  ComponentsJson,
  ComponentSpec,
  DesignSystemContext,
  TokensJson,
} from './design-system.types';

/**
 * DesignSystemService — single source of truth for the design system.
 *
 * Responsibilities:
 *  1. Load tokens.json + components.json at startup (synchronous, cached).
 *  2. Flatten tokens into CSS-variable allow-list for HallucinationGuard.
 *  3. Expose component specs for Analyzer / Generator prompt injection.
 *  4. Provide `getContext()` — the DesignSystemContext injected into every agent.
 *
 * Token flattening convention (from tokens.json `"convention"` field):
 *   category.key  →  --{category}-{key}
 *   e.g. color.brand-primary → --color-brand-primary
 *        font-family.sans    → --font-family-sans
 *
 * Allow-list is used by HallucinationGuard to catch non-existent tokens and components.
 */
@Injectable()
export class DesignSystemService implements OnModuleInit {
  private readonly logger = new Logger(DesignSystemService.name);

  private context!: DesignSystemContext;

  // process.cwd() resolves to the project root regardless of whether we're
  // running via ts-node (src/design-system/) or compiled output (dist/src/design-system/).
  private readonly dsDir = join(process.cwd(), 'design-system');

  onModuleInit(): void {
    this.context = this.build();
    this.logger.log(
      `Loaded ${this.context.cssVariables.length} CSS variables, ` +
        `${this.context.componentNames.length} components`,
    );
  }

  /** Returns the pre-built, cached DesignSystemContext. */
  getContext(): DesignSystemContext {
    return this.context;
  }

  /**
   * Convenience: is a CSS variable name in the allow-list?
   * Used by HallucinationGuard.
   */
  isAllowedCssVariable(name: string): boolean {
    return this.context.cssVariables.includes(name);
  }

  /**
   * Convenience: is a component name in the allow-list?
   * Used by HallucinationGuard.
   */
  isAllowedComponent(name: string): boolean {
    return this.context.componentNames.includes(name);
  }

  /**
   * Returns the a11y rules relevant to the given component names.
   * Used by ValidatorAgent.
   */
  getA11yRules(usedComponents: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const name of usedComponents) {
      const spec = this.context.componentSpecs[name];
      if (spec) result[name] = spec.a11y;
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Private — build helpers
  // ---------------------------------------------------------------------------

  private build(): DesignSystemContext {
    const tokens = this.loadJson<TokensJson>('tokens.json');
    const componentsJson = this.loadJson<ComponentsJson>('components.json');

    const { cssVariables, cssVariableValues } = this.flattenTokens(tokens);
    const componentSpecs: Record<string, ComponentSpec> = componentsJson.components;
    const componentNames = Object.keys(componentSpecs);

    // Extract Icon.name allowed values for targeted hallucination checks
    const iconNames: string[] = componentSpecs['Icon']?.props?.['name']?.values ?? [];

    return {
      cssVariables,
      cssVariableValues,
      componentNames,
      componentSpecs,
      iconNames,
      importBase: componentsJson['import-base'],
    };
  }

  /**
   * Flatten token categories into CSS custom-property names + value map.
   *
   * Only processes keys whose values are plain objects (skips metadata keys
   * like $schema, name, version, convention which are strings).
   */
  private flattenTokens(tokens: TokensJson): {
    cssVariables: string[];
    cssVariableValues: Record<string, string>;
  } {
    const cssVariables: string[] = [];
    const cssVariableValues: Record<string, string> = {};

    const SKIP_KEYS = new Set(['$schema', 'name', 'version', 'convention']);

    for (const [category, value] of Object.entries(tokens)) {
      if (SKIP_KEYS.has(category)) continue;
      if (typeof value !== 'object' || value === null) continue;

      for (const [key, tokenValue] of Object.entries(value as Record<string, string>)) {
        const cssVar = `--${category}-${key}`;
        cssVariables.push(cssVar);
        cssVariableValues[cssVar] = tokenValue;
      }
    }

    return { cssVariables, cssVariableValues };
  }

  private loadJson<T>(filename: string): T {
    const filePath = join(this.dsDir, filename);
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
    } catch (err) {
      throw new Error(`DesignSystemService: failed to load ${filePath}: ${String(err)}`);
    }
  }
}
