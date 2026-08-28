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
  ['⁰', '^{0}'], ['¹', '^{1}'], ['²', '^{2}'], ['³', '^{3}'], ['⁴', '^{4}'], ['⁵', '^{5}'], ['⁶', '^{6}'], ['⁷', '^{7}'], ['⁸', '^{8}'], ['⁹', '^{9}'],
  ['₀', '_{0}'], ['₁', '_{1}'], ['₂', '_{2}'], ['₃', '_{3}'], ['₄', '_{4}'], ['₅', '_{5}'], ['₆', '_{6}'], ['₇', '_{7}'], ['₈', '_{8}'], ['₉', '_{9}'],
  ['ᵀ', '^{T}'], ['ᵢ', '_{i}'], ['ⱼ', '_{j}'], ['ₐ', '_{a}'], ['ₑ', '_{e}'], ['ₙ', '_{n}'], ['ₛ', '_{s}'], ['ₓ', '_{x}'], ['ᵧ', '_{y}'],
  ['ᵃ', '^{a}'], ['ᵉ', '^{e}'], ['ᵍ', '^{g}'], ['ˡ', '^{l}'], ['ⁿ', '^{n}'],
]);

/** LaTeX's own reserved characters, escaped when they reach the output as literal text. */
const escapeLiteral = (character: string): string => {
  if (character === '\\') return '\\textbackslash{}';
  if (character === '~') return '\\textasciitilde{}';
  if (character === '^') return '\\textasciicircum{}';
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

const translateRun = (text: string): string =>
  segments(text)
    .map((segment) => {
      const body = joinTranslated(Array.from(segment.text).map(translateChar));
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
