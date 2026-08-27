import path from 'node:path';
import { validateStructuralPngBundle } from './structural-png-contract.mjs';

const root = path.resolve(import.meta.dirname, '..');
const assetRoot = path.join(root, 'public', 'assets', 'structural');
validateStructuralPngBundle(assetRoot);
console.log('Three.js structural render contract PASS · 80 PNG · 40 Day + 40 Night · 900×600 · transparent pixels');
