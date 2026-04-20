import { HallucinationGuard } from '@/reliability/hallucination-guard';

// ---------------------------------------------------------------------------
// Minimal DesignSystemService mock
// ---------------------------------------------------------------------------
const mockDs = {
  isAllowedCssVariable: (v: string) =>
    ['--color-brand-primary', '--color-border', '--spacing-4', '--radius-md'].includes(v),
  isAllowedComponent: (n: string) =>
    ['Button', 'Card', 'Icon', 'IconButton', 'Modal', 'Spinner'].includes(n),
  getContext: () => ({
    iconNames: ['visa', 'mastercard', 'amex', 'check', 'trash'],
  }),
};

describe('HallucinationGuard', () => {
  let guard: HallucinationGuard;

  beforeEach(() => {
    guard = new HallucinationGuard(mockDs as any);
  });

  // ---- CSS variables -------------------------------------------------------

  it('passes when all CSS variables are in the allow-list', () => {
    const code = `
      .card { background: var(--color-brand-primary); border: 1px solid var(--color-border); }
    `;
    const result = guard.check([{ filename: 'Card.tsx', content: code }]);
    expect(result.passed).toBe(true);
    expect(result.unknownCssVars).toHaveLength(0);
  });

  it('catches unknown CSS variables', () => {
    const code = `color: var(--color-made-up); padding: var(--spacing-4);`;
    const result = guard.check([{ filename: 'Card.tsx', content: code }]);
    expect(result.passed).toBe(false);
    expect(result.unknownCssVars).toContain('--color-made-up');
    expect(result.unknownCssVars).not.toContain('--spacing-4');
  });

  it('deduplicates repeated unknown CSS vars', () => {
    const code = `var(--fake-token); var(--fake-token); var(--fake-token);`;
    const result = guard.check([{ filename: 'f.tsx', content: code }]);
    expect(result.unknownCssVars.filter((v) => v === '--fake-token')).toHaveLength(1);
  });

  // ---- Component imports ---------------------------------------------------

  it('passes when all imported components exist in DS', () => {
    const code = `import { Button, Card } from '@unlimit/ui';`;
    const result = guard.check([{ filename: 'f.tsx', content: code }]);
    expect(result.passed).toBe(true);
    expect(result.unknownComponents).toHaveLength(0);
  });

  it('catches components not in the DS', () => {
    const code = `import { Button, DatePicker } from '@unlimit/ui';`;
    const result = guard.check([{ filename: 'f.tsx', content: code }]);
    expect(result.passed).toBe(false);
    expect(result.unknownComponents).toContain('DatePicker');
    expect(result.unknownComponents).not.toContain('Button');
  });

  it('handles aliased imports without flagging the alias', () => {
    const code = `import { Button as Btn, Ghost } from '@unlimit/ui';`;
    const result = guard.check([{ filename: 'f.tsx', content: code }]);
    // Button (aliased) is valid; Ghost is not
    expect(result.unknownComponents).not.toContain('Button');
    expect(result.unknownComponents).not.toContain('Btn');
    expect(result.unknownComponents).toContain('Ghost');
  });

  // ---- Icon names ----------------------------------------------------------

  it('passes when all Icon names are valid', () => {
    const code = `<Icon name="visa" /><Icon name="trash" />`;
    const result = guard.check([{ filename: 'f.tsx', content: code }]);
    expect(result.passed).toBe(true);
    expect(result.unknownIconNames).toHaveLength(0);
  });

  it('catches unknown Icon names', () => {
    const code = `<Icon name="diners" /><Icon name="visa" />`;
    const result = guard.check([{ filename: 'f.tsx', content: code }]);
    expect(result.passed).toBe(false);
    expect(result.unknownIconNames).toContain('diners');
    expect(result.unknownIconNames).not.toContain('visa');
  });

  // ---- Feedback prompt -----------------------------------------------------

  it('returns empty feedbackPrompt when passed', () => {
    const code = `import { Button } from '@unlimit/ui'; color: var(--color-border);`;
    const result = guard.check([{ filename: 'f.tsx', content: code }]);
    expect(result.feedbackPrompt).toBe('');
  });

  it('feedback prompt mentions all violation categories', () => {
    const code = `
      import { Phantom } from '@unlimit/ui';
      color: var(--fake-var);
      <Icon name="fake-icon" />
    `;
    const result = guard.check([{ filename: 'f.tsx', content: code }]);
    expect(result.feedbackPrompt).toContain('--fake-var');
    expect(result.feedbackPrompt).toContain('Phantom');
    expect(result.feedbackPrompt).toContain('fake-icon');
  });

  // ---- Multi-file support --------------------------------------------------

  it('checks across multiple files', () => {
    const files = [
      { filename: 'Component.tsx', content: `import { Ghost } from '@unlimit/ui';` },
      { filename: 'Component.module.css', content: `color: var(--fake-token);` },
    ];
    const result = guard.check(files);
    expect(result.passed).toBe(false);
    expect(result.unknownComponents).toContain('Ghost');
    expect(result.unknownCssVars).toContain('--fake-token');
  });
});
