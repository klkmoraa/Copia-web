/**
 * Text sanitising and wrapping for the standard PDF fonts.
 *
 * Helvetica and Times only carry WinAnsi, so engineering notation has to be transliterated
 * explicitly instead of silently dropping to a replacement glyph.
 */
import type { PDFFont } from 'pdf-lib';

/** Standard PDF fonts use WinAnsi; transliterate engineering glyphs explicitly. */
const PDF_GLYPHS = new Map<string, string>([
  ['−', '-'], ['–', '-'], ['—', '-'], ['·', ' x '], ['⋅', ' x '],
  ['²', '^2'], ['³', '^3'], ['⁴', '^4'], ['⁵', '^5'], ['⁶', '^6'], ['⁷', '^7'], ['⁸', '^8'], ['⁹', '^9'], ['⁰', '^0'], ['ᵀ', '^T'],
  ['₀', '_0'], ['₁', '_1'], ['₂', '_2'], ['₃', '_3'], ['₄', '_4'], ['₅', '_5'], ['₆', '_6'], ['₇', '_7'], ['₈', '_8'], ['₉', '_9'],
  ['ₐ', '_a'], ['ₑ', '_e'], ['ₙ', '_n'], ['ₛ', '_s'], ['ₓ', '_x'], ['ᵧ', '_y'],
  ['ᵃ', '^a'], ['ᵉ', '^e'], ['ᵍ', '^g'], ['ᵢ', '^i'], ['ⱼ', '^j'], ['ˡ', '^l'], ['ⁿ', '^n'],
  ['Σ', 'Sum'], ['∑', 'Sum'], ['Δ', 'Delta'], ['δ', 'delta'], ['θ', 'theta'], ['Θ', 'Theta'], ['ξ', 'xi'], ['Ξ', 'Xi'],
  ['α', 'alpha'], ['β', 'beta'], ['γ', 'gamma'], ['Γ', 'Gamma'], ['ε', 'epsilon'], ['ζ', 'zeta'], ['η', 'eta'],
  ['κ', 'kappa'], ['λ', 'lambda'], ['Λ', 'Lambda'], ['μ', 'mu'], ['ν', 'nu'], ['π', 'pi'], ['Π', 'Pi'],
  ['ρ', 'rho'], ['σ', 'sigma'], ['τ', 'tau'], ['φ', 'phi'], ['Φ', 'Phi'], ['χ', 'chi'], ['ψ', 'psi'], ['ω', 'omega'], ['Ω', 'Omega'],
  ['≤', '<='], ['≥', '>='], ['≈', '~='], ['≠', '!='], ['±', '+/-'], ['×', ' x '], ['÷', '/'],
  ['→', '->'], ['←', '<-'], ['↔', '<->'], ['⇒', '=>'], ['⇐', '<='], ['√', 'sqrt'], ['∫', 'Integral'],
  ['∞', 'inf'], ['∂', 'd'], ['∇', 'grad'], ['∥', '||'], ['⊗', '(x)'], ['⊕', '(+)'],
  ['“', '"'], ['”', '"'], ['‘', "'"], ['’', "'"], ['…', '...'], ['⟨', '<'], ['⟩', '>'],
]);

export const pdfText = (value: unknown): string => Array.from(String(value))
  .map((character) => {
    const replacement = PDF_GLYPHS.get(character);
    if (replacement !== undefined) return replacement;
    const code = character.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 255) ? character : '';
  })
  .join('');

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
