// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { buildStandaloneSvg, serializeStandaloneSvg } from './svgExport';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Engines disagree about spacing inside colour functions; the colour is what matters. */
const withoutSpaces = (text: string): string => text.replace(/,\s+/g, ',');

/**
 * Builds a canvas that reproduces how the real one is styled: paint comes from a class
 * rule and from a design token, never from a presentation attribute.
 */
const mountCanvas = (): SVGSVGElement => {
  const style = document.createElement('style');
  style.textContent = `
    :root { --force: rgb(226, 93, 50); --member-stroke: rgb(22, 33, 28); }
    .structural-member { stroke: var(--member-stroke); stroke-width: 3px; fill: none; }
    .load-arrow { fill: var(--force); }
    .canvas-label { font-size: 12px; text-anchor: middle; }
  `;
  document.head.append(style);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 400 200');
  svg.setAttribute('class', 'structural-canvas');
  svg.setAttribute('role', 'application');
  svg.setAttribute('aria-keyshortcuts', 'V H N M');

  const title = document.createElementNS(SVG_NS, 'title');
  title.textContent = 'Lienzo';
  svg.append(title);

  const group = document.createElementNS(SVG_NS, 'g');
  const member = document.createElementNS(SVG_NS, 'line');
  member.setAttribute('class', 'structural-member');
  member.setAttribute('x1', '20');
  member.setAttribute('y1', '100');
  member.setAttribute('x2', '380');
  member.setAttribute('y2', '100');
  const arrow = document.createElementNS(SVG_NS, 'path');
  arrow.setAttribute('class', 'load-arrow');
  arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  const label = document.createElementNS(SVG_NS, 'text');
  label.setAttribute('class', 'canvas-label');
  label.textContent = 'P = 20.00 kN';
  group.append(member, arrow, label);
  svg.append(group);

  document.body.append(svg);
  return svg;
};

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('buildStandaloneSvg', () => {
  it('resolves class-based paint into the exported file', () => {
    const exported = buildStandaloneSvg(mountCanvas());
    const member = exported.querySelector('line');
    expect(withoutSpaces(member?.getAttribute('style') ?? '')).toContain('stroke:rgb(22,33,28)');
    expect(withoutSpaces(member?.getAttribute('style') ?? '')).toContain('stroke-width:3px');
  });

  it('resolves design tokens so var() never reaches the file', () => {
    const markup = withoutSpaces(serializeStandaloneSvg(mountCanvas()));
    expect(markup).toContain('fill:rgb(226,93,50)');
    expect(markup).not.toContain('var(--');
  });

  it('resolves a token used inside defs, where computed style may keep the reference', () => {
    const svg = mountCanvas();
    const defs = document.createElementNS(SVG_NS, 'defs');
    const marker = document.createElementNS(SVG_NS, 'marker');
    marker.setAttribute('id', 'arrow');
    const head = document.createElementNS(SVG_NS, 'path');
    head.setAttribute('fill', 'var(--force)');
    marker.append(head);
    defs.append(marker);
    svg.append(defs);

    const markup = withoutSpaces(serializeStandaloneSvg(svg));
    expect(markup).toContain('rgb(226,93,50)');
    expect(markup).not.toContain('var(--force)');
  });

  it('does not repeat the SVG namespace declaration', () => {
    const markup = serializeStandaloneSvg(mountCanvas());
    expect(markup.match(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g)).toHaveLength(1);
  });

  it('drops class names once the paint is inline', () => {
    const markup = serializeStandaloneSvg(mountCanvas());
    expect(markup).not.toContain('class=');
  });

  it('declares intrinsic dimensions taken from the viewBox', () => {
    const exported = buildStandaloneSvg(mountCanvas());
    expect(exported.getAttribute('viewBox')).toBe('0 0 400 200');
    expect(exported.getAttribute('width')).toBe('400');
    expect(exported.getAttribute('height')).toBe('200');
    expect(exported.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
  });

  it('keeps the namespace so the file opens outside a browser', () => {
    const markup = serializeStandaloneSvg(mountCanvas());
    expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(markup.startsWith('<?xml version="1.0" encoding="UTF-8"')).toBe(true);
  });

  it('leaves the drawing transparent by default', () => {
    const exported = buildStandaloneSvg(mountCanvas());
    expect(exported.querySelector('rect')).toBeNull();
  });

  it('paints an explicit background when one is requested', () => {
    const light = buildStandaloneSvg(mountCanvas(), { background: 'light' });
    const rectangle = light.querySelector('rect');
    expect(rectangle?.getAttribute('fill')).toBe('#fafcfb');
    expect(rectangle?.getAttribute('width')).toBe('400');
    expect(light.firstElementChild).toBe(rectangle);

    const dark = buildStandaloneSvg(mountCanvas(), { background: 'dark' });
    expect(dark.querySelector('rect')?.getAttribute('fill')).toBe('#060b09');
  });

  it('writes accessible metadata for the drawing', () => {
    const exported = buildStandaloneSvg(mountCanvas(), { title: 'Viga A-B', description: 'Modelo de prueba' });
    expect(exported.querySelector('title')?.textContent).toBe('Viga A-B');
    expect(exported.querySelector('desc')?.textContent).toBe('Modelo de prueba');
  });

  it('keeps the title the canvas already declared when none is supplied', () => {
    expect(buildStandaloneSvg(mountCanvas()).querySelector('title')?.textContent).toBe('Lienzo');
  });

  it('drops attributes that only mean something to a live application', () => {
    const markup = serializeStandaloneSvg(mountCanvas());
    expect(markup).not.toContain('aria-keyshortcuts');
    expect(markup).not.toContain('role="application"');
  });

  it('never ships executable content', () => {
    const svg = mountCanvas();
    const script = document.createElementNS(SVG_NS, 'script');
    script.textContent = 'alert(1)';
    svg.append(script);
    svg.querySelector('line')?.setAttribute('onclick', 'alert(2)');

    const markup = serializeStandaloneSvg(svg);
    expect(markup).not.toContain('<script');
    expect(markup).not.toContain('onclick');
    expect(markup).not.toContain('alert');
  });

  it('leaves the live canvas untouched', () => {
    const svg = mountCanvas();
    serializeStandaloneSvg(svg, { background: 'dark', title: 'Otro' });
    expect(svg.getAttribute('class')).toBe('structural-canvas');
    expect(svg.querySelector('title')?.textContent).toBe('Lienzo');
    expect(svg.querySelector('rect')).toBeNull();
    expect(svg.getAttribute('width')).toBeNull();
  });
});
