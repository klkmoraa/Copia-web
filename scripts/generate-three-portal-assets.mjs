/** Generate transparent PNG thumbnails from every editable Three.js structural scene. */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import {
  createStructuralAssetStagingDirectory,
  publishStructuralAssetBundle,
  removeStructuralAssetStagingDirectory,
  resolveStructuralAssetTarget,
} from './structural-asset-bundle.mjs';
import { validateStructuralPngBundle } from './structural-png-contract.mjs';

const root = path.resolve(import.meta.dirname, '..');
const themes = ['day', 'night'];
const outputRoot = resolveStructuralAssetTarget(root);
const stagingRoot = createStructuralAssetStagingDirectory(root);
let assetIds = [];

try {
  const server = await createServer({ root, server: { host: '127.0.0.1', port: 4211, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.goto('http://127.0.0.1:4211/__three-assets', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.__STRUCTURECO_RENDER_ASSET__ === 'function' && window.__STRUCTURECO_THREE_ASSET_IDS__?.length === 40);
    assetIds = await page.evaluate(() => [...window.__STRUCTURECO_THREE_ASSET_IDS__]);
    for (const theme of themes) {
      for (const assetId of assetIds) {
        const dataUrl = await page.evaluate(async ({ assetId, theme }) => window.__STRUCTURECO_RENDER_ASSET__(assetId, theme), { assetId, theme });
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        const [family, variant] = assetId.split(':');
        const familyDir = path.join(stagingRoot, theme, family);
        fs.mkdirSync(familyDir, { recursive: true });
        fs.writeFileSync(path.join(familyDir, `${variant}.png`), Buffer.from(base64, 'base64'));
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
  publishStructuralAssetBundle({ projectRoot: root, stagingDirectory: stagingRoot, validateBundle: validateStructuralPngBundle });
  console.log(`Generated ${assetIds.length * themes.length} validated transparent Three.js structural renders in ${path.relative(root, outputRoot)}`);
} finally {
  if (fs.existsSync(stagingRoot)) removeStructuralAssetStagingDirectory(root, stagingRoot);
}
