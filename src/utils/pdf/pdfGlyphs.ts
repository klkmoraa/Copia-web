/**
 * Text sanitising and wrapping for the standard PDF fonts.
 *
 * Two audiences, two rules. Prose is drawn in Helvetica, which only carries WinAnsi, so
 * `pdfText` transliterates every engineering glyph explicitly instead of dropping to a
 * replacement box. Fórmulas are drawn by `pdfMath`, which also has the Symbol face embedded,
 * so `mathText` *keeps* the Greek and the operators Symbol can render and transliterates only
 * what it cannot. That difference is the whole reason the annex used to print the engine's
 * `L = √(ΔX² + ΔY²)` as `L = sqrt(DeltaX^2 + DeltaY^2)`.
 *
 * Both share the script table: `²` and `ⱼ` become the `^`/`_` markers that `drawMathFormula`
 * raises and lowers. In prose those markers stay literal, which is the most honest rendering
 * Helvetica can offer.
 */
import type { PDFFont } from 'pdf-lib';

/**
 * Unicode super/subscripts, as the `^x`/`_x` markers the fórmula typesetter understands.
 *
 * `ᵢ` (U+1D62) and `ⱼ` (U+2C7C) are Unicode *subscripts*. They were mapped to `^i`/`^j`,
 * which printed the solver's `ΔX = Xⱼ − Xᵢ` — a difference between node indices — as if the
 * indices were exponents.
 */
const SCRIPT_GLYPHS = new Map<string, string>([
  ['²', '^2'], ['³', '^3'], ['⁴', '^4'], ['⁵', '^5'], ['⁶', '^6'], ['⁷', '^7'], ['⁸', '^8'], ['⁹', '^9'], ['⁰', '^0'], ['ᵀ', '^T'],
  ['₀', '_0'], ['₁', '_1'], ['₂', '_2'], ['₃', '_3'], ['₄', '_4'], ['₅', '_5'], ['₆', '_6'], ['₇', '_7'], ['₈', '_8'], ['₉', '_9'],
  ['ₐ', '_a'], ['ₑ', '_e'], ['ₙ', '_n'], ['ₛ', '_s'], ['ₓ', '_x'], ['ᵧ', '_y'], ['ᵢ', '_i'], ['ⱼ', '_j'],
  ['ᵃ', '^a'], ['ᵉ', '^e'], ['ᵍ', '^g'], ['ˡ', '^l'], ['ⁿ', '^n'],
]);

/**
 * Glyphs the Adobe Symbol face renders, so `mathText` leaves them alone for `pdfMath` to
 * draw in that font. Every entry is asserted encodable in `pdfGlyphs.test.ts`; `·`, `∥`,
 * `⟨` and `⟩` are deliberately absent because Symbol has no glyph for them.
 */
export const SYMBOL_GLYPHS = new Set<string>([
  'α', 'β', 'γ', 'Γ', 'δ', 'Δ', 'ε', 'ζ', 'η', 'θ', 'Θ', 'ϑ', 'κ', 'λ', 'Λ', 'μ', 'ν',
  'ξ', 'Ξ', 'π', 'Π', 'ρ', 'σ', 'ς', 'Σ', 'τ', 'φ', 'Φ', 'ϕ', 'χ', 'ψ', 'Ψ', 'ω', 'Ω',
  '√', '∫', '∑', '∏', '∂', '∇', '∞', '∝', '∠', '∴', '≈', '≡', '∼', '≤', '≥', '≠',
  '±', '×', '÷', '−', '⋅', '→', '←', '↑', '↓', '↔', '⇒', '⇐', '⊗', '⊕',
  '∈', '∉', '∅', '⊂', '⊃', '∩', '∪', '∀', '∃', '¬', '∧', '∨', '′', '″', 'ƒ', '°',
]);

/** Standard PDF fonts use WinAnsi; transliterate engineering glyphs explicitly. */
const PDF_GLYPHS = new Map<string, string>([
  ...SCRIPT_GLYPHS,
  ['−', '-'], ['–', '-'], ['—', '-'], ['·', ' x '], ['⋅', ' x '],
  ['Σ', 'Sum'], ['∑', 'Sum'], ['Δ', 'Delta'], ['δ', 'delta'], ['θ', 'theta'], ['Θ', 'Theta'], ['ξ', 'xi'], ['Ξ', 'Xi'],
  ['α', 'alpha'], ['β', 'beta'], ['γ', 'gamma'], ['Γ', 'Gamma'], ['ε', 'epsilon'], ['ζ', 'zeta'], ['η', 'eta'],
  ['κ', 'kappa'], ['λ', 'lambda'], ['Λ', 'Lambda'], ['μ', 'mu'], ['ν', 'nu'], ['π', 'pi'], ['Π', 'Pi'],
  ['ρ', 'rho'], ['σ', 'sigma'], ['τ', 'tau'], ['φ', 'phi'], ['Φ', 'Phi'], ['χ', 'chi'], ['ψ', 'psi'], ['ω', 'omega'], ['Ω', 'Omega'],
  ['≤', '<='], ['≥', '>='], ['≈', '~='], ['≠', '!='], ['±', '+/-'], ['×', ' x '], ['÷', '/'],
  ['→', '->'], ['←', '<-'], ['↔', '<->'], ['⇒', '=>'], ['⇐', '<='], ['√', 'sqrt'], ['∫', 'Integral'],
  ['∞', 'inf'], ['∂', 'd'], ['∇', 'grad'], ['∥', '||'], ['⊗', '(x)'], ['⊕', '(+)'],
  ['“', '"'], ['”', '"'], ['‘', "'"], ['’', "'"], ['…', '...'], ['⟨', '<'], ['⟩', '>'],
]);

/** WinAnsi covers Latin-1, so `á é í ó ú ñ ü ¿ ¡ °` survive; anything above it does not. */
const isWinAnsi = (character: string): boolean => {
  const code = character.charCodeAt(0);
  return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 255);
};

const transliterate = (value: unknown, keep: (character: string) => boolean): string =>
  Array.from(String(value))
    .map((character) => {
      if (keep(character)) return character;
      const replacement = PDF_GLYPHS.get(character);
      if (replacement !== undefined) return replacement;
      return isWinAnsi(character) ? character : '';
    })
    .join('');

/** Prose for the WinAnsi faces: every glyph outside Latin-1 is spelled out. */
export const pdfText = (value: unknown): string => transliterate(value, () => false);

/**
 * Fórmula source for `pdfMath`: Greek and operators survive for the Symbol face, and the
 * Unicode scripts become `^`/`_` markers. Everything else degrades exactly as prose does.
 */
/** True when the text carries a Unicode super/subscript the typesetter can raise or lower. */
export const hasScriptGlyph = (value: string): boolean =>
  Array.from(value).some((character) => SCRIPT_GLYPHS.has(character));

export const mathText = (value: unknown): string =>
  transliterate(value, (character) => SYMBOL_GLYPHS.has(character) && !SCRIPT_GLYPHS.has(character));

export const wrapText = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
  const paragraphs = pdfText(text).split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
        continue;
      }
      let fragment = '';
      for (const character of word) {
        if (fragment && font.widthOfTextAtSize(fragment + character, size) > maxWidth) {
          lines.push(fragment);
          fragment = character;
        } else fragment += character;
      }
      line = fragment;
    }
    if (line) lines.push(line);
  }
  return lines;
};
