import { strict as assert } from 'node:assert';
import test from 'node:test';
import { countEntities, createLargeProject, datasheetRowCounts, DEFAULT_GRID, SCHEMA_VERSION } from './large-model.mjs';

/**
 * Estas pruebas defienden lo único que el harness de CRI-93 no puede comprobar
 * por sí mismo: que el modelo inyectado es válido para `normalizeProject` y que
 * su tamaño es el declarado en el informe. Un modelo que el producto rechace en
 * silencio haría medir el proyecto por defecto de 4 nudos y el dato sería falso.
 */

test('la malla por defecto declara ~2000 entidades con 1282 filas de miembros', () => {
  const project = createLargeProject();
  const counts = countEntities(project);
  assert.equal(counts.nodes, 667);
  assert.equal(counts.members, 1282);
  assert.equal(counts.total, 2012);
  assert.deepEqual(datasheetRowCounts(project), { nodes: 667, members: 1282, loads: 60 });
});

test('es determinista: dos generaciones son byte a byte iguales', () => {
  assert.equal(JSON.stringify(createLargeProject()), JSON.stringify(createLargeProject()));
});

test('el esquema declarado es el vigente y la malla es configurable', () => {
  assert.equal(createLargeProject().schemaVersion, SCHEMA_VERSION);
  const small = createLargeProject({ columns: 3, rows: 4 });
  assert.equal(small.nodes.length, 12);
  // (columns-1)*rows + columns*(rows-1) = 8 + 9
  assert.equal(small.members.length, 17);
});

test('rechaza mallas degeneradas en vez de emitir un modelo vacío', () => {
  assert.throws(() => createLargeProject({ columns: 1 }), /columns/);
  assert.throws(() => createLargeProject({ rows: 1 }), /rows/);
  assert.throws(() => createLargeProject({ columns: 2.5 }), /columns/);
});

test('los identificadores son únicos en cada colección', () => {
  const project = createLargeProject();
  for (const key of ['nodes', 'members', 'nodalLoads', 'memberLoads', 'loadCases', 'combinations']) {
    const ids = project[key].map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length, `ids repetidos en ${key}`);
  }
});

test('la integridad referencial es la que exige normalizeProject', () => {
  const project = createLargeProject();
  const nodeIds = new Set(project.nodes.map((node) => node.id));
  const memberIds = new Set(project.members.map((member) => member.id));
  const caseIds = new Set(project.loadCases.map((loadCase) => loadCase.id));

  for (const member of project.members) {
    assert.ok(nodeIds.has(member.i), `miembro ${member.id} apunta a un nudo inexistente`);
    assert.ok(nodeIds.has(member.j), `miembro ${member.id} apunta a un nudo inexistente`);
    assert.notEqual(member.i, member.j);
    assert.ok(['frame', 'truss', 'rigid'].includes(member.type));
    assert.ok(['catalog', 'custom', 'imported', 'legacy'].includes(member.materialOrigin));
    assert.ok(['catalog', 'custom', 'imported', 'legacy'].includes(member.sectionOrigin));
    // `catalog` sin id es un fallo duro en migrate.ts; este fixture no usa catálogo.
    assert.notEqual(member.materialOrigin, 'catalog');
    assert.notEqual(member.sectionOrigin, 'catalog');
    for (const value of [member.E, member.A, member.I]) assert.ok(Number.isFinite(value) && value > 0);
  }
  for (const load of project.nodalLoads) {
    assert.ok(nodeIds.has(load.nodeId));
    assert.ok(caseIds.has(load.caseId));
    for (const value of [load.fx, load.fy, load.mz]) assert.ok(Number.isFinite(value));
  }
  for (const load of project.memberLoads) {
    assert.ok(memberIds.has(load.memberId));
    assert.ok(caseIds.has(load.caseId));
    assert.ok(load.start >= 0 && load.start <= 1 && load.end >= 0 && load.end <= 1);
    assert.ok(load.start <= load.end);
  }
  for (const combination of project.combinations) {
    for (const caseId of Object.keys(combination.factors)) assert.ok(caseIds.has(caseId));
  }
});

test('las coordenadas son finitas y la fila base es la única apoyada', () => {
  const project = createLargeProject();
  const supported = project.nodes.filter((node) => node.support.type !== 'none');
  assert.equal(supported.length, DEFAULT_GRID.columns);
  for (const node of supported) assert.equal(node.y, 0);
  for (const node of project.nodes) {
    assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y));
  }
});

test('cabe en localStorage con margen sobrado', () => {
  const bytes = Buffer.byteLength(JSON.stringify(createLargeProject()), 'utf8');
  assert.ok(bytes < 2 * 1024 * 1024, `el modelo pesa ${bytes} bytes`);
});
