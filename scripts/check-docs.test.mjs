import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkDocs } from './check-docs.mjs';

const createFixture = () => mkdtempSync(path.join(tmpdir(), 'structureco-docs-'));

const write = (root, relative, contents) => {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents, 'utf8');
};

test('acepta un árbol documental clasificado y con enlaces relativos válidos', () => {
  const root = createFixture();
  try {
    write(root, 'README.md', '# Producto\n\nConsulta el [índice](docs/README.md).\n');
    write(root, 'docs/README.md', '# Documentación\n\n**Clasificación:** `CANONICAL`\n\n[Arquitectura](architecture/README.md)\n');
    write(root, 'docs/architecture/README.md', '# Arquitectura\n\n**Clasificación:** `CANONICAL`\n\n[Producto](../../README.md)\n');
    write(root, 'docs/architecture/structureco-space-3d-s3d1.md', '# Space 3D\n\n**Clasificación:** `CANONICAL`\n');
    write(root, 'docs/historico.md', '# Documento anterior\n\n> **HISTORICAL** — Conservado como registro.\n\n**Clasificación:** `HISTORICAL`\n\nSustituido por el [índice](README.md).\n');
    write(root, 'reports/README.md', '# Reportes\n\n**Clasificación del directorio:** `AUDIT/TEMPORARY`\n');

    assert.deepEqual(checkDocs(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reporta faltantes, clasificaciones inválidas, históricos sin aviso y enlaces rotos', () => {
  const root = createFixture();
  try {
    write(root, 'README.md', '# Producto\n\n[Enlace roto](docs/ausente.md)\n');
    write(root, 'docs/README.md', '# Documentación sin clasificación\n');
    write(root, 'docs/architecture/README.md', '# Arquitectura\n\n**Clasificación:** `CANONICAL`\n');
    write(root, 'docs/architecture/structureco-space-3d-s3d1.md', '# Space 3D\n\n**Clasificación:** `CANONICAL`\n');
    write(root, 'docs/antiguo.md', '# Antiguo\n\n**Clasificación:** `HISTORICAL`\n');
    write(root, 'docs/desconocido.md', '# Desconocido\n\n**Clasificación:** `CURRENT`\n');

    const problems = checkDocs(root);
    assert.ok(problems.some((problem) => problem.includes('reports/README.md')));
    assert.ok(problems.some((problem) => problem.includes('docs/README.md') && problem.includes('clasificación')));
    assert.ok(problems.some((problem) => problem.includes('docs/antiguo.md') && problem.includes('aviso visible')));
    assert.ok(problems.some((problem) => problem.includes('docs/desconocido.md') && problem.includes('CURRENT')));
    assert.ok(problems.some((problem) => problem.includes('docs/ausente.md') && problem.includes('enlace roto')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
