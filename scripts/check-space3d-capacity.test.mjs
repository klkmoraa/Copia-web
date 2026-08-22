import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SPACE3D_CAPACITY_POLICY,
  evaluateSpace3DCapacity,
  parseSpace3DCapacityReport,
} from './space3d-capacity-policy.mjs';

const step = (overrides = {}) => ({
  nodes: 25,
  members: 50,
  dofCount: 150,
  solveMilliseconds: 12,
  estimatedBytes: 1_000_000,
  finite: true,
  ...overrides,
});

const report = (steps) => ({ schemaVersion: 1, steps });

test('publica una política explícita y comprobable', () => {
  assert.equal(SPACE3D_CAPACITY_POLICY.maxSolveMilliseconds, 2000);
  assert.equal(SPACE3D_CAPACITY_POLICY.maxAdditionalBytes, 256 * 1024 * 1024);
});

test('aprueba el escalón máximo cuando todos los escalones cumplen', () => {
  const outcome = evaluateSpace3DCapacity(report([
    step({ nodes: 25, members: 50 }),
    step({ nodes: 50, members: 100 }),
    step({ nodes: 100, members: 200, solveMilliseconds: 600 }),
    step({ nodes: 150, members: 300, solveMilliseconds: 1900 }),
  ]));
  assert.equal(outcome.ok, true);
  assert.deepEqual(outcome.approved, { nodes: 150, members: 300 });
  assert.deepEqual(outcome.failures, []);
});

test('degrada al último escalón aprobado cuando se excede el tiempo', () => {
  const outcome = evaluateSpace3DCapacity(report([
    step({ nodes: 25, members: 50 }),
    step({ nodes: 50, members: 100 }),
    step({ nodes: 100, members: 200, solveMilliseconds: 2001 }),
    step({ nodes: 150, members: 300, solveMilliseconds: 4000 }),
  ]));
  assert.equal(outcome.ok, false);
  assert.deepEqual(outcome.approved, { nodes: 50, members: 100 });
  assert.equal(outcome.failures[0].reason, 'solve-time');
  assert.equal(outcome.failures[0].nodes, 100);
});

test('degrada cuando la memoria estimada supera el techo', () => {
  const outcome = evaluateSpace3DCapacity(report([
    step({ nodes: 25, members: 50 }),
    step({ nodes: 150, members: 300, estimatedBytes: 512 * 1024 * 1024 }),
  ]));
  assert.equal(outcome.ok, false);
  assert.deepEqual(outcome.approved, { nodes: 25, members: 50 });
  assert.equal(outcome.failures[0].reason, 'memory');
});

test('degrada cuando el resultado no es finito', () => {
  const outcome = evaluateSpace3DCapacity(report([
    step({ nodes: 25, members: 50 }),
    step({ nodes: 50, members: 100, finite: false }),
  ]));
  assert.equal(outcome.ok, false);
  assert.deepEqual(outcome.approved, { nodes: 25, members: 50 });
  assert.equal(outcome.failures[0].reason, 'non-finite');
});

test('sin ningún escalón aprobado no publica capacidad', () => {
  const outcome = evaluateSpace3DCapacity(report([step({ finite: false })]));
  assert.equal(outcome.ok, false);
  assert.equal(outcome.approved, null);
});

test('rechaza un informe vacío o con otra versión de esquema', () => {
  assert.throws(() => evaluateSpace3DCapacity({ schemaVersion: 2, steps: [step()] }), /schemaVersion/);
  assert.throws(() => evaluateSpace3DCapacity(report([])), /steps/);
  assert.throws(() => evaluateSpace3DCapacity(null), /report/);
});

test('extrae el informe del marcador impreso por vitest', () => {
  const payload = report([step()]);
  const stdout = [
    'RUN v4 ...',
    `SPACE3D_CAPACITY_JSON=${JSON.stringify(payload)}`,
    'Test Files 1 passed (1)',
  ].join('\n');
  assert.deepEqual(parseSpace3DCapacityReport(stdout), payload);
});

test('falla si el marcador no aparece o no es JSON', () => {
  assert.throws(() => parseSpace3DCapacityReport('sin marcador'), /SPACE3D_CAPACITY_JSON/);
  assert.throws(() => parseSpace3DCapacityReport('SPACE3D_CAPACITY_JSON={rota'), /JSON/);
});
