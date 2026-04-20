import { COMPONENT_A11Y_RULES } from '../src/reliability/a11y-guard.rules';

/**
 * Tests for a11y-guard.rules.ts — component-specific a11y checks.
 *
 * Key concerns:
 *  1. Word boundary: <Modal should NOT match <ModalContent
 *  2. Nested JSX: icon={<Icon name="trash" />} inside a tag should not
 *     cause the parser to stop early (before reaching aria-label)
 */
describe('COMPONENT_A11Y_RULES', () => {
  // ---------------------------------------------------------------------------
  // IconButton
  // ---------------------------------------------------------------------------
  describe('IconButton', () => {
    const [rule] = COMPONENT_A11Y_RULES['IconButton'];

    it('passes when aria-label is present', () => {
      const code = `<IconButton aria-label="Delete card" icon={<Icon name="trash" />} />`;
      expect(rule.test(code)).toBe(true);
    });

    it('fails when aria-label is missing', () => {
      const code = `<IconButton icon={<Icon name="trash" />} />`;
      expect(rule.test(code)).toBe(false);
    });

    it('finds aria-label even when nested JSX prop contains >', () => {
      // The > inside icon={<Icon ... />} should not terminate the tag match early
      const code = `<IconButton
        variant="destructive"
        icon={<Icon name="trash" aria-hidden={true} />}
        aria-label="Delete"
      />`;
      expect(rule.test(code)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Modal — word boundary check
  // ---------------------------------------------------------------------------
  describe('Modal', () => {
    const [rule] = COMPONENT_A11Y_RULES['Modal'];

    it('passes when title is present', () => {
      const code = `<Modal open={isOpen} title="Confirm delete" onClose={close} />`;
      expect(rule.test(code)).toBe(true);
    });

    it('fails when title is missing', () => {
      const code = `<Modal open={isOpen} onClose={close} />`;
      expect(rule.test(code)).toBe(false);
    });

    it('does NOT match <ModalContent as a <Modal tag', () => {
      // Without word boundary this would be a false positive
      const code = `<ModalContent last4="1234" />`;
      expect(rule.test(code)).toBe(true); // no Modal tags → every() on [] → true
    });

    it('handles mixed Modal and ModalContent correctly', () => {
      const code = `
        <Modal open title="Delete card">
          <ModalContent last4="1234" />
        </Modal>
      `;
      expect(rule.test(code)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Icon
  // ---------------------------------------------------------------------------
  describe('Icon', () => {
    const [rule] = COMPONENT_A11Y_RULES['Icon'];

    it('passes when aria-hidden is present', () => {
      const code = `<Icon name="trash" aria-hidden={true} />`;
      expect(rule.test(code)).toBe(true);
    });

    it('passes when aria-label is present', () => {
      const code = `<Icon name="visa" aria-label="Visa card" />`;
      expect(rule.test(code)).toBe(true);
    });

    it('fails when neither aria-hidden nor aria-label is present', () => {
      const code = `<Icon name="trash" />`;
      expect(rule.test(code)).toBe(false);
    });

    it('does NOT match <IconButton as an <Icon tag', () => {
      // <IconButton should not be caught by the Icon rule
      const code = `<IconButton aria-label="Delete" icon={<Icon name="trash" aria-hidden />} />`;
      // Only the inner <Icon has aria-hidden → passes
      expect(rule.test(code)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  describe('Input', () => {
    const [rule] = COMPONENT_A11Y_RULES['Input'];

    it('passes when label prop is present', () => {
      const code = `<Input label="Card number" value={value} onChange={onChange} />`;
      expect(rule.test(code)).toBe(true);
    });

    it('passes when aria-label is present', () => {
      const code = `<Input aria-label="Card number" value={value} />`;
      expect(rule.test(code)).toBe(true);
    });

    it('fails when neither label nor aria-label is present', () => {
      const code = `<Input value={value} onChange={onChange} />`;
      expect(rule.test(code)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Stepper
  // ---------------------------------------------------------------------------
  describe('Stepper', () => {
    const [rule] = COMPONENT_A11Y_RULES['Stepper'];

    it('passes when current prop is set', () => {
      const code = `<Stepper steps={steps} current={currentStep} status={status} />`;
      expect(rule.test(code)).toBe(true);
    });

    it('fails when current prop is missing', () => {
      const code = `<Stepper steps={steps} status={status} />`;
      expect(rule.test(code)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Spinner
  // ---------------------------------------------------------------------------
  describe('Spinner', () => {
    const [rule] = COMPONENT_A11Y_RULES['Spinner'];

    it('passes when label prop is present', () => {
      const code = `<Spinner label="Loading transactions" size="md" />`;
      expect(rule.test(code)).toBe(true);
    });

    it('fails when label prop is missing', () => {
      const code = `<Spinner size="md" />`;
      expect(rule.test(code)).toBe(false);
    });
  });
});
