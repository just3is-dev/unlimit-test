import { StateCovered } from '@/pipeline/schemas';
import { CoverageCheck } from '@/reliability/coverage-check';

describe('CoverageCheck', () => {
  let check: CoverageCheck;

  beforeEach(() => {
    check = new CoverageCheck();
  });

  const file = (content: string) => [{ filename: 'Component.tsx', content }];

  // ---- Full coverage -------------------------------------------------------

  it('passes when all required states are covered', () => {
    const required = ['hover', 'focus-visible', 'loading', 'error'];
    const covered: StateCovered[] = [
      { name: 'hover', kind: 'css' },
      { name: 'focus-visible', kind: 'css' },
      { name: 'loading', kind: 'functional' },
      { name: 'error', kind: 'functional' },
    ];
    const code = `
      .card:hover { }
      .card:focus-visible { }
      {isLoading && <Spinner />}
      {error && <p role="alert">{error}</p>}
    `;
    const result = check.check(required, covered, file(code));
    expect(result.passed).toBe(true);
    expect(result.missingInCode).toHaveLength(0);
    expect(result.ratio).toBe('4/4');
  });

  // ---- Default state -------------------------------------------------------

  it('ignores "default" state in required count', () => {
    const required = ['default', 'hover'];
    const covered: StateCovered[] = [{ name: 'hover', kind: 'css' }];
    const code = `.card:hover {}`;
    const result = check.check(required, covered, file(code));
    expect(result.passed).toBe(true);
    expect(result.ratio).toBe('1/1'); // default excluded from count
  });

  // ---- CSS states ----------------------------------------------------------

  it('detects hover via :hover pseudo-class', () => {
    const result = check.check(
      ['hover'],
      [{ name: 'hover', kind: 'css' }],
      file('.card:hover { background: red; }'),
    );
    expect(result.passed).toBe(true);
  });

  it('detects disabled via aria-disabled attribute', () => {
    const result = check.check(
      ['disabled'],
      [{ name: 'disabled', kind: 'css' }],
      file('<Card aria-disabled={isDisabled} />'),
    );
    expect(result.passed).toBe(true);
  });

  it('detects selected via aria-pressed', () => {
    const result = check.check(
      ['selected'],
      [{ name: 'selected', kind: 'css' }],
      file('<Card aria-pressed={isSelected} />'),
    );
    expect(result.passed).toBe(true);
  });

  it('flags CSS state when pattern is absent from code', () => {
    const result = check.check(
      ['hover'],
      [{ name: 'hover', kind: 'css' }],
      file('<div className="card">no hover here</div>'),
    );
    expect(result.passed).toBe(false);
    expect(result.missingInCode).toContain('hover');
  });

  // ---- Functional states ---------------------------------------------------

  it('detects loading via isLoading conditional', () => {
    const result = check.check(
      ['loading'],
      [{ name: 'loading', kind: 'functional' }],
      file('{isLoading && <Spinner label="Loading..." />}'),
    );
    expect(result.passed).toBe(true);
  });

  it('detects error via role="alert"', () => {
    const result = check.check(
      ['error'],
      [{ name: 'error', kind: 'functional' }],
      file('<p role="alert">{errorMessage}</p>'),
    );
    expect(result.passed).toBe(true);
  });

  it('detects deleting via isDeleting', () => {
    const result = check.check(
      ['deleting'],
      [{ name: 'deleting', kind: 'functional' }],
      file('{isDeleting ? <Spinner /> : <IconButton icon={<Icon name="trash" />} />}'),
    );
    expect(result.passed).toBe(true);
  });

  it('flags functional state when pattern is absent', () => {
    const result = check.check(
      ['loading'],
      [{ name: 'loading', kind: 'functional' }],
      file('<div>no loading state here</div>'),
    );
    expect(result.passed).toBe(false);
    expect(result.missingInCode).toContain('loading');
  });

  // ---- Not claimed ---------------------------------------------------------

  it('flags state not present in states_covered at all', () => {
    const result = check.check(
      ['error'],
      [], // generator did not claim error
      file('{error && <p>{error}</p>}'),
    );
    expect(result.passed).toBe(false);
    expect(result.missingInCode).toContain('error');
  });

  // ---- Ratio and feedback --------------------------------------------------

  it('ratio reflects partial coverage', () => {
    const required = ['hover', 'loading', 'error'];
    const covered: StateCovered[] = [
      { name: 'hover', kind: 'css' },
      { name: 'loading', kind: 'functional' },
      // error not covered
    ];
    const code = `.card:hover {} {isLoading && <Spinner />}`;
    const result = check.check(required, covered, file(code));
    expect(result.ratio).toBe('2/3');
    expect(result.passed).toBe(false);
  });

  it('feedback mentions missing state with implementation hint', () => {
    const result = check.check(
      ['loading'],
      [{ name: 'loading', kind: 'functional' }],
      file('<div>no loading</div>'),
    );
    expect(result.feedbackPrompt).toContain('"loading"');
    expect(result.feedbackPrompt).toContain('functional');
  });

  it('returns empty feedbackPrompt when passed', () => {
    const result = check.check(
      ['hover'],
      [{ name: 'hover', kind: 'css' }],
      file('.card:hover {}'),
    );
    expect(result.feedbackPrompt).toBe('');
  });
});
