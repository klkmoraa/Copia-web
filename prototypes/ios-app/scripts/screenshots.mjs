/*
 * Recorre el prototipo en un iPhone emulado y guarda una captura por pantalla.
 * Requiere el servidor de desarrollo en http://localhost:5199 (npm run dev).
 *
 *   node scripts/screenshots.mjs
 */
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from 'playwright'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../screenshots')
const URL = process.env.PROTO_URL ?? 'http://localhost:5199'

mkdirSync(OUT, { recursive: true })

const iphone = devices['iPhone 15 Pro'] ?? devices['iPhone 13 Pro']

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function shot(page, name) {
  await wait(420)
  await page.screenshot({ path: resolve(OUT, `${name}.png`) })
  console.log('·', name)
}

async function tap(page, locator, pause = 520) {
  await locator.click()
  await wait(pause)
}

async function assertMinTouch(page, selector, label) {
  const undersized = await page.locator(selector).evaluateAll((nodes) => nodes
    .map((node) => {
      const rect = node.getBoundingClientRect()
      return { width: Math.round(rect.width), height: Math.round(rect.height) }
    })
    .filter((rect) => rect.width < 44 || rect.height < 44))
  if (undersized.length) {
    throw new Error(`${label} por debajo de 44 pt: ${undersized.map((r) => `${r.width}Ã—${r.height}`).join(', ')}`)
  }
}

async function assertScrollable(page, label) {
  const result = await page.locator('.scroll').last().evaluate((node) => {
    const before = node.scrollTop
    node.scrollTop = node.scrollHeight
    const moved = node.scrollTop > before
    const scrollable = node.scrollHeight > node.clientHeight
    node.scrollTop = before
    return { moved, scrollable }
  })
  if (result.scrollable && !result.moved) throw new Error(`${label} no responde al desplazamiento vertical`)
}

async function assertNoHorizontalOverflow(page, label) {
  const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  if (overflowing) throw new Error(`${label} tiene desbordamiento horizontal`)
}

const browser = await chromium.launch()

/* --- 1 · Splash (se captura en un contexto propio: dura 1,75 s) ----------- */
{
  const ctx = await browser.newContext({ ...iphone })
  const page = await ctx.newPage()
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await wait(500)
  await page.screenshot({ path: resolve(OUT, '01-splash.png') })
  console.log('· 01-splash')
  await ctx.close()
}

/* --- 2 · Recorrido completo ---------------------------------------------- */
const ctx = await browser.newContext({ ...iphone })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Te damos la bienvenida', { timeout: 8000 })
await shot(page, '02-auth')

await tap(page, page.getByRole('button', { name: 'Continuar como demo' }), 2700)
await shot(page, '03-home')
await assertScrollable(page, 'Inicio')

await tap(page, page.getByRole('tab', { name: 'Proyectos' }), 700)
await shot(page, '04-projects')
await assertMinTouch(page, '.navbtn--glass', 'Acciones de navegaciÃ³n')
await assertMinTouch(page, '.filter', 'Filtros de proyectos')
await assertMinTouch(page, '.project__more', 'MenÃºs de proyecto')
await assertScrollable(page, 'Lista de proyectos')

await tap(page, page.getByRole('button', { name: /Nuevo/ }), 800)
await shot(page, '05-create-step1')

await tap(page, page.getByRole('button', { name: /^Continuar$/ }), 700)
await shot(page, '06-create-step2')

await tap(page, page.getByRole('button', { name: /Crear y abrir/ }), 1100)
await shot(page, '07-workspace-model')

// Inspector: tocar el nudo de cumbrera.
const canvas = page.locator('.ws__canvas')
const box = await canvas.boundingBox()
await page.mouse.click(box.x + box.width * 0.185, box.y + box.height * 0.6)
await wait(700)
await shot(page, '08-workspace-inspector')
await assertMinTouch(page, '.ws__zoom button', 'Controles de zoom')
await assertMinTouch(page, '.sheet__grip', 'Asa de la hoja')
await assertMinTouch(page, '.sheet__close', 'Cierre de la hoja')

// La hoja debe conservar el tope elegido por el gesto; soltar un arrastre no
// puede disparar además el ciclo de "tap" del asa.
const grip = page.locator('.sheet__grip')
const sheet = page.locator('.sheet')
const gripBox = await grip.boundingBox()
const sheetBefore = await sheet.boundingBox()
if (!gripBox || !sheetBefore) throw new Error('No se pudo medir la hoja inferior')
await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2)
await page.mouse.down()
await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y - 180, { steps: 12 })
await page.mouse.up()
await wait(700)
const sheetAfter = await sheet.boundingBox()
if (!sheetAfter || sheetAfter.y >= sheetBefore.y - 80) {
  throw new Error('El arrastre de la hoja no conservó su tope expandido')
}

// Cerrar el inspector y analizar.
const close = page.getByRole('button', { name: 'Cerrar panel' })
if (await close.count()) await tap(page, close.first(), 400)
await tap(page, page.getByRole('button', { name: /Analizar/ }), 2000)
await shot(page, '09-workspace-results')

// Hoja de resultados a tope expandido.
await tap(page, page.getByRole('button', { name: 'Ajustar tamaño del panel' }), 700)
await shot(page, '10-results-expanded')

await tap(page, page.getByRole('button', { name: /Ver tablas completas/ }), 800)
await shot(page, '11-results-tables')
await assertScrollable(page, 'Tablas de resultados')

await tap(page, page.getByRole('button', { name: /Volver al proyecto/ }), 700)
await tap(page, page.getByRole('button', { name: 'Cerrar proyecto' }), 900)

await tap(page, page.getByRole('tab', { name: 'Cuenta' }), 700)
await shot(page, '12-account')
await assertMinTouch(page, '.segmented__item', 'Controles segmentados')
await assertScrollable(page, 'Ajustes de cuenta')

// Tema oscuro.
await tap(page, page.getByRole('tab', { name: 'Oscuro' }), 700)
await shot(page, '13-account-dark')

await tap(page, page.getByRole('tab', { name: 'Inicio' }), 700)
await shot(page, '14-home-dark')

// Workspace en oscuro + landscape.
await tap(page, page.locator('.hero').first(), 600)
await tap(page, page.getByRole('button', { name: 'Cancelar' }).first(), 500).catch(() => {})
await page.getByRole('tab', { name: 'Proyectos' }).click().catch(() => {})
await wait(500)
await page.locator('button[aria-label^="Abrir"]').first().click()
await wait(900)
await shot(page, '15-workspace-dark')

await page.setViewportSize({ width: 852, height: 393 })
await wait(700)
await shot(page, '16-workspace-landscape')
await assertMinTouch(page, '.dock__item', 'Herramientas en landscape')
await assertNoHorizontalOverflow(page, 'Workspace en landscape')

await page.getByRole('button', { name: 'Cerrar proyecto' }).click()
await wait(700)
await tap(page, page.getByRole('tab', { name: 'Inicio' }), 700)
await shot(page, '17-home-landscape')

await ctx.close()
await browser.close()

if (errors.length) {
  console.error('\nErrores de consola:')
  for (const e of errors) console.error(' -', e)
  process.exitCode = 1
} else {
  console.log('\nSin errores de consola.')
}
