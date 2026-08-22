#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const VALID_CLASSIFICATIONS = new Set(['CANONICAL', 'REFERENCE', 'HISTORICAL', 'AUDIT/TEMPORARY']);
const REQUIRED_FILES = [
  'README.md',
  'docs/README.md',
  'docs/architecture/README.md',
  'docs/architecture/structureco-space-3d-s3d1.md',
  'reports/README.md',
];
const REQUIRED_CANONICAL = new Set([
  'docs/README.md',
  'docs/architecture/README.md',
  'docs/architecture/structureco-space-3d-s3d1.md',
]);

const relativePath = (root, target) => path.relative(root, target).replaceAll(path.sep, '/');

const markdownFilesUnder = (directory) => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFilesUnder(target);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.md') ? [target] : [];
  });
};

const classificationOf = (text) => {
  const line = text.match(/^\*\*Clasificación:\*\*\s*`([^`]+)`\s*$/m);
  return line?.[1] ?? null;
};

const linkTargets = (text) => [...text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1].trim());

const localLinkPath = (rawTarget) => {
  if (!rawTarget || rawTarget.startsWith('#') || rawTarget.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(rawTarget)) return null;
  const target = rawTarget.startsWith('<') && rawTarget.includes('>')
    ? rawTarget.slice(1, rawTarget.indexOf('>'))
    : rawTarget.split(/\s+["']/)[0];
  const withoutFragment = target.split('#')[0].split('?')[0];
  if (!withoutFragment) return null;
  try {
    return decodeURIComponent(withoutFragment);
  } catch {
    return withoutFragment;
  }
};

export const checkDocs = (root = ROOT) => {
  const problems = [];
  const docsDirectory = path.join(root, 'docs');
  const docsFiles = markdownFilesUnder(docsDirectory).sort();

  for (const required of REQUIRED_FILES) {
    if (!existsSync(path.join(root, required))) problems.push(`${required}: documento obligatorio ausente.`);
  }

  for (const file of docsFiles) {
    const relative = relativePath(root, file);
    const text = readFileSync(file, 'utf8');
    const classification = classificationOf(text);
    if (!classification) {
      problems.push(`${relative}: falta la línea de clasificación documental.`);
      continue;
    }
    if (!VALID_CLASSIFICATIONS.has(classification)) {
      problems.push(`${relative}: clasificación desconocida \`${classification}\`.`);
      continue;
    }
    if (REQUIRED_CANONICAL.has(relative) && classification !== 'CANONICAL') {
      problems.push(`${relative}: debe clasificarse como \`CANONICAL\`, no \`${classification}\`.`);
    }
    if (classification === 'HISTORICAL') {
      const opening = text.split(/\r?\n/).slice(0, 12).join('\n');
      if (!/^> \*\*HISTORICAL\*\*/m.test(opening)) {
        problems.push(`${relative}: un documento HISTORICAL necesita un aviso visible al inicio.`);
      }
    }
  }

  const linkedFiles = [
    path.join(root, 'README.md'),
    ...docsFiles,
    path.join(root, 'reports', 'README.md'),
  ].filter((file, index, files) => existsSync(file) && files.indexOf(file) === index);

  for (const file of linkedFiles) {
    const source = relativePath(root, file);
    const text = readFileSync(file, 'utf8');
    for (const rawTarget of linkTargets(text)) {
      const localTarget = localLinkPath(rawTarget);
      if (!localTarget) continue;
      const resolved = path.resolve(path.dirname(file), localTarget);
      if (!existsSync(resolved)) problems.push(`${source}: enlace roto a \`${localTarget}\`.`);
      else if (!statSync(resolved).isFile() && !statSync(resolved).isDirectory()) problems.push(`${source}: enlace inválido a \`${localTarget}\`.`);
    }
  }

  return problems;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const problems = checkDocs();
  if (problems.length > 0) {
    console.error(`Verificación documental: ${problems.length} problema(s).`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  const docsCount = markdownFilesUnder(path.join(ROOT, 'docs')).length;
  console.log(`Verificación documental: ${docsCount} documento(s) bajo docs/** clasificados; archivos obligatorios y enlaces relativos válidos.`);
}
