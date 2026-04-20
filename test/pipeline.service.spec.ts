import { PipelineContext } from '@/pipeline/pipeline.context';
import { PipelineService } from '@/pipeline/pipeline.service';
import { FinalOutputSchema } from '@/pipeline/schemas';

/**
 * Integration test for PipelineService orchestration.
 * Uses stub agents — no LLM calls made.
 */
describe('PipelineService (stub agents)', () => {
  let service: PipelineService;

  const stubParserOutput = {
    component: { name: 'TestCard', type: 'card' as const, business_context: 'Test' },
    extraction: { specified_states: ['default', 'selected'], tokens_referenced: [], constraints: [] },
  };

  const stubAnalyzerOutput = {
    gap_analysis: {
      missing_states: ['hover', 'focus-visible'],
      accessibility_gaps: [],
      responsive_gaps: [],
      recommendations: [],
    },
  };

  const stubGeneratorOutput = {
    generated_code: {
      framework: 'react' as const,
      files: [{ filename: 'TestCard.tsx', content: 'export const TestCard = () => <div />;' }],
      states_covered: [
        { name: 'default', kind: 'css' as const },
        { name: 'selected', kind: 'css' as const },
        { name: 'hover', kind: 'css' as const },
        { name: 'focus-visible', kind: 'css' as const },
      ],
      tokens_used: ['--color-brand-primary'],
    },
  };

  beforeEach(() => {
    const mockDs = {
      getContext: () => ({ cssVariables: [], componentNames: [], componentSpecs: {}, iconNames: [], cssVariableValues: {}, importBase: '@unlimit/ui' }),
    };

    const mockParser = { run: jest.fn().mockResolvedValue(stubParserOutput) };
    const mockAnalyzer = { run: jest.fn().mockResolvedValue(stubAnalyzerOutput) };
    const mockGenerator = { run: jest.fn().mockResolvedValue(stubGeneratorOutput) };
    const mockValidator = {
      run: jest.fn().mockResolvedValue({
        validation: {
          token_compliance: true,
          states_coverage: '4/4',
          accessibility_score: '5/5',
          issues_found: [],
          hallucinations_caught: [],
        },
      }),
    };

    service = new PipelineService(
      mockDs as any,
      mockParser as any,
      mockAnalyzer as any,
      mockGenerator as any,
      mockValidator as any,
    );
  });

  it('runs all four stages in order', async () => {
    const result = await service.run('A test card component.');

    expect(result).toBeDefined();
    expect(result.component.name).toBe('TestCard');
    expect(result.gap_analysis.missing_states).toContain('hover');
    expect(result.generated_code.states_covered).toContain('selected');
    expect(result.validation.token_compliance).toBe(true);
  });

  it('output conforms to FinalOutputSchema', async () => {
    const result = await service.run('A test card component.');
    const parsed = FinalOutputSchema.safeParse(result);

    expect(parsed.success).toBe(true);
  });

  it('flattens states_covered from {name,kind} to string[]', async () => {
    const result = await service.run('A test card component.');

    expect(result.generated_code.states_covered).toEqual(
      expect.arrayContaining(['default', 'selected', 'hover', 'focus-visible']),
    );
    // No {name,kind} objects — must be plain strings
    result.generated_code.states_covered.forEach((s) => {
      expect(typeof s).toBe('string');
    });
  });

  it('PipelineContext.requiredStates merges specified + missing without duplicates', () => {
    const ctx = new PipelineContext('test', {} as any);
    ctx.parserOutput = stubParserOutput;
    ctx.analyzerOutput = stubAnalyzerOutput;

    const required = ctx.requiredStates;
    expect(required).toContain('default');
    expect(required).toContain('selected');
    expect(required).toContain('hover');
    expect(required).toContain('focus-visible');
    // No duplicates
    expect(required.length).toBe(new Set(required).size);
  });
});
