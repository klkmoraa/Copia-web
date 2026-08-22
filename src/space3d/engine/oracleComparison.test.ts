import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeSpace3DProject } from './solver';
import { SPACE3D_DOF_KEYS, type Space3DAnalysisResult, type Space3DProjectV1 } from '../model/types';

const CORPUS = resolve(process.cwd(), 'validation/space3d/oracles');

interface Observable {
  readonly path: string;
  readonly unit: string;
  readonly atol: number;
  readonly rtol: number;
}

interface ManualCase {
  readonly id: string;
  readonly source: 'manual';
  readonly target: string;
  readonly model: string;
  readonly result: string;
  readonly observables: readonly Observable[];
}

interface ExternalRun {
  readonly caseId: string;
  readonly oracle: string;
  readonly status: 'NOT_RUN' | 'RUN';
  readonly reason: string | null;
  readonly output: string | null;
  readonly outputSha256: string | null;
  readonly version: string | null;
  /**
   * Tolerancias propias de la corrida externa. Existen porque structureCo pone
   * a cero exacto la reaccion en los GDL libres y los motores externos publican
   * ahi su residuo numerico: comparar contra cero exacto mediria esa decision
   * de presentacion, no la fisica.
   */
  readonly observables: readonly Observable[] | null;
}

interface Manifest {
  readonly schemaVersion: number;
  readonly cases: readonly ManualCase[];
  readonly externalRuns: readonly ExternalRun[];
}

const readJson = <T,>(relative: string): T => JSON.parse(readFileSync(resolve(CORPUS, relative), 'utf8')) as T;

const manifest = readJson<Manifest>('manifest.json');

type ExpectedFile = {
  readonly nodes: Record<string, Record<string, number>>;
  readonly reactions: Record<string, Record<string, number>>;
};

const actualValue = (result: Space3DAnalysisResult, group: string, nodeId: string, dof: string): number => {
  const node = result.nodeResults.find((item) => item.nodeId === nodeId);
  if (!node) throw new Error(`El resultado no contiene el nudo ${nodeId}`);
  const bag = group === 'nodes' ? node.displacement : node.reaction;
  return bag[dof as keyof typeof bag];
};

describe('Space3D manual oracle corpus', () => {
  it('declara un manifiesto versionado y no vacío', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.cases.length).toBeGreaterThanOrEqual(5);
    expect(manifest.cases.every((item) => item.source === 'manual')).toBe(true);
  });

  for (const testCase of manifest.cases) {
    it(`reproduce ${testCase.id} dentro de las tolerancias declaradas`, () => {
      const project = readJson<Space3DProjectV1>(testCase.model);
      const expected = readJson<ExpectedFile>(testCase.result);
      const result = analyzeSpace3DProject(project, testCase.target);
      expect(result.success, JSON.stringify(result.issues)).toBe(true);

      const covered = new Set<string>();
      for (const observable of testCase.observables) {
        const [group, nodeId] = observable.path.split('.');
        expect(['nodes', 'reactions']).toContain(group);
        const bag = (expected as unknown as Record<string, Record<string, Record<string, number>>>)[group][nodeId];
        expect(bag, `${testCase.id} declara ${observable.path} pero el esperado no lo tiene`).toBeDefined();
        for (const dof of SPACE3D_DOF_KEYS) {
          const target = bag[dof];
          const actual = actualValue(result, group, nodeId, dof);
          const tolerance = observable.atol + observable.rtol * Math.abs(target);
          expect(
            Math.abs(actual - target),
            `${testCase.id} ${observable.path}.${dof} (${observable.unit}): ${actual} vs ${target}`,
          ).toBeLessThanOrEqual(tolerance);
          covered.add(`${group}.${nodeId}.${dof}`);
        }
      }

      // Ningún valor del archivo esperado puede quedar sin comparar.
      for (const group of ['nodes', 'reactions'] as const) {
        for (const [nodeId, bag] of Object.entries(expected[group])) {
          for (const dof of Object.keys(bag)) {
            expect(covered, `${testCase.id}: ${group}.${nodeId}.${dof} sin observable`).toContain(`${group}.${nodeId}.${dof}`);
          }
        }
      }
    });
  }
});

describe('Space3D external oracle corpus', () => {
  it('registra las corridas externas pendientes sin declararlas aprobadas', () => {
    expect(manifest.externalRuns.length).toBeGreaterThan(0);
    for (const run of manifest.externalRuns) {
      if (run.status !== 'NOT_RUN') continue;
      expect(run.output).toBeNull();
      expect(run.outputSha256).toBeNull();
      expect(run.version).toBeNull();
      expect(run.reason).toBeTruthy();
    }
  });

  for (const run of manifest.externalRuns) {
    const title = `${run.oracle} reproduce ${run.caseId}`;
    if (run.status === 'NOT_RUN') {
      it.skip(`${title} — omitido: ${run.reason ?? 'sin razón declarada'}`, () => {});
      continue;
    }
    it(title, () => {
      const testCase = manifest.cases.find((item) => item.id === run.caseId);
      expect(testCase, `El manifiesto no declara el caso ${run.caseId}`).toBeDefined();
      expect(run.output).toBeTruthy();
      expect(run.outputSha256).toBeTruthy();
      expect(run.version).toBeTruthy();

      const project = readJson<Space3DProjectV1>(testCase!.model);
      const oracle = readJson<ExpectedFile>(run.output!);
      const result = analyzeSpace3DProject(project, testCase!.target);
      expect(result.success).toBe(true);

      for (const observable of run.observables ?? testCase!.observables) {
        const [group, nodeId] = observable.path.split('.');
        const bag = (oracle as unknown as Record<string, Record<string, Record<string, number>>>)[group][nodeId];
        expect(bag, `${run.oracle} ${run.caseId}: falta ${observable.path}`).toBeDefined();
        for (const dof of SPACE3D_DOF_KEYS) {
          const target = bag[dof];
          const actual = actualValue(result, group, nodeId, dof);
          expect(
            Math.abs(actual - target),
            `${run.oracle} ${run.caseId} ${observable.path}.${dof}: ${actual} vs ${target}`,
          ).toBeLessThanOrEqual(observable.atol + observable.rtol * Math.abs(target));
        }
      }
    });
  }
});
