import { describe, expect, it } from 'vitest';
import { atomize, translateExpression } from './mathLatex';
import { typesetLatex } from './mathTypeset';

describe('translateExpression', () => {
  it('passes plain relations through unchanged, spacing words with an explicit \\ command', () => {
    expect(translateExpression('M(x) = 12.5x^2 - 3.2x + 1')).toBe('M(x)\\ =\\ 12.5x^{2}\\ -\\ 3.2x\\ +\\ 1');
  });

  it('maps Greek letters and operators to their LaTeX commands', () => {
    expect(translateExpression('ΔX ≤ Σ λ ± ∂ω')).toBe('\\Delta X\\ \\le\\ \\Sigma\\ \\lambda\\ \\pm\\ \\partial \\omega');
  });

  it('stacks an implicit a/b word as \\frac, leaving a spaced division alone', () => {
    expect(translateExpression('dθ/dx = M/EI')).toBe('\\frac{d\\theta}{dx}\\ =\\ \\frac{M}{EI}');
    expect(translateExpression('||r|| / max(1, ||F||)')).toBe('||r||\\ /\\ max(1,\\ ||F||)');
  });

  it('wraps a radical whose argument spans a space, matching the engine\'s own equation', () => {
    expect(translateExpression('L = √(ΔX² + ΔY²)')).toBe('L\\ = \\sqrt{\\Delta X^{2}\\ +\\ \\Delta Y^{2}}');
  });

  it('joins multi-word prose labels with \\ instead of a bare space, so words stay visibly separated', () => {
    // Regression test for the word-spacing-collapse bug: a bare ' ' join is invisible to TeX
    // math mode, so "q uniforme transversal" used to render as one illegible run.
    const result = translateExpression('q uniforme transversal');
    expect(result).toBe('q\\ uniforme\\ transversal');
    expect(result).not.toContain('q uniforme');
  });

  it('translates Unicode letter super/subscripts the solver emits, not just digit ones', () => {
    // Regression test: these used to pass through as raw Unicode, which MathJax's default
    // font cannot render (a "missing glyph" box). Mirrors the engine's real equation
    // (solver.ts): 'fₑˡ = ∫ₐᵇ Nᵀ(x) p(x) dx' and '...]ᵀ'.
    expect(translateExpression('x]ᵀ')).toBe('x]^{T}');
    expect(translateExpression('x]ᵀ')).not.toContain('ᵀ');
    expect(translateExpression('Nᵢ')).toBe('N_{i}');
    expect(translateExpression('Nⱼ')).toBe('N_{j}');
    expect(translateExpression('xₓ')).toBe('x_{x}');
    expect(translateExpression('fₑˡ')).toBe('f_{e}^{l}');
  });

  it('translates the real solver.ts equivalent-loads equation without leaving raw Unicode scripts', () => {
    const result = translateExpression('q uniforme transversal → [0, qL/2, qL²/12, 0, qL/2, −qL²/12]ᵀ');
    for (const scriptChar of ['ᵀ', 'ᵢ', 'ⱼ', 'ₐ', 'ₑ', 'ₙ', 'ₛ', 'ₓ', 'ᵧ', 'ᵃ', 'ᵉ', 'ᵍ', 'ˡ', 'ⁿ']) {
      expect(result).not.toContain(scriptChar);
    }
    expect(result).toContain('^{T}');
    expect(result).toContain('q\\ uniforme\\ transversal');
  });

  it('lowers a full alphanumeric run after ^/_, not just the first character', () => {
    expect(translateExpression('d_local')).toBe('d_{local}');
    expect(translateExpression('N_theta^T')).toBe('N_{theta}^{T}');
  });

  it('leaves a caret with nothing alphanumeric after it as a literal MathJax can typeset', () => {
    // Regression test: the literal escapes used to be `\textasciicircum{}` and friends —
    // text-mode macros the `['base', 'ams']` package set does not define, so MathJax replaced
    // the whole formula with an `merror` node that drew as a solid black bar. Pin the string,
    // then prove the string actually typesets.
    expect(translateExpression('10^(-3)')).toBe('10\\text{^}(-3)');
    expect(() => typesetLatex(translateExpression('10^(-3)'))).not.toThrow();
  });

  it('escapes a literal tilde and backslash into math-mode-safe LaTeX', () => {
    // Neither character reaches `escapeLiteral` from the solver's own equations today (a scan
    // of src/engine and src/analysis-methods finds none), so these are synthetic — the point is
    // that the substitution itself renders rather than erroring.
    expect(translateExpression('a~b')).toBe('a\\text{~}b');
    expect(translateExpression('a\\b')).toBe('a\\backslash b');
    expect(() => typesetLatex(translateExpression('a~b'))).not.toThrow();
    expect(() => typesetLatex(translateExpression('a\\b'))).not.toThrow();
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
