import { A11yRule } from './validator.types';

/**
 * Component-specific a11y rules derived from components.json `a11y` fields.
 * Only rules that can be checked deterministically via regex.
 */
export const COMPONENT_A11Y_RULES: Record<string, A11yRule[]> = {
  IconButton: [
    {
      description: 'IconButton must have aria-label',
      test: (code) => {
        // Every <IconButton must have aria-label somewhere nearby
        const iconButtons = code.match(/<IconButton[^>]*/g) ?? [];
        return iconButtons.every((tag) => /aria-label/.test(tag));
      },
    },
  ],
  Icon: [
    {
      description: 'Icon must be either decorative (aria-hidden) or meaningful (aria-label)',
      test: (code) => {
        const icons = code.match(/<Icon[^>]*/g) ?? [];
        return icons.every((tag) => /aria-hidden/.test(tag) || /aria-label/.test(tag));
      },
    },
  ],
  Modal: [
    {
      description: 'Modal must have a title prop',
      test: (code) => {
        const modals = code.match(/<Modal[^>]*/g) ?? [];
        return modals.every((tag) => /\btitle=/.test(tag));
      },
    },
  ],
};
