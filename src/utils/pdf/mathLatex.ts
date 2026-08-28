/**
 * Translates the solver's own math notation — literal Unicode Greek/operators, `^`/`_` markers
 * for scripts, an implicit `a/b` word for a fraction, `√(...)` for a radical — into LaTeX source
 * MathJax can typeset. This is the one place that mapping lives: everything downstream draws
 * whatever MathJax lays out, so unlike the old `pdfGlyphs.ts` there is no per-glyph font choice
 * to get right here, only vocabulary.
 */

const SYMBOLS: ReadonlyMap<string, string> = new Map([
  ['α', '\\alpha'], ['β', '\\beta'], ['γ', '\\gamma'], ['Γ', '\\Gamma'], ['δ', '\\delta'], ['Δ', '\\Delta'],
  ['ε', '\\varepsilon'], ['ζ', '\\zeta'], ['η', '\\eta'], ['θ', '\\theta'], ['Θ', '\\Theta'], ['ϑ', '\\vartheta'],
  ['κ', '\\kappa'], ['λ', '\\lambda'], ['Λ', '\\Lambda'], ['μ', '\\mu'], ['ν', '\\nu'], ['ξ', '\\xi'], ['Ξ', '\\Xi'],
  ['π', '\\pi'], ['Π', '\\Pi'], ['ρ', '\\rho'], ['σ', '\\sigma'], ['ς', '\\varsigma'], ['Σ', '\\Sigma'], ['τ', '\\tau'],
  ['φ', '\\varphi'], ['Φ', '\\Phi'], ['ϕ', '\\phi'], ['χ', '\\chi'], ['ψ', '\\psi'], ['Ψ', '\\Psi'], ['ω', '\\omega'], ['Ω', '\\Omega'],
  ['∫', '\\int'], ['∑', '\\sum'], ['∏', '\\prod'], ['∂', '\\partial'], ['∇', '\\nabla'], ['∞', '\\infty'],
  ['∝', '\\propto'], ['∠', '\\angle'], ['∴', '\\therefore'], ['≈', '\\approx'], ['≡', '\\equiv'], ['∼', '\\sim'],
  ['≤', '\\le'], ['≥', '\\ge'], ['≠', '\\ne'], ['±', '\\pm'], ['×', '\\times'], ['÷', '\\div'], ['−', '-'],
  ['⋅', '\\cdot'], ['·', '\\cdot'], ['→', '\\rightarrow'], ['←', '\\leftarrow'], ['↑', '\\uparrow'], ['↓', '\\downarrow'],
  ['↔', '\\leftrightarrow'], ['⇒', '\\Rightarrow'], ['⇐', '\\Leftarrow'], ['⊗', '\\otimes'], ['⊕', '\\oplus'],
  ['∈', '\\in'], ['∉', '\\notin'], ['∅', '\\varnothing'], ['⊂', '\\subset'], ['⊃', '\\supset'], ['∩', '\\cap'],
  ['∪', '\\cup'], ['∀', '\\forall'], ['∃', '\\exists'], ['¬', '\\neg'], ['∧', '\\wedge'], ['∨', '\\vee'],
  ['′', "'"], ['″', "''"], ['ƒ', 'f'], ['°', '^\\circ'], ['∥', '\\parallel'], ['⟨', '\\langle'], ['⟩', '\\rangle'],
]);

/**
 * Unicode super/subscript characters, each as the direction it raises or lowers into and the
 * plain character that goes inside the LaTeX group.
 *
 * Deliberately *not* pre-wrapped in `^{…}`/`_{…}` the way `SYMBOLS` used to hold them: a run of
 * consecutive same-direction characters has to become ONE group. `Kbb⁻¹` (solver.ts's static
 * condensation, `k̄aa = Kaa − Kab Kbb⁻¹ Kba`) is a single power of −1 — mapped one character at
 * a time it produced `Kbb^{-}^{1}`, which is a "Double exponent" parse error, not an inverse.
 * `translateChars` below does the run merging, digits included (`¹²` → `^{12}`, not `^{1}^{2}`).
 */
const SCRIPTS: ReadonlyMap<string, { readonly level: 'super' | 'sub'; readonly base: string }> = new Map([
  ['⁰', { level: 'super', base: '0' }], ['¹', { level: 'super', base: '1' }], ['²', { level: 'super', base: '2' }],
  ['³', { level: 'super', base: '3' }], ['⁴', { level: 'super', base: '4' }], ['⁵', { level: 'super', base: '5' }],
  ['⁶', { level: 'super', base: '6' }], ['⁷', { level: 'super', base: '7' }], ['⁸', { level: 'super', base: '8' }],
  ['⁹', { level: 'super', base: '9' }],
  ['₀', { level: 'sub', base: '0' }], ['₁', { level: 'sub', base: '1' }], ['₂', { level: 'sub', base: '2' }],
  ['₃', { level: 'sub', base: '3' }], ['₄', { level: 'sub', base: '4' }], ['₅', { level: 'sub', base: '5' }],
  ['₆', { level: 'sub', base: '6' }], ['₇', { level: 'sub', base: '7' }], ['₈', { level: 'sub', base: '8' }],
  ['₉', { level: 'sub', base: '9' }],
  // Superscript letters and operators the engine emits.
  ['ᵀ', { level: 'super', base: 'T' }], ['ᵃ', { level: 'super', base: 'a' }], ['ᵇ', { level: 'super', base: 'b' }],
  ['ᵉ', { level: 'super', base: 'e' }], ['ᵍ', { level: 'super', base: 'g' }], ['ᵏ', { level: 'super', base: 'k' }],
  ['ˡ', { level: 'super', base: 'l' }], ['ⁿ', { level: 'super', base: 'n' }],
  ['⁻', { level: 'super', base: '-' }], ['⁺', { level: 'super', base: '+' }],
  // Subscript letters and operators.
  ['ₐ', { level: 'sub', base: 'a' }], ['ₑ', { level: 'sub', base: 'e' }], ['ᵢ', { level: 'sub', base: 'i' }],
  ['ⱼ', { level: 'sub', base: 'j' }], ['ₖ', { level: 'sub', base: 'k' }], ['ₗ', { level: 'sub', base: 'l' }],
  ['ₘ', { level: 'sub', base: 'm' }], ['ₙ', { level: 'sub', base: 'n' }], ['ᵣ', { level: 'sub', base: 'r' }],
  ['ₛ', { level: 'sub', base: 's' }], ['ₓ', { level: 'sub', base: 'x' }], ['ᵧ', { level: 'sub', base: 'y' }],
  ['₋', { level: 'sub', base: '-' }], ['₊', { level: 'sub', base: '+' }],
]);

/**
 * LaTeX's own reserved characters, escaped when they reach the output as literal text.
 *
 * `\textbackslash`, `\textasciitilde` and `\textasciicircum` are text-mode macros from the
 * wider LaTeX distribution: MathJax's `['base', 'ams']` package set (see `mathTypeset.ts`)
 * does not define them, so they used to raise "Undefined control sequence" — which MathJax
 * renders as a silent `merror` bar rather than throwing. `\text{^}` / `\text{~}` reach the
 * real U+005E / U+007E glyphs through the base kernel's own `\text`, and `\backslash` is a
 * plain math-mode command; all three were verified to typeset cleanly under this exact
 * TeX instance.
 */
const escapeLiteral = (character: string): string => {
  if (character === '\\') return '\\backslash';
  if (character === '~') return '\\text{~}';
  if (character === '^') return '\\text{^}';
  if ('#$%&{}'.includes(character)) return `\\${character}`;
  return character;
};

const translateChar = (character: string): string => SYMBOLS.get(character) ?? escapeLiteral(character);

/** Splits a run into baseline text and its `^`/`_` scripts — mirrors the old `pdfMath.ts` segmenter. */
const segments = (source: string): Array<{ text: string; level: 'base' | 'super' | 'sub' }> => {
  const parts: Array<{ text: string; level: 'base' | 'super' | 'sub' }> = [];
  let base = '';
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '^' || character === '_') {
      let end = index + 1;
      while (end < source.length && /[A-Za-z0-9]/.test(source[end])) end += 1;
      if (end > index + 1) {
        if (base) parts.push({ text: base, level: 'base' });
        base = '';
        parts.push({ text: source.slice(index + 1, end), level: character === '^' ? 'super' : 'sub' });
        index = end - 1;
        continue;
      }
    }
    base += character;
  }
  if (base) parts.push({ text: base, level: 'base' });
  return parts;
};

/** Joins translated characters, adding spaces after LaTeX commands when needed. */
const joinTranslated = (chars: string[]): string => {
  const result: string[] = [];
  for (let i = 0; i < chars.length; i += 1) {
    const current = chars[i];
    result.push(current);
    if (i < chars.length - 1) {
      const next = chars[i + 1];
      // Add space after a LaTeX command (starts with \, ends with letter)
      // if next is alphanumeric or starts with backslash
      if (current.startsWith('\\') && /[a-zA-Z]$/.test(current) && /[A-Za-z\\]/.test(next[0])) {
        result.push(' ');
      }
    }
  }
  return result.join('');
};

/**
 * Translates a run of characters, merging each maximal run of consecutive same-direction
 * Unicode script characters into one `^{…}`/`_{…}` group.
 *
 * This is the character-level counterpart of what `segments` does for the ASCII `^`/`_` DSL
 * markers, which already claim a whole alphanumeric run rather than a single character. A run
 * stops as soon as the direction changes, which needs no special case: `∫ₐᵇ` becoming
 * `\int_{a}^{b}` is two adjacent groups, and that is valid — and correct — LaTeX.
 */
const translateChars = (source: string): string => {
  const chars = Array.from(source);
  const pieces: string[] = [];
  for (let index = 0; index < chars.length; index += 1) {
    const script = SCRIPTS.get(chars[index]);
    if (!script) {
      pieces.push(translateChar(chars[index]));
      continue;
    }
    let body = script.base;
    let end = index + 1;
    while (end < chars.length) {
      const next = SCRIPTS.get(chars[end]);
      if (!next || next.level !== script.level) break;
      body += next.base;
      end += 1;
    }
    pieces.push(script.level === 'super' ? `^{${body}}` : `_{${body}}`);
    index = end - 1;
  }
  return joinTranslated(pieces);
};

const translateRun = (text: string): string =>
  segments(text)
    .map((segment) => {
      const body = translateChars(segment.text);
      if (segment.level === 'super') return `^{${body}}`;
      if (segment.level === 'sub') return `_{${body}}`;
      return body;
    })
    .join('');

/** A word is an implicit fraction when it holds exactly one `/` between two non-empty, bracket-free operands. */
const asFraction = (word: string): { numerator: string; denominator: string } | undefined => {
  const parts = word.split('/');
  if (parts.length !== 2) return undefined;
  const [numerator, denominator] = parts;
  if (!numerator || !denominator) return undefined;
  if (/[()[\]]/.test(word)) return undefined;
  return { numerator, denominator };
};

const translateWord = (word: string): string => {
  const fraction = asFraction(word);
  if (fraction) return `\\frac{${translateRun(fraction.numerator)}}{${translateRun(fraction.denominator)}}`;
  return translateRun(word);
};

/** Index just past the `)` matching the `(` at `openIndex`, or -1 if the expression never closes it. */
const matchParen = (expression: string, openIndex: number): number => {
  let depth = 0;
  for (let index = openIndex; index < expression.length; index += 1) {
    if (expression[index] === '(') depth += 1;
    else if (expression[index] === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
};

const translateRunOfWords = (run: string): string => {
  // TeX math mode ignores raw whitespace between ordinary atoms, so a bare ' ' join
  // collapses multi-word prose labels (e.g. "q uniforme transversal") into one illegible
  // run. '\ ' is TeX's explicit "insert an interword space" command.
  const words = run.split(' ').filter((word) => word.length > 0).map(translateWord).join('\\ ');
  return words + (run.endsWith(' ') ? ' ' : '');
};

export const translateExpression = (expression: string): string => {
  let result = '';
  let index = 0;
  while (index < expression.length) {
    let foundUnbalanced = false;
    if (expression[index] === '√' && index + 1 < expression.length && expression[index + 1] === '(') {
      const close = matchParen(expression, index + 1);
      if (close !== -1) {
        const inner = expression.slice(index + 2, close);
        result += `\\sqrt{${translateExpression(inner)}}`;
        index = close + 1;
        continue;
      }
      foundUnbalanced = true;
    }
    let next = expression.indexOf('√(', foundUnbalanced ? index + 1 : index);
    if (next === -1) next = expression.length;
    result += translateRunOfWords(expression.slice(index, next));
    index = next;
  }
  return result;
};

/** Line-wrap units for `pdfMath.ts`'s packer: plain words, except a whole `√(...)` span stays atomic. */
export const atomize = (expression: string): string[] => {
  const atoms: string[] = [];
  let index = 0;
  while (index < expression.length) {
    let foundUnbalanced = false;
    if (expression[index] === '√' && index + 1 < expression.length && expression[index + 1] === '(') {
      const close = matchParen(expression, index + 1);
      if (close !== -1) {
        atoms.push(expression.slice(index, close + 1));
        index = close + 1;
        continue;
      }
      foundUnbalanced = true;
    }
    let next = expression.indexOf('√(', foundUnbalanced ? index + 1 : index);
    if (next === -1) next = expression.length;
    atoms.push(...expression.slice(index, next).split(' ').filter((word) => word.length > 0));
    index = next;
  }
  return atoms;
};
