#!/usr/bin/env node
/**
 * Gate de capacidad de Space 3D.
 *
 * Ejecuta la medición real, extrae el informe del marcador y aplica la política
 * pura de `space3d-capacity-policy.mjs`. Falla si la capacidad publicada en
 * `SPACE3D_LIMITS` supera el último escalón realmente aprobado: un límite que
 * el motor no sostiene es peor que un límite bajo, porque el usuario descubre
 * el problema con su modelo dentro.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  SPACE3D_CAPACITY_POLICY,
  evaluateSpace3DCapacity,
  parseSpace3DCapacityReport,
} from './space3d-capacity-policy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const declaredLimits = () => {
  const source = readFileSync(resolve(ROOT, 'src/space3d/model/types.ts'), 'utf8');
  const nodes = source.match(/maxNodes:\s*(\d+)/);
  const members = source.match(/maxMembers:\s*(\d+)/);
  if (!nodes || !members) throw new Error('No se pudieron leer maxNodes/maxMembers de src/space3d/model/types.ts');
  return { nodes: Number(nodes[1]), members: Number(members[1]) };
};

// Se invoca el entry JS de vitest con el propio Node en vez de `npx`: en
// Windows, `spawnSync` sobre un `.cmd` sin shell devuelve EINVAL desde Node 20,
// y abrir un shell sólo para eso añade una capa de citado innecesaria.
const stdout = execFileSync(
  process.execPath,
  [
    resolve(ROOT, 'node_modules/vitest/vitest.mjs'),
    'run', 'src/space3d/engine/capacity.test.ts', '--maxWorkers=1', '--reporter=verbose',
  ],
  {
    cwd: ROOT,
    env: { ...process.env, SPACE3D_CAPACITY_REPORT: '1' },
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  },
);

const report = parseSpace3DCapacityReport(stdout);
const outcome = evaluateSpace3DCapacity(report);
const declared = declaredLimits();

const rows = outcome.measured.map((step) => ({
  nudos: step.nodes,
  barras: step.members,
  GDL: step.dofCount,
  'solve (ms)': step.solveMilliseconds,
  'matrices (MiB)': Number((step.estimatedBytes / 1024 / 1024).toFixed(2)),
  residual: step.relativeResidual,
  finito: step.finite,
}));

console.log(JSON.stringify({
  policy: SPACE3D_CAPACITY_POLICY,
  declared,
  approved: outcome.approved,
  failures: outcome.failures,
}, null, 2));
console.table(rows);

if (!outcome.ok || !outcome.approved) {
  console.error('Capacidad NO aprobada en algún escalón:', JSON.stringify(outcome.failures));
  process.exit(1);
}

if (declared.nodes > outcome.approved.nodes || declared.members > outcome.approved.members) {
  console.error(
    `SPACE3D_LIMITS publica ${declared.nodes}/${declared.members} pero sólo se aprobó `
    + `${outcome.approved.nodes}/${outcome.approved.members}. Baja el límite en src/space3d/model/types.ts.`,
  );
  process.exit(1);
}

console.log(`Capacidad Space 3D aprobada: ${outcome.approved.nodes} nudos / ${outcome.approved.members} barras.`);
