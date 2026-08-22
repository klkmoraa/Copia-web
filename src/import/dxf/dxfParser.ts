import type { MemberModel, NodeModel, ProjectModel } from '../../types';
import type { ProjectCommand } from '../../commands/projectCommand';

const MAX_TEXT_LENGTH = 5_000_000;
const MAX_PAIRS = 200_000;
const MAX_ENTITIES = 20_000;
const EPSILON = 1e-12;

interface DxfPair {
  code: number;
  value: string;
  line: number;
}

export interface DxfPoint {
  x: number;
  y: number;
}

export interface DxfSegment {
  id: string;
  entityType: 'LINE' | 'LWPOLYLINE';
  layer: string;
  start: DxfPoint;
  end: DxfPoint;
}

export interface DxfDiagnostic {
  severity: 'warning' | 'error';
  code: string;
  message: string;
  entityType?: string;
  line?: number;
}

export interface DxfInspection {
  acadVersion?: string;
  insertionUnits?: number;
  layers: string[];
  segments: DxfSegment[];
  diagnostics: DxfDiagnostic[];
  counts: { accepted: number; rejected: number };
  canImport: boolean;
  requiresUnitSelection: boolean;
}

export type DxfSourceUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'us-ft';

export const DXF_UNIT_FACTORS: Record<DxfSourceUnit, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  in: 0.0254,
  ft: 0.3048,
  'us-ft': 1200 / 3937,
};

export const sourceUnitFromInsUnits = (code?: number): DxfSourceUnit | null => {
  if (code === 4) return 'mm';
  if (code === 5) return 'cm';
  if (code === 6) return 'm';
  if (code === 1) return 'in';
  if (code === 2) return 'ft';
  if (code === 21) return 'us-ft';
  return null;
};

const numeric = (pairs: DxfPair[], code: number, fallback?: number): number | undefined => {
  const pair = pairs.find((candidate) => candidate.code === code);
  if (!pair) return fallback;
  const value = Number(pair.value.trim());
  return Number.isFinite(value) ? value : Number.NaN;
};

const standardExtrusion = (pairs: DxfPair[]): boolean => {
  const x = numeric(pairs, 210, 0);
  const y = numeric(pairs, 220, 0);
  const z = numeric(pairs, 230, 1);
  return Math.abs(x ?? 0) <= EPSILON && Math.abs(y ?? 0) <= EPSILON && Math.abs((z ?? 1) - 1) <= EPSILON;
};

const parsePairs = (text: string): DxfPair[] => {
  if (text.length > MAX_TEXT_LENGTH) throw new Error(`El DXF supera el límite provisional de ${MAX_TEXT_LENGTH.toLocaleString()} caracteres.`);
  const lines = text.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n');
  while (lines.length && lines.at(-1) === '') lines.pop();
  if (lines.length % 2 !== 0) throw new Error('El DXF ASCII está truncado: falta el valor de un código de grupo.');
  if (lines.length / 2 > MAX_PAIRS) throw new Error(`El DXF supera el límite provisional de ${MAX_PAIRS.toLocaleString()} pares.`);
  const pairs: DxfPair[] = [];
  for (let index = 0; index < lines.length; index += 2) {
    const code = Number(lines[index].trim());
    if (!Number.isInteger(code)) throw new Error(`Código de grupo DXF inválido en la línea ${index + 1}.`);
    pairs.push({ code, value: lines[index + 1].trim(), line: index + 1 });
  }
  return pairs;
};

const entityFailure = (diagnostics: DxfDiagnostic[], type: string, pair: DxfPair, code: string, message: string) => {
  diagnostics.push({ severity: 'error', code, message, entityType: type, line: pair.line });
};

const parseLine = (record: DxfPair[], first: DxfPair, diagnostics: DxfDiagnostic[]): DxfSegment[] | null => {
  if (numeric(record, 67, 0) === 1) {
    entityFailure(diagnostics, 'LINE', first, 'paper-space', 'LINE en espacio papel no está soportada.');
    return null;
  }
  const z1 = numeric(record, 30, 0);
  const z2 = numeric(record, 31, 0);
  const thickness = numeric(record, 39, 0);
  if (![z1, z2, thickness].every((value) => Number.isFinite(value) && Math.abs(value ?? 0) <= EPSILON) || !standardExtrusion(record)) {
    entityFailure(diagnostics, 'LINE', first, 'non-planar', 'LINE 3D, con espesor o extrusión no estándar no está soportada.');
    return null;
  }
  const x1 = numeric(record, 10);
  const y1 = numeric(record, 20);
  const x2 = numeric(record, 11);
  const y2 = numeric(record, 21);
  if (![x1, y1, x2, y2].every(Number.isFinite)) {
    entityFailure(diagnostics, 'LINE', first, 'invalid-coordinate', 'LINE no contiene dos extremos 2D finitos.');
    return null;
  }
  if (Math.abs(x1! - x2!) <= EPSILON && Math.abs(y1! - y2!) <= EPSILON) {
    entityFailure(diagnostics, 'LINE', first, 'zero-length', 'LINE tiene longitud cero.');
    return null;
  }
  return [{ id: `line-${first.line}`, entityType: 'LINE', layer: record.find((pair) => pair.code === 8)?.value || '0', start: { x: x1!, y: y1! }, end: { x: x2!, y: y2! } }];
};

const parseLwPolyline = (record: DxfPair[], first: DxfPair, diagnostics: DxfDiagnostic[]): DxfSegment[] | null => {
  if (numeric(record, 67, 0) === 1) {
    entityFailure(diagnostics, 'LWPOLYLINE', first, 'paper-space', 'LWPOLYLINE en espacio papel no está soportada.');
    return null;
  }
  const elevation = numeric(record, 38, 0);
  const thickness = numeric(record, 39, 0);
  const constantWidth = numeric(record, 43, 0);
  const hasVariableWidth = record.some((pair) => (pair.code === 40 || pair.code === 41) && (!Number.isFinite(Number(pair.value)) || Math.abs(Number(pair.value)) > EPSILON));
  if (![elevation, thickness, constantWidth].every((value) => Number.isFinite(value) && Math.abs(value ?? 0) <= EPSILON) || hasVariableWidth || !standardExtrusion(record)) {
    entityFailure(diagnostics, 'LWPOLYLINE', first, 'non-planar', 'LWPOLYLINE con elevación, ancho, espesor o extrusión no estándar no está soportada.');
    return null;
  }
  if (record.some((pair) => pair.code === 42 && (!Number.isFinite(Number(pair.value)) || Math.abs(Number(pair.value)) > EPSILON))) {
    entityFailure(diagnostics, 'LWPOLYLINE', first, 'curved-polyline', 'LWPOLYLINE con bulge curvo no está soportada.');
    return null;
  }
  const vertices: DxfPoint[] = [];
  for (let index = 0; index < record.length; index += 1) {
    if (record[index].code !== 10) continue;
    const x = Number(record[index].value);
    const yPair = record.slice(index + 1).find((pair) => pair.code === 20 || pair.code === 10);
    const y = yPair?.code === 20 ? Number(yPair.value) : Number.NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      entityFailure(diagnostics, 'LWPOLYLINE', first, 'invalid-coordinate', 'LWPOLYLINE contiene un vértice 2D inválido.');
      return null;
    }
    vertices.push({ x, y });
  }
  const expected = numeric(record, 90);
  if (vertices.length < 2 || (expected !== undefined && expected !== vertices.length)) {
    entityFailure(diagnostics, 'LWPOLYLINE', first, 'invalid-vertex-count', 'LWPOLYLINE no conserva su cantidad declarada de vértices.');
    return null;
  }
  const closed = ((numeric(record, 70, 0) ?? 0) & 1) === 1;
  const edges = vertices.slice(0, -1).map((start, index) => ({ start, end: vertices[index + 1] }));
  if (closed) edges.push({ start: vertices.at(-1)!, end: vertices[0] });
  if (edges.some(({ start, end }) => Math.abs(start.x - end.x) <= EPSILON && Math.abs(start.y - end.y) <= EPSILON)) {
    entityFailure(diagnostics, 'LWPOLYLINE', first, 'zero-length', 'LWPOLYLINE contiene un segmento de longitud cero.');
    return null;
  }
  const layer = record.find((pair) => pair.code === 8)?.value || '0';
  return edges.map(({ start, end }, index) => ({ id: `lwpolyline-${first.line}-${index + 1}`, entityType: 'LWPOLYLINE', layer, start, end }));
};

export const parseAsciiDxf = (text: string): DxfInspection => {
  const pairs = parsePairs(text);
  const diagnostics: DxfDiagnostic[] = [];
  const segments: DxfSegment[] = [];
  let section = '';
  let acadVersion: string | undefined;
  let insertionUnits: number | undefined;
  let accepted = 0;
  let rejected = 0;
  let entityCount = 0;

  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index];
    if (pair.code === 0 && pair.value.toUpperCase() === 'SECTION') {
      const name = pairs[index + 1];
      if (!name || name.code !== 2) throw new Error(`SECTION sin nombre en la línea ${pair.line}.`);
      section = name.value.toUpperCase();
      index += 1;
      continue;
    }
    if (pair.code === 0 && pair.value.toUpperCase() === 'ENDSEC') {
      section = '';
      continue;
    }
    if (section === 'HEADER' && pair.code === 9) {
      const value = pairs[index + 1];
      if (pair.value === '$ACADVER' && value?.code === 1) acadVersion = value.value;
      if (pair.value === '$INSUNITS' && value?.code === 70) {
        const parsed = Number(value.value);
        if (Number.isInteger(parsed)) insertionUnits = parsed;
      }
      continue;
    }
    if (section !== 'ENTITIES' || pair.code !== 0) continue;
    const type = pair.value.toUpperCase();
    let end = index + 1;
    while (end < pairs.length && pairs[end].code !== 0) end += 1;
    const record = pairs.slice(index + 1, end);
    index = end - 1;
    entityCount += 1;
    if (entityCount > MAX_ENTITIES) throw new Error(`El DXF supera el límite provisional de ${MAX_ENTITIES.toLocaleString()} entidades.`);
    let parsed: DxfSegment[] | null = null;
    if (type === 'LINE') parsed = parseLine(record, pair, diagnostics);
    else if (type === 'LWPOLYLINE') parsed = parseLwPolyline(record, pair, diagnostics);
    else {
      entityFailure(diagnostics, type, pair, 'unsupported-entity', `${type || 'Entidad sin tipo'} queda fuera del subconjunto DXF experimental.`);
    }
    if (parsed) {
      accepted += 1;
      segments.push(...parsed);
    } else rejected += 1;
  }

  if (!pairs.some((pair) => pair.code === 0 && pair.value.toUpperCase() === 'EOF')) diagnostics.push({
    severity: 'error', code: 'missing-eof', message: 'El archivo no contiene el marcador EOF requerido.',
  });
  const sourceUnit = sourceUnitFromInsUnits(insertionUnits);
  const requiresUnitSelection = sourceUnit === null;
  if (requiresUnitSelection) diagnostics.push({
    severity: 'warning', code: 'units-required',
    message: 'INSUNITS falta o no está soportado; selecciona la unidad de origen explícitamente.',
  });
  const layers = [...new Set(segments.map((segment) => segment.layer))].sort((a, b) => a.localeCompare(b));
  const canImport = segments.length > 0 && !diagnostics.some((item) => item.severity === 'error');
  return { acadVersion, insertionUnits, layers, segments, diagnostics, counts: { accepted, rejected }, canImport, requiresUnitSelection };
};

const nextId = (prefix: string, used: Set<string>): string => {
  let index = 1;
  while (used.has(`${prefix}${index}`)) index += 1;
  const id = `${prefix}${index}`;
  used.add(id);
  return id;
};

const coordinateKey = (point: DxfPoint): string => `${Object.is(point.x, -0) ? 0 : String(point.x)}:${Object.is(point.y, -0) ? 0 : String(point.y)}`;

export const buildDxfImportCommand = (
  project: ProjectModel,
  inspection: DxfInspection,
  options: { sourceName: string; sourceUnit: DxfSourceUnit; templateMemberId: string },
): ProjectCommand => {
  if (!inspection.canImport) throw new Error('El DXF contiene diagnósticos bloqueantes o no aporta geometría compatible.');
  const template = project.members.find((member) => member.id === options.templateMemberId);
  if (!template) throw new Error('Selecciona un miembro existente como plantilla estructural explícita.');
  const factor = DXF_UNIT_FACTORS[options.sourceUnit];
  const usedNodes = new Set(project.nodes.map((node) => node.id));
  const usedMembers = new Set(project.members.map((member) => member.id));
  const importedNodes = new Map<string, NodeModel>();
  const nodes: NodeModel[] = [];
  const members: MemberModel[] = [];
  const {
    id: _templateId,
    i: _templateI,
    j: _templateJ,
    materialId: _templateMaterialId,
    materialOrigin: _templateMaterialOrigin,
    sectionId: _templateSectionId,
    sectionOrigin: _templateSectionOrigin,
    ...templateProperties
  } = structuredClone(template);

  const nodeFor = (source: DxfPoint): NodeModel => {
    const point = { x: source.x * factor, y: source.y * factor };
    const key = coordinateKey(point);
    const existing = importedNodes.get(key);
    if (existing) return existing;
    const node: NodeModel = { id: nextId('N', usedNodes), x: Object.is(point.x, -0) ? 0 : point.x, y: Object.is(point.y, -0) ? 0 : point.y, support: { type: 'none' } };
    importedNodes.set(key, node);
    nodes.push(node);
    return node;
  };

  for (const segment of inspection.segments) {
    const start = nodeFor(segment.start);
    const end = nodeFor(segment.end);
    members.push({
      ...structuredClone(templateProperties),
      id: nextId('M', usedMembers),
      i: start.id,
      j: end.id,
      materialOrigin: 'imported',
      sectionOrigin: 'imported',
    });
  }
  return {
    kind: 'dxf.import', description: `Importar DXF: ${options.sourceName}`,
    nodes, members, sourceName: options.sourceName,
  };
};
