import { Injectable, Logger } from '@nestjs/common';

import { DesignSystemService } from '@/design-system/design-system.service';

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

/**
 * HallucinationGuard — deterministic post-check on generated code.
 *
 * Extracts all DS references from the generated TSX/CSS and validates them
 * against the DesignSystemService allow-lists:
 *   1. CSS custom properties: var(--...) → must be in tokens allow-list
 *   2. @unlimit/ui imports → component names must be in components allow-list
 *   3. <Icon name="..."> values → must be in Icon.name values allow-list
 *
 * Returns a structured result. PipelineService / ValidatorAgent uses this to
 * populate hallucinations_caught and, if needed, re-prompt the Generator.
 *
 * See ADR-002 for reliability strategy.
 */
@Injectable()
export class HallucinationGuard {
  private readonly logger = new Logger(HallucinationGuard.name);

  // Matches: var(--color-brand-primary) → captures "--color-brand-primary"
  private static readonly CSS_VAR_RE = /var\((--[\w-]+)\)/g;

  // Matches: import { Button, Card } from '@unlimit/ui'
  // Captures the brace content: "Button, Card"
  private static readonly IMPORT_RE = /import\s*\{([^}]+)\}\s*from\s*['"]@unlimit\/ui['"]/g;

  // Matches static icon name values: name="visa" or name={'visa'}
  // Dynamic expressions like name={brand} are intentionally skipped —
  // their values are unknown at static analysis time and cannot be validated.
  private static readonly ICON_NAME_RE = /<Icon[^>]*\bname=["'{`]([^"'{`\s]+)["'{`]/g;

  constructor(private readonly ds: DesignSystemService) {}

  /**
   * Run the hallucination check against all files in the generator output.
   * @param files - Array of { filename, content } from GeneratorOutput
   */
  check(files: Array<{ filename: string; content: string }>): HallucinationResult {
    const allCode = files.map((f) => f.content).join('\n');

    const unknownCssVars = this.checkCssVars(allCode);
    const unknownComponents = this.checkComponents(allCode);
    const unknownIconNames = this.checkIconNames(allCode);

    const passed =
      unknownCssVars.length === 0 &&
      unknownComponents.length === 0 &&
      unknownIconNames.length === 0;

    if (!passed) {
      this.logger.warn(
        `Hallucinations detected — CSS vars: [${unknownCssVars.join(', ')}] | ` +
          `Components: [${unknownComponents.join(', ')}] | ` +
          `Icon names: [${unknownIconNames.join(', ')}]`,
      );
    }

    return {
      passed,
      unknownCssVars,
      unknownComponents,
      unknownIconNames,
      feedbackPrompt: passed
        ? ''
        : this.buildFeedback(unknownCssVars, unknownComponents, unknownIconNames),
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private checkCssVars(code: string): string[] {
    const used = this.extractMatches(code, HallucinationGuard.CSS_VAR_RE, 1);
    return [...new Set(used)].filter((v) => !this.ds.isAllowedCssVariable(v));
  }

  private checkComponents(code: string): string[] {
    const imported: string[] = [];
    for (const match of code.matchAll(HallucinationGuard.IMPORT_RE)) {
      const names = match[1]
        .split(',')
        .map((n) =>
          n
            .trim()
            .split(/\s+as\s+/)[0]
            .trim(),
        ) // handle "Button as Btn"
        .filter(Boolean);
      imported.push(...names);
    }
    return [...new Set(imported)].filter((n) => !this.ds.isAllowedComponent(n));
  }

  private checkIconNames(code: string): string[] {
    const used = this.extractMatches(code, HallucinationGuard.ICON_NAME_RE, 1);
    const { iconNames } = this.ds.getContext();
    return [...new Set(used)].filter((n) => !iconNames.includes(n));
  }

  private extractMatches(code: string, re: RegExp, group: number): string[] {
    const results: string[] = [];
    // Reset lastIndex since we reuse compiled regexes via matchAll
    for (const match of code.matchAll(re)) {
      if (match[group]) results.push(match[group]);
    }
    return results;
  }

  private buildFeedback(
    unknownCssVars: string[],
    unknownComponents: string[],
    unknownIconNames: string[],
  ): string {
    const lines: string[] = [
      'Your generated code references design system tokens or components that do not exist.',
      'Fix all the issues below and regenerate the component:',
      '',
    ];

    if (unknownCssVars.length) {
      lines.push(`Invalid CSS custom properties (not in design system):`);
      unknownCssVars.forEach((v) => lines.push(`  - ${v}`));
      lines.push('  → Use only the CSS variables listed in the design system context.');
      lines.push('');
    }

    if (unknownComponents.length) {
      lines.push(`Invalid @unlimit/ui imports (components do not exist):`);
      unknownComponents.forEach((c) => lines.push(`  - ${c}`));
      lines.push('  → Import only components listed in the design system context.');
      lines.push('');
    }

    if (unknownIconNames.length) {
      lines.push(`Invalid Icon name values (not in the icon set):`);
      unknownIconNames.forEach((n) => lines.push(`  - "${n}"`));
      lines.push('  → Use only icon names listed in the Icon component props.');
      lines.push('');
    }

    return lines.join('\n');
  }
}
