// LEDGER-05 · Remedición del pórtico en Noche sobre el PRODUCTO REAL renderizado
// (no tokens.css aislado): arranca la app construida, entra a Welcome, fuerza
// Noche, y lee PÍXELES reales del screenshot (post-filtro SVG, post-composición)
// con un decodificador PNG mínimo (zlib.inflateSync, sin dependencias).
import { chromium } from 'playwright';
import { preview } from 'vite';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(evidenceDir, '../../../../');

// --- decodificador PNG mínimo: sólo no-entrelazado, color 6 (RGBA) u 8-bit ---
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let offset = 8;
  let width, height, bitDepth, colorType;
  const idat = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    offset += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`bitDepth ${bitDepth} no soportado`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    const filterType = raw[pos]; pos += 1;
    const rowStart = pos;
    for (let x = 0; x < stride; x += 1) {
      const raw_x = raw[rowStart + x];
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = y > 0 && x >= channels ? out[(y - 1) * stride + x - channels] : 0;
      let value;
      if (filterType === 0) value = raw_x;
      else if (filterType === 1) value = raw_x + a;
      else if (filterType === 2) value = raw_x + b;
      else if (filterType === 3) value = raw_x + Math.floor((a + b) / 2);
      else if (filterType === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        value = raw_x + pr;
      } else throw new Error(`filter ${filterType} desconocido`);
      out[y * stride + x] = value & 0xff;
    }
    pos += stride;
  }
  return { width, height, channels, pixels: out };
}

function pixelAt(img, x, y) {
  const xi = Math.round(x); const yi = Math.round(y);
  const idx = (yi * img.width + xi) * img.channels;
  return [img.pixels[idx], img.pixels[idx + 1], img.pixels[idx + 2]];
}

const lum = ([r, g, b]) => {
  const [rl, gl, bl] = [r, g, b].map((c) => c / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
};
const ratio = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const r2 = (n) => Math.round(n * 100) / 100;
const hex = ([r, g, b]) => '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');

const previewServer = await preview({ root: repoRoot, preview: { host: '127.0.0.1', port: 4188, strictPort: true }, logLevel: 'error' });
const baseURL = 'http://127.0.0.1:4188/';

const browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH
  ? { headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
  : { headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });

async function measureTheme(theme) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.addInitScript(() => { try { indexedDB.deleteDatabase('structureCo.projects'); } catch { /* noop */ } });
  await page.addInitScript((t) => { try { localStorage.setItem('structureCo.theme', t); } catch { /* noop */ } }, theme);
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.portal-hero', { timeout: 15000 });
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.waitForTimeout(300); // asienta transición de tema, si la hay

  const geom = await page.evaluate(() => {
    const svg = document.querySelector('.portal-hero');
    const groundLines = [...svg.querySelectorAll('.portal-hero__ground line')];
    const lastLine = groundLines[groundLines.length - 1];
    const rect = lastLine.getBoundingClientRect();
    const groundPoint = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

    const faces = [...svg.querySelectorAll('.portal-hero__face')];
    const topFace = faces.find((f) => f.getAttribute('d') && f.getBoundingClientRect().width > 4) ?? faces[0];
    const fr = topFace.getBoundingClientRect();
    const facePoint = { x: fr.left + fr.width / 2, y: fr.top + fr.height / 2 };

    const containerRect = document.querySelector('.welcome-portal').getBoundingClientRect();
    // Esquina del contenedor, lejos de cualquier trazo/cara: fondo efectivo puro.
    const bgPoint = { x: containerRect.left + 4, y: containerRect.top + 4 };

    return { groundPoint, facePoint, bgPoint, containerRect: { x: containerRect.x, y: containerRect.y, w: containerRect.width, h: containerRect.height } };
  });

  const clip = {
    x: Math.max(0, Math.floor(geom.containerRect.x) - 10),
    y: Math.max(0, Math.floor(geom.containerRect.y) - 10),
    width: Math.ceil(geom.containerRect.w) + 20,
    height: Math.ceil(geom.containerRect.h) + 20,
  };
  const shotPath = path.join(evidenceDir, `portal-${theme}.png`);
  await page.screenshot({ path: shotPath, clip });
  const buf = (await import('node:fs')).readFileSync(shotPath);
  const img = decodePNG(buf);

  const toLocal = (p) => ({ x: p.x - clip.x, y: p.y - clip.y });
  const groundLocal = toLocal(geom.groundPoint);
  const faceLocal = toLocal(geom.facePoint);
  const bgLocal = toLocal(geom.bgPoint);

  const groundPx = pixelAt(img, groundLocal.x, groundLocal.y);
  const facePx = pixelAt(img, faceLocal.x, faceLocal.y);
  const bgPx = pixelAt(img, bgLocal.x, bgLocal.y);

  await page.close();
  return {
    theme,
    ground: { hex: hex(groundPx), rgb: groundPx },
    face: { hex: hex(facePx), rgb: facePx },
    bg: { hex: hex(bgPx), rgb: bgPx },
    contrastGroundVsBg: r2(ratio(groundPx, bgPx)),
    contrastFaceVsBg: r2(ratio(facePx, bgPx)),
  };
}

const day = await measureTheme('light');
const night = await measureTheme('dark');

await browser.close();
await previewServer.httpServer.close();

const report = {
  sha: process.env.CRI106_SHA ?? 'unknown',
  day,
  night,
  verdicto: {
    portal_es_decorativo: true,
    razon: '`StructuralPortalHero.tsx` marca el SVG `role="presentation" aria-hidden="true"`; comentario propio del componente: "Decorativo a efectos de accesibilidad. Todo lo que comunica está en el texto que la acompaña." WCAG 1.4.11 excluye explícitamente gráficos puramente decorativos del suelo de contraste no-textual.',
    piso_aplicable: 'ninguno (decorativo) — se reporta la medición igualmente por transparencia',
    ground_noche_bajo_3_1: night.contrastGroundVsBg < 3,
  },
};
writeFileSync(path.join(evidenceDir, 'ledger-05-result.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
