import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createStructuralAssetStagingDirectory,
  publishStructuralAssetBundle,
  removeStructuralAssetStagingDirectory,
  resolveStructuralAssetTarget,
} from './structural-asset-bundle.mjs';

const createProjectFixture = () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'structureco-asset-bundle-'));
  const finalDirectory = path.join(projectRoot, 'public', 'assets', 'structural');
  fs.mkdirSync(finalDirectory, { recursive: true });
  fs.writeFileSync(path.join(finalDirectory, 'previous.txt'), 'complete previous bundle');
  return { projectRoot, finalDirectory };
};

const removeProjectFixture = (projectRoot) => {
  const resolved = path.resolve(projectRoot);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.match(path.basename(resolved), /^structureco-asset-bundle-/);
  fs.rmSync(resolved, { recursive: true, force: true });
};

test('publishes a validated sibling bundle and retires the previous one', () => {
  const { projectRoot, finalDirectory } = createProjectFixture();
  try {
    const stagingDirectory = createStructuralAssetStagingDirectory(projectRoot);
    fs.writeFileSync(path.join(stagingDirectory, 'next.txt'), 'validated next bundle');
    publishStructuralAssetBundle({
      projectRoot,
      stagingDirectory,
      validateBundle: (candidate) => assert.equal(fs.readFileSync(path.join(candidate, 'next.txt'), 'utf8'), 'validated next bundle'),
    });
    assert.equal(fs.readFileSync(path.join(finalDirectory, 'next.txt'), 'utf8'), 'validated next bundle');
    assert.equal(fs.existsSync(path.join(finalDirectory, 'previous.txt')), false);
    assert.equal(fs.existsSync(stagingDirectory), false);
  } finally {
    removeProjectFixture(projectRoot);
  }
});

test('preserves the previous complete bundle when validation fails', () => {
  const { projectRoot, finalDirectory } = createProjectFixture();
  try {
    const stagingDirectory = createStructuralAssetStagingDirectory(projectRoot);
    fs.writeFileSync(path.join(stagingDirectory, 'broken.txt'), 'incomplete bundle');
    assert.throws(() => publishStructuralAssetBundle({
      projectRoot,
      stagingDirectory,
      validateBundle: () => { throw new Error('expected 80 PNG files'); },
    }), /expected 80 PNG files/);
    assert.equal(fs.readFileSync(path.join(finalDirectory, 'previous.txt'), 'utf8'), 'complete previous bundle');
    assert.equal(fs.existsSync(stagingDirectory), true);
    removeStructuralAssetStagingDirectory(projectRoot, stagingDirectory);
  } finally {
    removeProjectFixture(projectRoot);
  }
});

test('rejects every replacement target except public/assets/structural', () => {
  const { projectRoot } = createProjectFixture();
  try {
    assert.throws(
      () => resolveStructuralAssetTarget(projectRoot, path.join(projectRoot, 'public', 'assets', 'other')),
      /exact public.assets.structural target/,
    );
  } finally {
    removeProjectFixture(projectRoot);
  }
});
