import { chromium } from 'playwright';
import { preview } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previewServer = await preview({ root, preview: { host: '127.0.0.1', port: 4177, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch(process.env.QA_LOCAL_CHROMIUM_PATH
  ? { headless: true, executablePath: process.env.QA_LOCAL_CHROMIUM_PATH }
  : { headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
const page = await browser.newPage({ viewport: { width: 1536, height: 960 }, deviceScaleFactor: 1 });
const checkedWidths = [1024, 1100, 1180, 1280, 1366, 1440, 1536, 1920];
const continuousWidths = Array.from({ length: 37 }, (_, index) => 1024 + index * 16);
const breakpointBoundaryWidths = [1023, 1024, 1025, 1279, 1280, 1281, 1439, 1440, 1441, 1499, 1500, 1501, 1535, 1536, 1537];
const geometryWidths = [...new Set([...continuousWidths, ...checkedWidths, ...breakpointBoundaryWidths])].sort((first, second) => first - second);

// Compact es el suelo protegido (D-14 / CRI-95): Estado y Doctor no pueden
// desaparecer ni degradarse por falta de sitio en ningún ancho de esta lista,
// incluido el peor caso de landscape móvil. El suelo es 360px (el más
// pequeño con soporte real hoy: Galaxy S8/S9, iPhone SE 2/3 a 375px) — no
// 320px, cuyo presupuesto ya no cierra una vez que cada control toca su
// mínimo táctil de 44px (WCAG 2.5.5/2.5.8); forzar 320px significaría
// romper ESE suelo de accesibilidad para cumplir este, un peor cambio.
const compactWidths = [360, 390, 414, 460, 500, 600, 660, 700, 740, 800, 900, 1000, 1023];
// El peor caso declarado por el issue: landscape móvil, altura reducida.
const landscapeSizes = [
  { width: 740, height: 360 },
  { width: 812, height: 375 },
  { width: 844, height: 390 },
  { width: 1023, height: 420 },
];
const portraitSizes = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
];
// El nombre de proyecto más largo posible en ES (issue: "el piso debe medirse
// con el copy real en los dos idiomas, no con lorem").
const LONG_PROJECT_NAME_ES = 'Pórtico de concreto reforzado de tres crujías y cuatro niveles con muros de cortante perimetrales y cimentación combinada';
const LONG_PROJECT_NAME_EN = 'Reinforced concrete three-bay four-story frame with perimeter shear walls and a combined mat foundation';

const intersects = (first, second) => first.left < second.right && second.left < first.right && first.top < second.bottom && second.top < first.bottom;

async function enterWorkspace() {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('http://127.0.0.1:4177/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /continuar proyecto/i }).click();
  await page.locator('.app-shell').waitFor({ state: 'visible' });
}

async function readTopBarGeometry() {
  return page.locator('.topbar').evaluate((bar) => {
    const rect = (element) => {
      const { left, right, top, bottom } = element.getBoundingClientRect();
      return { left, right, top, bottom };
    };
    const zones = [...bar.querySelectorAll('[data-topbar-zone]')].map((zone) => ({ name: zone.getAttribute('data-topbar-zone'), rect: rect(zone) }));
    const controls = [...bar.querySelectorAll('button, input, select')]
      .filter((control) => {
        const style = getComputedStyle(control);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((control) => ({ zone: control.closest('[data-topbar-zone]')?.getAttribute('data-topbar-zone'), rect: rect(control) }));
    const accessibleName = (element) => (element?.getAttribute('aria-label') || element?.textContent || '').trim();
    const doctor = bar.querySelector('.model-doctor-launcher');
    const doctorStyle = doctor ? getComputedStyle(doctor) : null;
    const statusShell = bar.querySelector('.analysis-status-shell');
    const statusStyle = statusShell ? getComputedStyle(statusShell) : null;
    return {
      zones,
      controls,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      doctorVisible: Boolean(doctor) && doctorStyle?.display !== 'none' && doctorStyle?.visibility !== 'hidden',
      doctorAccessibleName: accessibleName(doctor),
      statusVisible: Boolean(statusShell) && statusStyle?.display !== 'none' && statusStyle?.visibility !== 'hidden',
      statusAccessibleName: accessibleName(statusShell?.querySelector('[role="status"], button, div[aria-label]')),
    };
  });
}

function assertNeverDegrades(result, width, label) {
  if (!result.doctorVisible) throw new Error(`Model Doctor disappeared at ${width}px (${label})`);
  if (!result.doctorAccessibleName) throw new Error(`Model Doctor lost its accessible name at ${width}px (${label})`);
  if (!result.statusVisible) throw new Error(`Estado (AnalysisStatus) disappeared at ${width}px (${label})`);
  if (!result.statusAccessibleName) throw new Error(`Estado (AnalysisStatus) lost its accessible name at ${width}px (${label})`);
}

function assertNoOverflow(result, width, label) {
  if (result.scrollWidth > result.clientWidth + 1) throw new Error(`TopBar causes horizontal overflow at ${width}px (${label})`);
}

async function assertTopBarGeometry(width, height = 960) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(32);
  const result = await readTopBarGeometry();
  const pairs = [['document', 'actions'], ['document', 'status'], ['actions', 'status']];
  for (const [firstName, secondName] of pairs) {
    const first = result.zones.find((zone) => zone.name === firstName);
    const second = result.zones.find((zone) => zone.name === secondName);
    if (!first || !second || intersects(first.rect, second.rect)) throw new Error(`TopBar zones overlap at ${width}px: ${firstName}/${secondName}`);
    for (const firstControl of result.controls.filter((control) => control.zone === firstName)) {
      for (const secondControl of result.controls.filter((control) => control.zone === secondName)) {
        if (intersects(firstControl.rect, secondControl.rect)) throw new Error(`TopBar controls overlap at ${width}px: ${firstName}/${secondName}`);
      }
    }
  }
  assertNoOverflow(result, width, `${width}x${height}`);
  return result;
}

async function renameProjectTo(name) {
  const input = page.getByRole('textbox', { name: /nombre del proyecto|project name/i });
  await input.fill(name);
  await input.blur();
  await page.waitForTimeout(16);
}

try {
  await enterWorkspace();
  for (const width of geometryWidths) await assertTopBarGeometry(width);

  // Suelo Compact (K0), ancho por ancho, con Estado y Doctor siempre vivos —
  // esto es lo que protege el criterio de aceptación #2.
  for (const width of compactWidths) {
    const result = await assertTopBarGeometry(width, 900);
    assertNeverDegrades(result, width, 'compact sweep, default name');
  }

  // El nombre de proyecto más largo posible, ES y EN, en el peor caso
  // declarado por el issue: Compact landscape móvil.
  for (const [language, longName] of [['es', LONG_PROJECT_NAME_ES], ['en', LONG_PROJECT_NAME_EN]]) {
    await page.setViewportSize({ width: 1200, height: 900 });
    if (language === 'en') {
      await page.getByRole('button', { name: 'Más acciones' }).click();
      await page.getByLabel('Idioma').selectOption('en');
      await page.keyboard.press('Escape');
    }
    await renameProjectTo(longName);

    for (const size of portraitSizes) {
      const result = await assertTopBarGeometry(size.width, size.height);
      assertNeverDegrades(result, size.width, `${language} portrait, long name`);
    }
    for (const size of landscapeSizes) {
      const result = await assertTopBarGeometry(size.width, size.height);
      assertNeverDegrades(result, size.width, `${language} landscape, long name`);
    }

    // El nombre truncado visualmente conserva su valor completo accesible.
    const projectNameValue = await page.getByRole('textbox', { name: /nombre del proyecto|project name/i }).inputValue();
    if (projectNameValue !== longName) throw new Error(`Project name lost its full accessible value in ${language} (got "${projectNameValue}")`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(32);
  if (!(await page.getByLabel('More actions').isVisible())) throw new Error('Mobile More actions is no longer reachable');

  console.log(`TopBar browser geometry passed: ${checkedWidths.join(', ')}px; breakpoints ${breakpointBoundaryWidths.join(', ')}px; continuous 1024-1600px; compact floor ${compactWidths.join(', ')}px; long ES/EN project name in portrait+landscape with Estado/Doctor always visible.`);
} finally {
  await browser.close();
  await previewServer.close();
}
