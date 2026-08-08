import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import type { AnalysisResult, MemberResult } from '../types';
import { buildResultsCsv, createResultsCsvBlob, resultsCsvFilename } from './resultsExport';

const member = (): MemberResult => ({
  memberId: 'M,1',
  length: 2,
  localDisplacements: [],
  localEndForces: [],
  diagramSegments: [{
    x0: 0,
    x1: 2,
    axial: [-1, 2, 0],
    shear: [2, -1, 0],
    moment: [0, 2, -1, 0],
    distributedAxial: [0, 0],
    distributedTransverse: [0, 0],
  }],
  diagramJumps: [],
  criticalPoints: [],
  diagram: [],
  deformation: [],
  deformationSegments: [{
    x0: 0,
    x1: 2,
    u: [0, 0.001, 0, 0],
    theta: [0, 0.002, -0.001, 0, 0],
    v: [0, 0.001, -0.0005, 0, 0, 0],
  }],
  deformationCriticalPoints: [],
  maxAxial: 0,
  minAxial: 0,
  maxShear: 0,
  minShear: 0,
  maxMoment: 0,
  minMoment: 0,
});

const analysis = (): AnalysisResult => ({
  success: true,
  issues: [{
    id: 'warning-1',
    severity: 'warning',
    title: 'Revisar, apoyo',
    message: 'Dice "hola"\ny continúa.',
    objectId: 'N1',
    suggestedFix: 'Agregar restricción.',
  }],
  nodeResults: [{ nodeId: 'N1', ux: 0.001, uy: -0.002, rz: 0.003, rx: 1, ry: -2, rm: 3 }],
  memberResults: [member()],
  displacements: [],
  residualNorm: 0,
  conditionEstimate: 1,
  equilibrium: { sumFx: 0, sumFy: 0, sumM: 0, normalizedComponents: { fx: 0, fy: 0, mz: 0 }, normalizedResidual: 0 },
  explanation: [],
});

describe('exportación CSV de resultados', () => {
  it('genera BOM, esquema rectangular, CRLF y convierte todas las unidades', () => {
    const project = createDefaultProject();
    project.settings.units = 'N-mm';
    const csv = buildResultsCsv(project, analysis(), { scenarioName: 'Servicio, raro' });
    expect(csv.startsWith('\uFEFFsection,entity,id,quantity')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv).toContain('reaction,node,N1,Rx,,,1000,N');
    expect(csv).toContain('reaction,node,N1,Mz,,,3000000,N·mm');
    expect(csv).toContain('displacement,node,N1,Ux,,,1,mm');
    expect(csv).toContain('displacement,node,N1,Rz,,,0.003,rad');
    expect(csv).toContain('member_extreme,member,"M,1",moment,maximum,1000,1000000,N·mm');
    expect(csv).toContain('deformation_extreme,member,"M,1",v,maximum,1000,0.5,mm');
    expect(csv).toContain('"Servicio, raro"');
    expect(csv).not.toContain('1.000,00');
  });

  it('escapa comas, comillas y saltos de línea en advertencias sin romper columnas', () => {
    const csv = buildResultsCsv(createDefaultProject(), analysis());
    expect(csv).toContain('"Revisar, apoyo: Dice ""hola""\ny continúa. Solución: Agregar restricción."');
    const logicalLines = csv.slice(1).split('\r\n');
    expect(logicalLines[0].split(',')).toHaveLength(11);
  });

  it('produce nombre seguro y Blob con MIME explícito', async () => {
    const project = createDefaultProject();
    project.name = 'Pórtico Núm. 1 / clase';
    expect(resultsCsvFilename(project)).toBe('portico-num-1-clase-resultados.csv');
    const blob = createResultsCsvBlob(project, analysis());
    expect(blob.type).toBe('text/csv;charset=utf-8');
    expect([...new Uint8Array(await blob.arrayBuffer()).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });
});
