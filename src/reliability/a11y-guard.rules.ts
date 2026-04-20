import type { A11yRule } from './a11y-guard.types';

/**
 * Extracts all JSX opening tags for a component by name.
 *
 * Fixes two problems with naive `/<Foo[^>]*>/g`:
 *  1. No word boundary — `<Modal` would also match `<ModalContent`.
 *  2. `[^>]*` stops at the first `>`, which may be inside a nested JSX expression
 *     like `icon={<Icon name="trash" />}`, cutting off before `aria-label`.
 *
 * This mini-parser tracks brace depth so it only stops at a top-level `>`.
 */
function extractTags(code: string, name: string): string[] {
  const result: string[] = [];
  const startRe = new RegExp(`<${name}\\b`, 'g');
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(code)) !== null) {
    let depth = 0;
    for (let i = m.index + m[0].length; i < code.length; i++) {
      const ch = code[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) {
        result.push(code.slice(m.index, i + 1));
        break;
      }
    }
  }
  return result;
}

/**
 * Component-specific a11y rules derived from components.json `a11y` fields.
 * Only rules that can be checked deterministically via regex.
 *
 * Keyed by DS component name (must match the name in @unlimit/ui exports).
 */
export const COMPONENT_A11Y_RULES: Record<string, A11yRule[]> = {
  IconButton: [
    {
      description: 'IconButton must have aria-label',
      test: (code) => {
        const tags = extractTags(code, 'IconButton');
        return tags.every((tag) => /aria-label/.test(tag));
      },
    },
  ],

  Icon: [
    {
      description: 'Icon must be either decorative (aria-hidden) or meaningful (aria-label)',
      test: (code) => {
        const tags = extractTags(code, 'Icon');
        return tags.every((tag) => /aria-hidden/.test(tag) || /aria-label/.test(tag));
      },
    },
  ],

  Modal: [
    {
      description: 'Modal must have a title prop',
      test: (code) => {
        const tags = extractTags(code, 'Modal');
        return tags.every((tag) => /\btitle=/.test(tag));
      },
    },
  ],

  Input: [
    {
      description: 'Input must have a label prop for screen reader association',
      test: (code) => {
        const tags = extractTags(code, 'Input');
        return tags.every((tag) => /\blabel=/.test(tag) || /\baria-label=/.test(tag));
      },
    },
  ],

  Select: [
    {
      description: 'Select must have a label prop for screen reader association',
      test: (code) => {
        const tags = extractTags(code, 'Select');
        return tags.every((tag) => /\blabel=/.test(tag) || /\baria-label=/.test(tag));
      },
    },
  ],

  Stepper: [
    {
      description: 'Stepper must have current prop set to indicate active step (aria-current)',
      test: (code) => {
        const tags = extractTags(code, 'Stepper');
        return tags.every((tag) => /\bcurrent=/.test(tag));
      },
    },
  ],

  Spinner: [
    {
      description: 'Spinner should have a label prop for screen reader announcement',
      test: (code) => {
        const tags = extractTags(code, 'Spinner');
        return tags.every((tag) => /\blabel=/.test(tag));
      },
    },
  ],
};
