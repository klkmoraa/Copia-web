/**
 * Faithful SVG serialization.
 *
 * The structural canvas is styled almost entirely from `styles.css` classes and from
 * design tokens such as `var(--force)` and `var(--shear)`. A plain `XMLSerializer` pass
 * keeps the class names and the `var()` references but takes neither the stylesheet nor
 * the custom properties with it, so the exported file renders as unstyled black shapes.
 *
 * This module walks the live tree and its clone in parallel and copies the *computed*
 * value of every paint property onto the clone. `getComputedStyle` has already resolved
 * both the cascade and the custom properties, so one pass fixes classes and tokens at
 * once and the result is self-contained.
 */

export type SvgExportBackground = 'transparent' | 'light' | 'dark' | 'current';

export interface SvgExportOptions {
  background?: SvgExportBackground;
  /** Written into `<title>`; falls back to whatever the live SVG already declares. */
  title?: string;
  description?: string;
}

/**
 * Properties that carry the drawing's meaning. Layout properties are deliberately absent:
 * SVG geometry lives in attributes, and copying `width`/`height`/`transform` from the
 * computed style would fight the viewBox.
 */
const PAINT_PROPERTIES = [
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset',
  'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'opacity', 'visibility', 'display', 'mix-blend-mode', 'paint-order',
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant-numeric',
  'letter-spacing', 'text-anchor', 'dominant-baseline', 'text-decoration',
  'marker-start', 'marker-mid', 'marker-end', 'clip-path', 'mask', 'filter',
] as const;

/** Attributes that only mean something to a live, interactive application. */
const INTERACTIVE_ATTRIBUTES = [
  'tabindex', 'aria-keyshortcuts', 'aria-describedby', 'aria-live', 'aria-atomic',
  'aria-pressed', 'aria-expanded', 'aria-controls', 'role',
];

const SVG_NS = 'http://www.w3.org/2000/svg';

const BACKGROUND_TOKENS: Record<Exclude<SvgExportBackground, 'transparent'>, string> = {
  light: '#fafcfb',
  dark: '#060b09',
  current: '',
};

const isElement = (node: Node): node is Element => node.nodeType === Node.ELEMENT_NODE;

/** Non-inherited properties whose initial value carries no information. */
const OMITTABLE_DEFAULTS: Record<string, string> = {
  opacity: '1',
  display: 'inline',
};

const VAR_REFERENCE = /var\(\s*(--[\w-]+)\s*(?:,([^()]*(?:\([^()]*\)[^()]*)*))?\)/;

/**
 * Substitutes any `var()` a computed value still carries.
 *
 * Most engines resolve custom properties before handing back a computed value, but not
 * inside `<defs>` and other non-rendered subtrees — which is exactly where this canvas
 * keeps its arrow markers, painted with `var(--force)` and `var(--shear)`. Leaving the
 * reference in place would export an arrowhead with no colour at all.
 */
const resolveCssVariables = (value: string, element: Element, view: Window): string => {
  let resolved = value;
  for (let guard = 0; guard < 8 && VAR_REFERENCE.test(resolved); guard += 1) {
    resolved = resolved.replace(VAR_REFERENCE, (_match, name: string, fallback?: string) => {
      const declared = view.getComputedStyle(element).getPropertyValue(name).trim();
      if (declared !== '') return declared;
      const root = view.getComputedStyle(element.ownerDocument.documentElement)
        .getPropertyValue(name).trim();
      return root !== '' ? root : (fallback ?? '').trim();
    });
  }
  return resolved;
};

const resolveBackground = (background: SvgExportBackground, source: SVGSVGElement): string | null => {
  if (background === 'transparent') return null;
  if (background !== 'current') return BACKGROUND_TOKENS[background];
  const view = source.ownerDocument.defaultView;
  const declared = view?.getComputedStyle(source.ownerDocument.documentElement)
    .getPropertyValue('--sc-color-bg-canvas').trim();
  return declared || BACKGROUND_TOKENS.light;
};

/**
 * Copies computed paint onto the clone. Values equal to the SVG defaults are skipped so
 * the output stays readable instead of carrying a full style declaration per node.
 */
const inlineComputedPaint = (live: Element, clone: Element, view: Window): void => {
  const computed = view.getComputedStyle(live);
  const declarations: string[] = [];
  for (const property of PAINT_PROPERTIES) {
    // A presentation attribute written as `var(--force)` — how this canvas paints its
    // arrow markers — is the author's real intent, and engines disagree about whether
    // the computed value reflects it. When one is present, it wins.
    const attribute = live.getAttribute(property)?.trim();
    const raw = attribute?.includes('var(')
      ? attribute
      : computed.getPropertyValue(property).trim();
    if (raw === '' || raw === undefined) continue;
    if (raw === 'none' && property !== 'fill' && property !== 'stroke') continue;
    if (raw === 'normal' || raw === 'auto' || raw === 'visible') continue;
    if (OMITTABLE_DEFAULTS[property] === raw) continue;
    // jsdom reports this placeholder; a real engine never does, and it is not a font.
    if (property === 'font-family' && raw === 'depends on user agent') continue;
    const value = resolveCssVariables(raw, live, view);
    if (value === '' || value.includes('var(')) continue;
    declarations.push(`${property}:${value}`);
    // The inline style now carries the truth; a stale attribute could only contradict it.
    clone.removeAttribute(property);
  }
  if (declarations.length > 0) clone.setAttribute('style', declarations.join(';'));
  // The class no longer carries meaning once the paint is inline, and keeping it invites
  // a consumer to assume a stylesheet exists.
  clone.removeAttribute('class');
  for (const attribute of INTERACTIVE_ATTRIBUTES) clone.removeAttribute(attribute);
};

const walk = (live: Element, clone: Element, view: Window): void => {
  inlineComputedPaint(live, clone, view);
  const liveChildren = Array.from(live.childNodes).filter(isElement);
  const cloneChildren = Array.from(clone.childNodes).filter(isElement);
  for (let index = 0; index < liveChildren.length && index < cloneChildren.length; index += 1) {
    walk(liveChildren[index], cloneChildren[index], view);
  }
};

const upsertMetadata = (clone: SVGSVGElement, tag: 'title' | 'desc', text: string | undefined): void => {
  if (text === undefined) return;
  const existing = Array.from(clone.childNodes).find((node) => isElement(node) && node.tagName === tag);
  const element = existing ?? clone.ownerDocument.createElementNS(SVG_NS, tag);
  element.textContent = text;
  if (!existing) clone.prepend(element);
};

/**
 * Produces a standalone `SVGSVGElement` whose appearance no longer depends on the
 * application's stylesheet, theme or custom properties.
 */
export const buildStandaloneSvg = (
  source: SVGSVGElement,
  options: SvgExportOptions = {},
): SVGSVGElement => {
  const view = source.ownerDocument.defaultView;
  if (!view) throw new Error('El SVG no pertenece a un documento con vista; no puede exportarse.');

  const clone = source.cloneNode(true) as SVGSVGElement;
  // `XMLSerializer` emits the SVG namespace itself; declaring it again would duplicate
  // the attribute. Only xlink has to be declared, and only when the tree actually uses it.
  if (source.querySelector('[*|href]:not([href])')) {
    clone.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }
  walk(source, clone, view);

  // A viewer that ignores viewBox still needs intrinsic dimensions.
  const viewBox = source.getAttribute('viewBox');
  const box = viewBox?.split(/[\s,]+/).map(Number);
  const width = box?.length === 4 && Number.isFinite(box[2]) ? box[2] : source.clientWidth;
  const height = box?.length === 4 && Number.isFinite(box[3]) ? box[3] : source.clientHeight;
  if (!viewBox && width > 0 && height > 0) clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const background = resolveBackground(options.background ?? 'transparent', source);
  if (background) {
    const rectangle = clone.ownerDocument.createElementNS(SVG_NS, 'rect');
    const [x, y] = box?.length === 4 ? box : [0, 0];
    rectangle.setAttribute('x', String(x));
    rectangle.setAttribute('y', String(y));
    rectangle.setAttribute('width', String(width));
    rectangle.setAttribute('height', String(height));
    rectangle.setAttribute('fill', background);
    clone.prepend(rectangle);
  }

  upsertMetadata(clone, 'title', options.title);
  upsertMetadata(clone, 'desc', options.description);

  // An exported drawing is a document, not a program.
  for (const scripted of Array.from(clone.querySelectorAll('script, foreignObject'))) scripted.remove();
  for (const element of Array.from(clone.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
    }
  }

  return clone;
};

/** Serializes to a standalone XML document with a declaration, ready to write to disk. */
export const serializeStandaloneSvg = (
  source: SVGSVGElement,
  options: SvgExportOptions = {},
): string => {
  const markup = new XMLSerializer().serializeToString(buildStandaloneSvg(source, options));
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${markup}\n`;
};
