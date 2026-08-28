import { describe, expect, it } from 'vitest';
import { atomize, translateExpression } from './mathLatex';

describe('translateExpression', () => {
  it('passes plain relations through unchanged', () => {
    expect(translateExpression('M(x) = 12.5x^2 - 3.2x + 1')).toBe('M(x) = 12.5x^{2} - 3.2x + 1');
  });

  it('maps Greek letters and operators to their LaTeX commands', () => {
    expect(translateExpression('ΔX ≤ Σ λ ± ∂ω')).toBe('\\Delta X \\le \\Sigma \\lambda \\pm \\partial \\omega');
  });

  it('stacks an implicit a/b word as \\frac, leaving a spaced division alone', () => {
    expect(translateExpression('dθ/dx = M/EI')).toBe('\\frac{d\\theta}{dx} = \\frac{M}{EI}');
    expect(translateExpression('||r|| / max(1, ||F||)')).toBe('||r|| / max(1, ||F||)');
  });

  it('wraps a radical whose argument spans a space, matching the engine\'s own equation', () => {
    expect(translateExpression('L = √(ΔX² + ΔY²)')).toBe('L = \\sqrt{\\Delta X^{2} + \\Delta Y^{2}}');
  });

  it('lowers a full alphanumeric run after ^/_, not just the first character', () => {
    expect(translateExpression('d_local')).toBe('d_{local}');
    expect(translateExpression('N_theta^T')).toBe('N_{theta}^{T}');
  });

  it('leaves a caret with nothing alphanumeric after it as a literal', () => {
    expect(translateExpression('10^(-3)')).toBe('10\\textasciicircum{}(-3)');
  });

  it('does not hang on unbalanced radical with missing closing paren', () => {
    // Regression test: unbalanced √( should not cause infinite loop
    const result = translateExpression('√(ΔX² + ΔY²');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    // The √ and ( should be treated as literals, content translated
    expect(result).toContain('Delta');
  });
});

describe('atomize', () => {
  it('splits on spaces outside any radical', () => {
    expect(atomize('M(x) = 12.5x^2')).toEqual(['M(x)', '=', '12.5x^2']);
  });

  it('keeps a radical whose argument spans a space as one atom', () => {
    expect(atomize('L = √(ΔX² + ΔY²)')).toEqual(['L', '=', '√(ΔX² + ΔY²)']);
  });

  it('does not hang on unbalanced radical with missing closing paren', () => {
    // Regression test: unbalanced √( should not cause infinite loop
    const result = atomize('√(ΔX² + ΔY²');
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    // The √( should be treated as separate atoms or literal text
    expect(result.length).toBeGreaterThan(0);
  });
});
