import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const outputDir = path.join(root, 'reports', 'evidence', '2026-08-22-illustration-studio');
fs.mkdirSync(outputDir, { recursive: true });
const useWebkit = process.argv.includes('--webkit');
const engine = useWebkit ? webkit : chromium;
const scenarios = [
  { id: 'desktop-day', viewport: { width: 1440, height: 900 }, theme: 'light', hasTouch: false },
  { id: 'desktop-night', viewport: { width: 1440, height: 900 }, theme: 'dark', hasTouch: false },
  { id: 'mobile-day', viewport: { width: 390, height: 844 }, theme: 'light', hasTouch: true },
  { id: 'mobile-night', viewport: { width: 390, height: 844 }, theme: 'dark', hasTouch: true },
];
const report = { phase: 'illustration-studio-fix-round-1', engine: useWebkit ? 'webkit' : 'chromium', generatedAt: new Date().toISOString(), scenarios: [], exports: [], presetActions: null, failures: [] };
const server = await createServer({ root, server: { host: '127.0.0.1', port: 4211, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await engine.launch({ headless: true, ...(useWebkit ? {} : { channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' }) });
try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: scenario.viewport, colorScheme: scenario.theme, hasTouch: scenario.hasTouch });
    await context.addInitScript(() => localStorage.removeItem('structureCo.structural-asset-presets.v1'));
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.goto(`http://127.0.0.1:4211/__illustration-studio?theme=${scenario.theme}`, { waitUntil: 'networkidle' });
    await page.getByRole('dialog', { name: 'Estudio de ilustraciones' }).waitFor();
    await page.locator('canvas[data-structural-render="three-live"]').waitFor();
    await page.waitForTimeout(250);
    const metrics = await page.evaluate(() => {
      const visible = (element) => { const style = getComputedStyle(element); const rect = element.getBoundingClientRect(); return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0; };
      const smallTargets = [...document.querySelectorAll('.illustration-studio button,.illustration-studio select,.illustration-studio input')].filter(visible).map((element) => { const rect = element.getBoundingClientRect(); return { label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0,40), width: Math.round(rect.width), height: Math.round(rect.height) }; }).filter(({ width, height }) => width < 44 || height < 44);
      const canvas = document.querySelector('canvas[data-structural-render="three-live"]');
      const preview = document.querySelector('[data-testid="studio-preview-shell"]');
      const tabs = document.querySelector('.illustration-studio__tabs');
      const rgb = (value) => {
        const channels = (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        return value.startsWith('color(srgb ') ? channels.map((channel) => channel * 255) : channels;
      };
      const luminance = (value) => { const channels = rgb(value).map((channel) => { const linear = channel / 255; return linear <= .04045 ? linear / 12.92 : ((linear + .055) / 1.055) ** 2.4; }); return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]; };
      const contrast = (foreground, background) => { const a = luminance(foreground); const b = luminance(background); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
      const opaqueBackground = (element) => {
        let current = element;
        while (current) {
          const value = getComputedStyle(current).backgroundColor;
          const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
          if (channels.length < 4 || channels[3] > .01) return value;
          current = current.parentElement;
        }
        return 'rgb(255, 255, 255)';
      };
      const contrastTargets = [...document.querySelectorAll('.illustration-studio button,.illustration-studio select,.illustration-studio input:not([type=range]),.illustration-studio h1,.illustration-studio__header span,.illustration-studio__preset>span')].filter(visible);
      const lowContrastControls = contrastTargets.map((element) => { const style = getComputedStyle(element); const background = opaqueBackground(element); return { label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 60), ratio: contrast(style.color, background), color: style.color, background, selected: element.getAttribute('aria-pressed') ?? element.getAttribute('aria-selected') }; }).filter(({ ratio }) => ratio < 4.5);
      const storageString = localStorage.getItem('structureCo.structural-asset-presets.v1');
      const payload = JSON.parse(storageString || '{"presets":[]}');
      const previewRect = preview?.getBoundingClientRect();
      const canvasRect = canvas?.getBoundingClientRect();
      const tabsRect = tabs?.getBoundingClientRect();
      return { horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth), smallTargets, lowContrastControls, presetStorage: storageString, personalPresets: Array.isArray(payload.presets) ? payload.presets.length : -1, previewAspect: previewRect ? previewRect.width / previewRect.height : 0, canvasAspect: canvasRect ? canvasRect.width / canvasRect.height : 0, previewTabOverlap: previewRect && tabsRect ? Math.max(0, previewRect.bottom - tabsRect.top) : -1, projectionAspect: canvas?.getAttribute('data-projection-aspect'), rootTheme: document.querySelector('.illustration-studio')?.getAttribute('data-studio-theme'), previewTheme: preview?.getAttribute('data-preview-theme'), realWebgl: canvas instanceof HTMLCanvasElement && canvas.dataset.threeReady === 'true', fallback: Boolean(document.querySelector('.illustration-studio__fallback')) };
    });
    const failures = [];
    if (metrics.horizontalOverflow > 1) failures.push(`horizontalOverflow=${metrics.horizontalOverflow}`);
    if (metrics.smallTargets.length) failures.push(`smallTargets=${JSON.stringify(metrics.smallTargets)}`);
    if (metrics.lowContrastControls.length) failures.push(`lowContrastControls=${JSON.stringify(metrics.lowContrastControls)}`);
    if (metrics.personalPresets !== 0 || metrics.presetStorage !== null) failures.push(`scenarioStorageLeak=${JSON.stringify({ count: metrics.personalPresets, raw: metrics.presetStorage })}`);
    if (Math.abs(metrics.previewAspect - 1.5) > .015 || Math.abs(metrics.canvasAspect - 1.5) > .015 || metrics.projectionAspect !== '1.5') failures.push(`previewProjection=${JSON.stringify({ previewAspect: metrics.previewAspect, canvasAspect: metrics.canvasAspect, projectionAspect: metrics.projectionAspect })}`);
    if (metrics.previewTabOverlap > 1) failures.push(`previewTabOverlap=${metrics.previewTabOverlap}`);
    if (metrics.rootTheme !== scenario.theme || metrics.previewTheme !== scenario.theme) failures.push(`theme=${metrics.rootTheme}/${metrics.previewTheme}`);
    if (!metrics.realWebgl || metrics.fallback) failures.push('realThreePreviewUnavailable');
    failures.push(...consoleErrors.map((error) => `console=${error}`));
    await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('.illustration-studio *').forEach((element) => { if (element instanceof HTMLElement) { element.scrollTop = 0; element.scrollLeft = 0; } }); });
    const screenshot = `${scenario.id}${useWebkit ? '-webkit' : ''}.png`;
    await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: false });
    if (scenario.id === 'desktop-day') {
      const exports = await page.evaluate(async () => {
        const module = await import('/src/features/structural-assets/studio/studioScene.ts');
        const presets = await import('/src/features/structural-assets/studio/presetRepository.ts');
        const parameters = presets.createFactoryStudioParameters('portal:two-story');
        const png = [];
        for (const scale of [1, 2, 4]) {
          const url = await module.renderStudioPng(parameters, scale);
          const image = new Image(); image.src = url; await image.decode();
          const probe = document.createElement('canvas'); probe.width = image.width; probe.height = image.height;
          const context = probe.getContext('2d'); context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, image.width, image.height).data;
          let transparent = 0;
          for (let index = 3; index < pixels.length; index += 4) if (pixels[index] === 0) transparent += 1;
          const corners = [[0, 0], [image.width - 1, 0], [0, image.height - 1], [image.width - 1, image.height - 1]].map(([x, y]) => context.getImageData(x, y, 1, 1).data[3]);
          png.push({ scale, width: image.width, height: image.height, corners, transparentRatio: transparent / (image.width * image.height) });
        }
        const svg = module.serializeStudioSvg(parameters);
        const bundle = module.buildStudioScene(parameters);
        const cameraAspect = (bundle.camera.right - bundle.camera.left) / (bundle.camera.top - bundle.camera.bottom);
        module.disposeStudioScene(bundle);
        const svgSafe = !/background(?:-color)?\s*:/i.test(svg) && !/<rect[^>]+(?:fill|style)=/i.test(svg) && !/<(?:filter|linearGradient|radialGradient|image|script|foreignObject)\b/i.test(svg) && !/(?:href|src)=["'](?:https?:|\/\/)/i.test(svg);
        const svgComposition = /data-studio-composition="3:2"/.test(svg) && /data-studio-camera="isometric"/.test(svg) && /data-studio-scales="1,1,1"/.test(svg) && /data-structural-asset-id="portal:two-story"/.test(svg);
        return { png, svgSafe, svgSize: /width="900"/.test(svg) && /height="600"/.test(svg), svgComposition, cameraAspect, normalizedParameters: bundle.parameters };
      });
      report.exports.push(exports);
      for (const item of exports.png) if (item.width !== 900 * item.scale || item.height !== 600 * item.scale || item.corners.some((alpha) => alpha !== 0) || item.transparentRatio < .25 || item.transparentRatio > .99) failures.push(`png${item.scale}x=${JSON.stringify(item)}`);
      if (!exports.svgSafe || !exports.svgSize || !exports.svgComposition || Math.abs(exports.cameraAspect - 1.5) > 1e-10 || exports.normalizedParameters.assetId !== 'portal:two-story') failures.push(`svg=${JSON.stringify(exports)}`);
    }
    report.scenarios.push({ ...scenario, screenshot, metrics, consoleErrors, failures });
    report.failures.push(...failures.map((failure) => `${scenario.id}: ${failure}`));
    await context.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', hasTouch: true });
    await context.addInitScript(() => localStorage.removeItem('structureCo.structural-asset-presets.v1'));
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4211/__illustration-studio?theme=dark', { waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Material' }).tap();
    await page.getByRole('button', { name: 'Acero' }).tap();
    const selector = page.getByLabel('Diseños guardados');
    await selector.waitFor({ state: 'visible' });
    const rename = page.getByRole('textbox', { name: 'Nombre del diseño' });
    await rename.fill('Diseño móvil alfa');
    await rename.press('Enter');
    await page.getByRole('button', { name: 'Duplicar' }).tap();
    const values = await selector.locator('option').evaluateAll((options) => options.slice(1).map((option) => option.value));
    await selector.selectOption(values[0]);
    await page.getByRole('button', { name: 'Restaurar' }).tap();
    await page.getByRole('button', { name: 'Borrar' }).tap();
    await selector.selectOption(values[1]);
    await page.getByRole('button', { name: 'Borrar' }).tap();
    const result = await page.evaluate(() => {
      const payload = JSON.parse(localStorage.getItem('structureCo.structural-asset-presets.v1') || '{"presets":[]}');
      return { count: payload.presets?.length ?? -1, selected: document.querySelector('[aria-label="Diseños guardados"]')?.value ?? null, viewport: [innerWidth, innerHeight] };
    });
    report.presetActions = result;
    if (result.count !== 0 || result.selected !== '' || result.viewport[0] !== 390 || result.viewport[1] !== 844) report.failures.push(`mobilePresetActions=${JSON.stringify(result)}`);
    await context.close();
  }
} finally { await browser.close(); await server.close(); }
fs.writeFileSync(path.join(outputDir, `qa-summary${useWebkit ? '-webkit' : ''}.json`), `${JSON.stringify(report, null, 2)}\n`);
if (report.failures.length) throw new Error(`Illustration Studio QA failed:\n${report.failures.join('\n')}`);
console.log(`Illustration Studio QA PASS · ${report.engine} · ${report.scenarios.length} captures`);
