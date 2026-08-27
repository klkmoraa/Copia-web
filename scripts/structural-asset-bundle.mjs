import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const stagingPrefix = '.structural-stage-';
const backupPrefix = '.structural-backup-';

const publicAssetsDirectory = (projectRoot) => path.resolve(projectRoot, 'public', 'assets');

export const resolveStructuralAssetTarget = (
  projectRoot,
  candidate = path.join(publicAssetsDirectory(projectRoot), 'structural'),
) => {
  const assetsDirectory = publicAssetsDirectory(projectRoot);
  const expected = path.join(assetsDirectory, 'structural');
  const resolved = path.resolve(candidate);
  if (resolved !== expected || path.relative(assetsDirectory, resolved) !== 'structural') {
    throw new Error('Refusing to replace anything except the exact public/assets/structural target');
  }
  return resolved;
};

const assertSafeSibling = (projectRoot, candidate, prefix) => {
  const resolved = path.resolve(candidate);
  const assetsDirectory = publicAssetsDirectory(projectRoot);
  if (path.dirname(resolved) !== assetsDirectory || !path.basename(resolved).startsWith(prefix)) {
    throw new Error(`Refusing unsafe structural asset sibling: ${resolved}`);
  }
  return resolved;
};

export const createStructuralAssetStagingDirectory = (projectRoot) => {
  const finalDirectory = resolveStructuralAssetTarget(projectRoot);
  fs.mkdirSync(path.dirname(finalDirectory), { recursive: true });
  return fs.mkdtempSync(path.join(path.dirname(finalDirectory), stagingPrefix));
};

export const removeStructuralAssetStagingDirectory = (projectRoot, stagingDirectory) => {
  const safeStaging = assertSafeSibling(projectRoot, stagingDirectory, stagingPrefix);
  if (fs.existsSync(safeStaging)) fs.rmSync(safeStaging, { recursive: true, force: true });
};

export const publishStructuralAssetBundle = ({ projectRoot, stagingDirectory, validateBundle }) => {
  const finalDirectory = resolveStructuralAssetTarget(projectRoot);
  const safeStaging = assertSafeSibling(projectRoot, stagingDirectory, stagingPrefix);
  validateBundle(safeStaging);

  const backupDirectory = assertSafeSibling(
    projectRoot,
    path.join(path.dirname(finalDirectory), `${backupPrefix}${randomUUID()}`),
    backupPrefix,
  );
  const hadPreviousBundle = fs.existsSync(finalDirectory);
  let previousMoved = false;
  try {
    if (hadPreviousBundle) {
      fs.renameSync(finalDirectory, backupDirectory);
      previousMoved = true;
    }
    fs.renameSync(safeStaging, finalDirectory);
  } catch (error) {
    if (previousMoved && !fs.existsSync(finalDirectory) && fs.existsSync(backupDirectory)) {
      fs.renameSync(backupDirectory, finalDirectory);
    }
    throw error;
  }
  if (previousMoved && fs.existsSync(backupDirectory)) {
    fs.rmSync(backupDirectory, { recursive: true, force: true });
  }
  return finalDirectory;
};
