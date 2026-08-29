/**
 * The report's design system: one palette, one type scale, one spacing unit.
 *
 * Until 0.8.3 the document invented its own look — a forest-green masthead, green section
 * bands, bordered panels — that appears nowhere in the product, and its diagrams used a third
 * set of colours again: axial drawn blue on paper and teal on screen, moment red on paper and
 * orange on screen. A reader who moves between the app and the signed memoir was being asked
 * to learn the same structure twice.
 *
 * So the palette is no longer invented here. Every value below is lifted from
 * `src/design-system/tokens.css`, the product's single source of colour, in its light
 * appearance — the one that is correct on white paper. The hexes are duplicated rather than
 * parsed because this module runs in a worker-free, DOM-free path (`pdf-lib` only) where no
 * stylesheet exists to read; the comment beside each one names the token it mirrors, so the
 * two can be diffed by eye and by `pdfTheme.test.ts`.
 */
import type { PdfColor, RgbFactory } from './reportContext';

/** `#1d1d1f` -> the three 0..1 components `pdf-lib`'s `rgb()` wants. */
export const fromHex = (hex: string): [number, number, number] => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [
    Number.parseInt(full.slice(0, 2), 16) / 255,
    Number.parseInt(full.slice(2, 4), 16) / 255,
    Number.parseInt(full.slice(4, 6), 16) / 255,
  ];
};

/**
 * Token name -> hex, mirroring `tokens.css` light appearance.
 *
 * Grouped the way the document reads them: the achromatic ramp carries every surface and
 * every rule, the accent is the single brand colour, and the technical hues are reserved for
 * the one thing that needs colour to be understood — which quantity a curve represents.
 */
export const REPORT_TOKENS = {
  /** `--sc-white` */
  paper: '#ffffff',
  /** `--sc-grey-100`: the tint behind a zebra row or a quiet block. */
  tint: '#f5f5f7',
  /** `--sc-grey-150` */
  tintDeep: '#efeff1',
  /** `--sc-grey-300`: every hairline in the document. */
  rule: '#d2d2d7',
  /** `--sc-grey-500` */
  inkFaint: '#8e8e93',
  /** `--sc-grey-600` = `--sc-color-text-secondary` */
  inkSoft: '#6e6e73',
  /** `--sc-grey-900` = `--sc-color-text-primary` */
  ink: '#1d1d1f',
  /** `--sc-grey-950`: the cover ground and the part numerals. */
  band: '#141416',
  /** `--sc-blue-fill` = `--sc-color-action-primary`: the only brand colour on the page. */
  accent: '#0071eb',
  /** `--sc-sys-teal-light` = `--sc-color-technical-axial` */
  axial: '#0071a4',
  /** `--sc-sys-green-light` = `--sc-color-technical-shear` */
  shear: '#248a3d',
  /** `--sc-sys-orange-light` = `--sc-color-technical-moment` */
  moment: '#c93400',
  /** `--sc-color-technical-reaction` */
  reaction: '#0040dd',
  /** `--sc-sys-indigo-light` = `--sc-color-load-point` */
  load: '#3634a3',
  /** `--sc-color-technical-deformed` */
  deformed: '#5e46c8',
  /** `--sc-sys-green-light` = `--sc-color-state-success` */
  ok: '#248a3d',
  /** `--sc-sys-yellow-light` */
  warn: '#b25000',
  /** `--sc-sys-red-light` */
  danger: '#d70015',
} as const;

export type ReportTokenName = keyof typeof REPORT_TOKENS;

/**
 * Type scale.
 *
 * Six steps, each a role rather than a size, so a heading never gets picked by eye. The
 * ratio is roughly 1.2 between neighbours at the small end and opens up at the display end,
 * where the jump has to survive being read across a room rather than at arm's length.
 */
export const TYPE = {
  /** Cover title. */
  display: 26,
  /** Project name on the cover, part titles. */
  title: 16,
  /** Section heading inside a part. */
  section: 10.8,
  /** Sub-heading. */
  sub: 8.8,
  /** Running body copy. */
  body: 8.6,
  /** Captions, table cells, the running head. */
  small: 7.4,
  /** Labels in small caps, the footer. */
  micro: 6.3,
} as const;

/** Vertical rhythm. Every gap in the document is a multiple of this. */
export const SPACE = 4;

export interface ReportPalette {
  readonly paper: PdfColor;
  readonly tint: PdfColor;
  readonly tintDeep: PdfColor;
  readonly rule: PdfColor;
  readonly inkFaint: PdfColor;
  readonly inkSoft: PdfColor;
  readonly ink: PdfColor;
  readonly band: PdfColor;
  readonly accent: PdfColor;
  readonly reaction: PdfColor;
  readonly load: PdfColor;
  readonly deformed: PdfColor;
  readonly ok: PdfColor;
  readonly warn: PdfColor;
  readonly danger: PdfColor;
  /** The three response quantities, in the product's own hues. */
  readonly quantity: Readonly<Record<'axial' | 'shear' | 'moment', PdfColor>>;
}

export const createPalette = (rgb: RgbFactory): ReportPalette => {
  const of = (name: ReportTokenName): PdfColor => rgb(...fromHex(REPORT_TOKENS[name]));
  return {
    paper: of('paper'),
    tint: of('tint'),
    tintDeep: of('tintDeep'),
    rule: of('rule'),
    inkFaint: of('inkFaint'),
    inkSoft: of('inkSoft'),
    ink: of('ink'),
    band: of('band'),
    accent: of('accent'),
    reaction: of('reaction'),
    load: of('load'),
    deformed: of('deformed'),
    ok: of('ok'),
    warn: of('warn'),
    danger: of('danger'),
    quantity: { axial: of('axial'), shear: of('shear'), moment: of('moment') },
  };
};
