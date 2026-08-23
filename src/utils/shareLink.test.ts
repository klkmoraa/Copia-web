// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { ProjectModel } from '../types';
import { deflateSync } from 'fflate';
import { SHARE_LINK_LIMIT, buildShareLink, decodeProjectFragment, encodeProjectFragment } from './shareLink';

/** Mismo base64 apto para URL que usa el módulo, para fabricar un fragmento falso. */
const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const baseProject = (): ProjectModel => ({
  schemaVersion: 1,
  id: 'P1',
  name: 'Pórtico compartido',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 4, y: 0, support: { type: 'roller' } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 2e8, A: 0.01, I: 1e-4 }],
  loadCases: [{ id: 'LC1', name: 'LC1', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [{ id: 'NL1', nodeId: 'B', caseId: 'LC1', fx: 0, fy: -12.5, mz: 0 }],
  memberLoads: [],
  settings: {
    units: 'kN-m', language: 'es', gridSize: 1, snap: true, showGrid: true,
    showNodeLabels: true, showMemberLabels: false, showLocalAxes: false, showLoads: true,
    showDimensions: true, showResultValues: true, diagramScale: 1, deformedScale: 50, diagramSide: 'positive',
  },
});

/** Modelo grande: una retícula de nudos y barras que no cabe en un enlace. */
const hugeProject = (): ProjectModel => {
  const project = baseProject();
  project.nodes = Array.from({ length: 900 }, (_, index) => ({
    id: `N${index}`, x: (index % 30) * 1.5, y: Math.floor(index / 30) * 1.5, support: { type: 'none' as const },
  }));
  project.members = Array.from({ length: 870 }, (_, index) => ({
    id: `M${index}`, i: `N${index}`, j: `N${index + 30}`, type: 'frame' as const,
    E: 2e8 + index, A: 0.01 + index * 1e-6, I: 1e-4 + index * 1e-9,
  }));
  project.nodalLoads = [];
  return project;
};

describe('enlace compartido', () => {
  it('va y vuelve conservando el modelo', () => {
    const project = baseProject();
    const encoded = encodeProjectFragment(project);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const decoded = decodeProjectFragment(encoded.fragment);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.project.nodes).toHaveLength(2);
    expect(decoded.project.members[0].E).toBe(2e8);
    expect(decoded.project.nodalLoads[0].fy).toBe(-12.5);
    expect(decoded.project.name).toBe('Pórtico compartido');
  });

  it('acepta el fragmento con o sin almohadilla delante', () => {
    const encoded = encodeProjectFragment(baseProject());
    if (!encoded.ok) throw new Error('no cupo');
    expect(decodeProjectFragment(`#${encoded.fragment}`).ok).toBe(true);
    expect(decodeProjectFragment(encoded.fragment).ok).toBe(true);
  });

  it('comprime de verdad: el fragmento es mucho menor que el JSON', () => {
    const project = baseProject();
    const encoded = encodeProjectFragment(project);
    if (!encoded.ok) throw new Error('no cupo');
    expect(encoded.characters).toBeLessThan(JSON.stringify(project).length);
  });

  it('pone el modelo en el fragmento, que no viaja al servidor', () => {
    const result = buildShareLink(baseProject(), 'https://ejemplo.test/app/?ya=estaba');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const url = new URL(result.url);
    // Todo el modelo detrás de `#`; la query intacta y sin rastro del modelo.
    expect(url.hash.startsWith('#m1:')).toBe(true);
    expect(url.search).toBe('?ya=estaba');
    expect(url.search).not.toContain('m1:');
  });

  it('se niega antes que entregar un enlace que se romperá en el camino', () => {
    const encoded = encodeProjectFragment(hugeProject());
    expect(encoded.ok).toBe(false);
    if (encoded.ok) return;
    expect(encoded.reason).toBe('too-large');
    expect(encoded.characters).toBeGreaterThan(SHARE_LINK_LIMIT);
    expect(encoded.limit).toBe(SHARE_LINK_LIMIT);
  });

  it('la negativa llega igual desde el constructor de enlaces', () => {
    const result = buildShareLink(hugeProject(), 'https://ejemplo.test/app/');
    expect(result.ok).toBe(false);
  });

  it('distingue «aquí no hay nada compartido» de «esto está roto»', () => {
    const reasonOf = (fragment: string) => {
      const decoded = decodeProjectFragment(fragment);
      return decoded.ok ? 'ok' : decoded.reason;
    };
    expect(reasonOf('')).toBe('absent');
    expect(reasonOf('#seccion-de-la-pagina')).toBe('absent');
    expect(reasonOf('#m1:no-es-base64-valido!!')).toBe('malformed');
  });

  it('rechaza un fragmento manipulado que no tiene forma de proyecto', () => {
    /* Se fabrica a mano, sin pasar por el codificador: un fragmento
       manipulado no viene de esta aplicación por definición. Es JSON válido y
       comprimido correctamente, pero le faltan las colecciones que el resto del
       código da por hechas — aceptarlo reventaría lejos de aquí, con un error
       que no señalaría al enlace. */
    const forged = `m1:${toBase64Url(deflateSync(new TextEncoder().encode(JSON.stringify({ id: 'P1', name: 'sin nudos' }))))}`;
    const decoded = decodeProjectFragment(forged);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.reason).toBe('malformed');
  });

  it('un fragmento de otra aplicación no se interpreta como modelo', () => {
    const decoded = decodeProjectFragment('#access_token=abc123');
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.reason).toBe('absent');
  });
});
