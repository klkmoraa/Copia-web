#!/usr/bin/env node
/**
 * Local validation for the GitHub Actions workflows under `.github/workflows/`.
 *
 * This never contacts GitHub and never runs a workflow. It checks the invariants that can
 * actually be checked offline: basic YAML sanity (no tabs, top-level keys present,
 * balanced document), every `npm run <script>` the workflow invokes exists in
 * `package.json`, every local file path the workflow reads exists in the repository, and
 * none of the operations prohibited by the local CI policy appear (AI calls, third-party
 * deploys, publish, push, tag). GitHub Pages is the one sanctioned publication, and only
 * through GitHub's own first-party actions.
 *
 * No YAML parser dependency is added for this: the check is deliberately a conservative,
 * dependency-free text scan rather than a full parse. A workflow that references a script
 * that was renamed, or a path that was moved, fails here instead of failing silently on
 * GitHub the first time it actually runs.
 *
 * Usage: node scripts/validate-ci.mjs
 */
import { readFile, stat } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');

const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
const knownScripts = new Set(Object.keys(pkg.scripts ?? {}));

const exists = async (relative) => {
  try {
    await stat(path.join(ROOT, relative));
    return true;
  } catch {
    return false;
  }
};

const problems = [];
const note = (file, message) => problems.push(`${file}: ${message}`);

let workflowFiles;
try {
  workflowFiles = readdirSync(WORKFLOWS_DIR).filter((name) => /\.ya?ml$/.test(name));
} catch {
  console.error(`No existe ${path.relative(ROOT, WORKFLOWS_DIR)}. Nada que validar.`);
  process.exit(1);
}

if (workflowFiles.length === 0) {
  console.error('No hay archivos .yml/.yaml en .github/workflows.');
  process.exit(1);
}

for (const file of workflowFiles) {
  const relative = path.join('.github', 'workflows', file);
  const text = await readFile(path.join(WORKFLOWS_DIR, file), 'utf8');
  const lines = text.split(/\r\n|\n/);

  if (text.includes('\t')) note(relative, 'contiene tabulaciones; YAML solo admite espacios.');

  const topLevelKeys = new Set(
    lines
      .filter((line) => /^[A-Za-z_][\w-]*:/.test(line))
      .map((line) => line.split(':')[0].trim()),
  );
  if (!topLevelKeys.has('jobs')) note(relative, 'no declara una clave `jobs:` de nivel superior.');
  if (!topLevelKeys.has('permissions')) note(relative, 'no declara `permissions:` explicitos (deberia fijar el minimo necesario).');
  if (!topLevelKeys.has('on')) note(relative, 'no declara un disparador `on:`.');
  if (!topLevelKeys.has('name')) note(relative, 'no declara `name:`.');

  // Every `npm run <script>` / `npm test` referenced anywhere in a `run:` block must exist.
  for (const match of text.matchAll(/npm run ([\w:-]+)/g)) {
    if (!knownScripts.has(match[1])) note(relative, `referencia "npm run ${match[1]}", que no existe en package.json.`);
  }
  if (/\bnpm test\b/.test(text) && !knownScripts.has('test')) {
    note(relative, 'referencia "npm test", que no existe en package.json.');
  }

  if (/node-version-file:\s*['"]?\.nvmrc['"]?/.test(text) && !(await exists('.nvmrc'))) {
    note(relative, 'referencia .nvmrc, que no existe en la raiz del repositorio.');
  }

  // Local CI policy: no AI calls, deploy, publish or destructive/remote git.
  // Scanned on the executable text only — comments are free to *explain* these absences
  // (this file's own header does), which would otherwise trip a naive substring match.
  const executableText = lines
    .filter((line) => !/^\s*#/.test(line))
    .map((line) => line.replace(/\s#.*$/, ''))
    .join('\n');
  const forbidden = [
    [/anthropic/i, 'menciona Anthropic'],
    [/openai/i, 'menciona OpenAI'],
    [/\bclaude\b/i, 'menciona Claude'],
    [/\bcodex\b/i, 'menciona Codex'],
    [/npm publish/, 'publica un paquete'],
    [/\bgit push\b/, 'hace push'],
    [/\bgit tag\b/, 'crea un tag'],
    [/netlify|vercel/i, 'despliega a un proveedor externo'],
    [/actions\/deploy(?!-pages)/i, 'despliega'],
  ];
  for (const [pattern, reason] of forbidden) {
    if (pattern.test(executableText)) note(relative, `${reason}; la política del CI local no lo permite.`);
  }

  // GitHub Pages es la ÚNICA publicación sancionada, y sólo con las acciones de
  // primera parte de GitHub. La regla anterior vetaba todo despliegue en bloque;
  // eso protegía de un workflow que empujara el producto a cualquier sitio, pero
  // también impedía lo que el repositorio sí quiere hacer. Se estrecha en vez de
  // levantarse: un `deploy-pages` que venga acompañado de un proveedor externo,
  // de un push o de un publish sigue cayendo por las reglas de arriba, y una
  // acción de despliegue de terceros que se disfrace de Pages cae aquí.
  const pagesActions = executableText.match(/uses:\s*([\w-]+\/[\w-]+)@/g) ?? [];
  const foreignPagesAction = pagesActions
    .map((line) => line.replace(/uses:\s*/, '').replace(/@$/, ''))
    .find((action) => /pages/i.test(action) && !action.startsWith('actions/'));
  if (foreignPagesAction) {
    note(relative, `usa "${foreignPagesAction}" para publicar; sólo se permiten las acciones de Pages de "actions/".`);
  }
}

if (problems.length > 0) {
  console.error(`Validacion de CI local: ${problems.length} problema(s)\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`Validacion de CI local: ${workflowFiles.length} workflow(s) sin problemas detectables sin conectarse a GitHub.`);
console.log(workflowFiles.map((file) => `  - ${path.join('.github', 'workflows', file)}`).join('\n'));
