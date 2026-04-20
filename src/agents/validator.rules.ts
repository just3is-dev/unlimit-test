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

  Input: [
    {
      description: 'Input must have a label prop for screen reader association',
      test: (code) => {
        const inputs = code.match(/<Input[^>]*/g) ?? [];
        return inputs.every((tag) => /\blabel=/.test(tag) || /\baria-label=/.test(tag));
      },
    },
  ],

  Select: [
    {
      description: 'Select must have a label prop for screen reader association',
      test: (code) => {
        const selects = code.match(/<Select[^>]*/g) ?? [];
        return selects.every((tag) => /\blabel=/.test(tag) || /\baria-label=/.test(tag));
      },
    },
  ],

  Stepper: [
    {
      description: 'Stepper must have current prop set to indicate active step (aria-current)',
      test: (code) => {
        const steppers = code.match(/<Stepper[^>]*/g) ?? [];
        return steppers.every((tag) => /\bcurrent=/.test(tag));
      },
    },
  ],

  Spinner: [
    {
      description: 'Spinner should have a label prop for screen reader announcement',
      test: (code) => {
        const spinners = code.match(/<Spinner[^>]*/g) ?? [];
        return spinners.every((tag) => /\blabel=/.test(tag));
      },
    },
  ],
};
