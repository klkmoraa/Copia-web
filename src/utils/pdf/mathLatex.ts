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
  ['‖', '\\|'], ['≅', '\\cong'], ['≪', '\\ll'], ['≫', '\\gg'], ['∆', '\\Delta'], ['∓', '\\mp'],
  ['⌊', '\\lfloor'], ['⌋', '\\rfloor'], ['⌈', '\\lceil'], ['⌉', '\\rceil'], ['√', '\\surd'],
  // A moment's sense of rotation, which the free-body captions name in prose and the equations
  // beside them were spelling out as a literal arrow.
  ['↺', '\\circlearrowleft'], ['↻', '\\circlearrowright'],
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

/**
 * Spans of the expression that are a quotient, and where each operand starts and ends.
 *
 * The old rule looked for a `/` inside a single space-delimited word and refused any word
 * carrying a bracket, which ruled out nearly every quotient the report actually prints:
 * `(2 · 45.0)/(6.0)`, `(0.003)(2e+8)/(5.0)`, `EI/L`. Those came out as a slash in running text,
 * which is the one shape a reader has to parse twice.
 *
 * An operand runs from the slash out to the nearest space *at bracket depth zero* — a space
 * inside `(2 · 45.0)` belongs to the operand, a space around the whole quotient ends it. Two
 * cases are deliberately refused rather than guessed at: a second top-level slash in either
 * operand (`a/b/c` does not associate on its own) and an operand that is empty or unbalanced.
 */
interface FractionSpan {
  readonly start: number;
  readonly slash: number;
  readonly end: number;
}

/** True when `text` carries a `/` outside every bracket. */
const hasTopLevelSlash = (text: string): boolean => {
  let depth = 0;
  for (const character of text) {
    if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') depth -= 1;
    else if (character === '/' && depth === 0) return true;
  }
  return false;
};

const findFractionSpans = (expression: string): FractionSpan[] => {
  const spans: FractionSpan[] = [];
  let depth = 0;
  let index = 0;
  while (index < expression.length) {
    const character = expression[index];
    if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') depth -= 1;
    else if (character === '/' && depth === 0) {
      // Backwards to the space that ends the numerator, counting brackets in reverse.
      let start = index;
      let backDepth = 0;
      while (start > 0) {
        const previous = expression[start - 1];
        if (previous === ')' || previous === ']') backDepth += 1;
        else if (previous === '(' || previous === '[') backDepth -= 1;
        else if (previous === ' ' && backDepth === 0) break;
        start -= 1;
      }
      // Forwards to the space that ends the denominator.
      let end = index + 1;
      let forwardDepth = 0;
      while (end < expression.length) {
        const next = expression[end];
        if (next === '(' || next === '[') forwardDepth += 1;
        else if (next === ')' || next === ']') forwardDepth -= 1;
        else if (next === ' ' && forwardDepth === 0) break;
        end += 1;
      }
      const numerator = expression.slice(start, index);
      const denominator = expression.slice(index + 1, end);
      const usable = numerator.length > 0 && denominator.length > 0
        && !hasTopLevelSlash(numerator) && !hasTopLevelSlash(denominator)
        && !(spans.length && start < spans[spans.length - 1].end);
      if (usable) spans.push({ start, slash: index, end });
      index = end;
      continue;
    }
    if (depth < 0) return spans;
    index += 1;
  }
  return spans;
};

/**
 * Strips one layer of parentheses that wraps a whole operand.
 *
 * Inside a stacked fraction the bracket has no work left to do — the rule already groups the
 * numerator — and `\dfrac{(2 \cdot 45.0)}{(6.0)}` reads as if the brackets meant something.
 */
const unwrap = (operand: string): string => {
  if (!operand.startsWith('(') || !operand.endsWith(')')) return operand;
  let depth = 0;
  for (let index = 0; index < operand.length; index += 1) {
    if (operand[index] === '(') depth += 1;
    else if (operand[index] === ')') {
      depth -= 1;
      // The opening bracket closes before the end, so it does not wrap the whole operand.
      if (depth === 0 && index !== operand.length - 1) return operand;
    }
  }
  return depth === 0 ? operand.slice(1, -1) : operand;
};

const translateWord = (word: string): string => translateRun(word);

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
  if (!words) return run.length ? '\\ ' : '';
  // A run can now begin as well as end at a space, because `translateExpression` hands over
  // the text *between* two structural spans: `dθ/dx = M/EI` leaves ' = ' in the middle, and
  // dropping its leading space would butt the relation against the fraction before it.
  const lead = run.startsWith(' ') ? '\\ ' : '';
  const tail = run.endsWith(' ') ? '\\ ' : '';
  return lead + words + tail;
};

/**
 * Translates the run between two structural features — no radical, no quotient — as words.
 *
 * Kept separate so `translateExpression` reads as what it is: a walk over the spans that need
 * their own LaTeX structure, with plain prose in between.
 */
const translatePlain = (expression: string): string => {
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

export const translateExpression = (expression: string): string => {
  const spans = findFractionSpans(expression);
  if (!spans.length) return translatePlain(expression);
  let result = '';
  let cursor = 0;
  for (const span of spans) {
    result += translatePlain(expression.slice(cursor, span.start));
    const numerator = unwrap(expression.slice(span.start, span.slash));
    const denominator = unwrap(expression.slice(span.slash + 1, span.end));
    // `\dfrac` rather than `\frac`: a quotient inside a numbered relation *is* the relation,
    // and shrinking it to script size is what made these unreadable at 8.4 pt.
    result += `\\dfrac{${translateExpression(numerator)}}{${translateExpression(denominator)}}`;
    cursor = span.end;
  }
  result += translatePlain(expression.slice(cursor));
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
