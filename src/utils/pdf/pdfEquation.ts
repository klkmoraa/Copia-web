/**
 * A worked relation: the rule in symbols, the same rule with this project's numbers, and the
 * result with its unit — one aligned block, one equation number.
 *
 * The report used to swing between two failures. Before 0.8.4 it printed the identity and
 * stopped (`EI y″ = M`, `Δ = Σ nNL/AE`), which says nothing about the structure being analysed;
 * the fix was to print only the substituted arithmetic, which closes but leaves the reader to
 * infer *which* rule was applied. A memoir needs both, and needs them stacked on the same `=`
 * so the eye can walk down the column: this is the rule, this is the rule with your numbers,
 * this is what came out.
 *
 * The repository's standing constraint is unchanged and load-bearing: a symbolic line is only
 * ever printed *accompanied* by its substitution. `symbolic` alone renders nothing — there is
 * no path through this module that puts an unsubstituted identity on the page — and the callers
 * still gate every block on `agrees(...)`, so a relation whose own numbers do not close is not
 * drawn at all.
 */
import { unitLabel, type UnitQuantity } from '../../engine/units';
import { translateExpression } from './mathLatex';
import { drawMathBlock, hasFraction, mathWidth } from './pdfMath';
import type { PdfLayout } from './pdfBuilder';
import type { PdfColor } from './reportContext';

export interface WorkedEquation {
  /** Left-hand side, written once: `M(x)`, `ΣF_y`, `D(AB)`. */
  readonly lhs: string;
  /** The relation in symbols. Never drawn on its own — see the module note. */
  readonly symbolic?: string;
  /** The same relation with this project's numbers. */
  readonly substituted?: string;
  /** What came out. */
  readonly result?: string;
  /** Unit of the result, set upright so it cannot be read as a product of variables. */
  readonly unit?: string;
}

/** A relation already assembled as one string, for the call sites that build their own. */
export type EquationInput = WorkedEquation | string;

/**
 * Every unit label the product can print, across all four unit systems.
 *
 * Closed and computed once from `engine/units`, which is the single source of these strings —
 * not a hand-written list that could drift from it. It exists so a pre-built relation ending
 * in `… = 17.5 kN` can have its unit set upright without a shape heuristic deciding that some
 * trailing word "looks like" a unit and italicising a variable by mistake.
 */
const UNIT_LABELS: ReadonlySet<string> = new Set([
  'rad',
  ...(['kN-m', 'N-mm', 'kgf-m', 'kip-ft'] as const).flatMap((system) => ([
    'length', 'force', 'moment', 'distributedForce', 'elasticModulus', 'area', 'inertia',
    'sectionModulus', 'sectionDimension', 'translationalStiffness', 'rotationalStiffness', 'density',
  ] as UnitQuantity[]).map((quantity) => unitLabel(system, quantity))),
]);

/**
 * Index of the first `=` that is the relation's own, i.e. outside every bracket.
 *
 * `dθ/dx (x = 0) = M/EI` states a derivative *at* x = 0; its first `=` belongs to that
 * argument, not to the relation. Splitting there produced an lhs of `dθ/dx (x` and a
 * substituted side beginning with a stray `)`, which then defeated every later reading of the
 * row — the fraction scanner sees unbalanced brackets and gives up on the whole line.
 */
const topLevelEquals = (text: string): number => {
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') depth -= 1;
    else if (character === '=' && depth === 0) return index;
  }
  return -1;
};

export const asWorkedEquation = (input: EquationInput): WorkedEquation => {
  if (typeof input !== 'string') return input;
  // A pre-built `lhs = rest` string keeps its own shape: splitting it further would guess at
  // which `=` was the relation and which was a step of the arithmetic.
  const at = topLevelEquals(input);
  if (at <= 0) return { lhs: input };
  const lhs = input.slice(0, at).trim();
  const rest = input.slice(at + 1).trim();
  // A trailing unit is peeled off so it can be set upright. Only a word this product actually
  // prints as a unit qualifies, so `= 0 en A` keeps its `A` as the node it names.
  const lastSpace = rest.lastIndexOf(' ');
  const tail = lastSpace === -1 ? '' : rest.slice(lastSpace + 1);
  return UNIT_LABELS.has(tail)
    ? { lhs, substituted: rest.slice(0, lastSpace).trim(), unit: tail }
    : { lhs, substituted: rest };
};

/**
 * Units, upright.
 *
 * `kN·m` set as maths is the product of a `k`, an `N` and an `m`, in italic, which is exactly
 * what it is not. `\mathrm` is TeX's own answer, and the interpunct has to be braced so it
 * keeps its spacing inside the upright run.
 */
export const romanUnit = (unit: string): string => {
  const body = unit
    .replaceAll('·', '{\\cdot}')
    .replaceAll('²', '^{2}')
    .replaceAll('³', '^{3}')
    .replaceAll('⁴', '^{4}')
    .replaceAll('/', '/');
  return `\\,\\mathrm{${body}}`;
};

/** The lines of the block, in reading order, each already LaTeX. */
const bodyLines = (equation: WorkedEquation): string[] => {
  const lines: string[] = [];
  // The symbolic form is only worth a line when a substitution follows it; on its own it is
  // the empty identity this whole redesign removed.
  if (equation.symbolic && equation.substituted) lines.push(translateExpression(equation.symbolic));
  if (equation.substituted) {
    // With no separate result row the unit belongs to the substituted line, which is then the
    // last thing the relation says.
    const trailing = equation.result === undefined && equation.unit ? romanUnit(equation.unit) : '';
    lines.push(translateExpression(equation.substituted) + trailing);
  }
  if (equation.result !== undefined) {
    lines.push(translateExpression(equation.result) + (equation.unit ? romanUnit(equation.unit) : ''));
  }
  return lines;
};

/**
 * The whole block as one `aligned` environment, or `undefined` when there is nothing to align.
 *
 * One environment rather than several separately-drawn lines because TeX is what puts the `=`
 * of every row on the same vertical rule; measuring and stacking them here would reimplement
 * that badly.
 */
export const buildAlignedLatex = (equation: WorkedEquation): string | undefined => {
  const lines = bodyLines(equation);
  if (!lines.length) return undefined;
  const lhs = translateExpression(equation.lhs);
  const rows = lines.map((line, index) => index === 0 ? `${lhs} &= ${line}` : `&= ${line}`);
  return `\\begin{aligned}${rows.join(' \\\\ ')}\\end{aligned}`;
};

/**
 * Single-line fallback: `lhs = substituted = result unit`.
 *
 * `drawMathBlock` can wrap this across the measure, which an `aligned` environment cannot — it
 * is one indivisible box. So a block too wide for the column, or one MathJax cannot parse, is
 * drawn this way instead of overflowing the margin.
 */
const inlineExpression = (equation: WorkedEquation): string => {
  const parts = [equation.substituted, equation.result].filter((part): part is string => part !== undefined);
  const tail = parts.join(' = ');
  const unit = equation.unit ? ` ${equation.unit}` : '';
  return tail ? `${equation.lhs} = ${tail}${unit}` : equation.lhs;
};

/** Height `drawWorkedEquation` will consume, so a caller can break the page first. */
export const measureWorkedEquation = (
  layout: PdfLayout,
  equation: WorkedEquation,
  size: number,
  indent: number,
): number => {
  const latex = buildAlignedLatex(equation);
  const available = layout.contentWidth - indent;
  if (latex && layout.rawMathWidth(latex, size) <= available) {
    // One line of leading per row, plus the extra a stacked fraction needs on any of them.
    const rows = bodyLines(equation).length;
    return rows * size * (hasFraction(inlineExpression(equation)) ? 2.05 : 1.5) + size * 0.4;
  }
  const inline = inlineExpression(equation);
  const lines = Math.max(1, Math.ceil(mathWidth(layout, inline, size) / Math.max(1, available)));
  return lines * size * (hasFraction(inline) ? 2.05 : 1.45);
};

/**
 * Draws the block at the layout's cursor and returns the height it consumed.
 *
 * The equation number tags the block as a whole, not its last row: the three rows are one
 * relation, and numbering them separately would invite a cross-reference to half of it.
 */
export const drawWorkedEquation = (
  layout: PdfLayout,
  equation: WorkedEquation,
  size: number,
  indent: number,
  color: PdfColor,
  tag?: string,
): number => {
  const latex = buildAlignedLatex(equation);
  const available = layout.contentWidth - indent;
  if (latex && layout.rawMathWidth(latex, size) <= available) {
    return layout.drawRawMathAt(latex, size, indent, color, tag);
  }
  return drawMathBlock(layout, inlineExpression(equation), layout.margin + indent, layout.y, available, size, color, { tag });
};
