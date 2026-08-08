# S18 — CI preparado localmente

- **Agente:** Claude Code (agente principal)
- **Modelo:** Sonnet 5 (`claude-sonnet-5`)
- **Fecha:** 2 de agosto de 2026
- **Estado de GitHub:** NO UTILIZADO — ningún workflow se ejecutó de forma remota

## Objetivo

Preparar el gate rápido y el gate completo de §28, y no declarar que funcionan sin evidencia
real de que sus pasos, ejecutados directamente, pasan.

## Lo que se creó

| Archivo | Qué es |
|---|---|
| `.github/workflows/ci.yml` | Gate rápido: lint, tipos, frontera protegida, pruebas, build, rendimiento |
| `.github/workflows/release-qa.yml` | Gate completo: lo anterior + Chromium + WebKit, sólo manual |
| `.nvmrc` | Fija Node 24 para ambos workflows |
| `scripts/validate-ci.mjs` | Valida ambos workflows sin tocar GitHub |
| `docs/releases/0.8.1/CI.md` | Qué se preparó, qué se validó, qué falta |

Ninguno de los dos workflows llama a un modelo de IA, usa FTool gráfico, hace deploy, crea
commits/tags o publica paquetes. `scripts/validate-ci.mjs` lo comprueba automáticamente sobre
el texto ejecutable (excluyendo comentarios) y se verificó por mutación: al insertar
`npm publish` de prueba, el validador lo detectó; al retirarlo, volvió a pasar.

## Hallazgo real: el gate completo existente estaba roto

Antes de referenciar `qa.mjs` y `qa-webkit.mjs` desde `release-qa.yml`, los ejecuté
directamente para comprobar que un workflow que los invocara tendría sentido. **`npm run qa`
fallaba.**

### Causa 1 — aserción de accesibilidad obsoleta, no defecto de producto

El script esperaba `role="dialog"` con nombre «Resultados del análisis» en el panel de
resultados a 390px de ancho (tamaño de teléfono). Investigando el código actual:

```ts
const mobileResultsModal = isMobile && mobileExpanded && !isPhone;
```

A ancho de teléfono (`≤700px`), el panel es **deliberadamente no modal**: el canvas sigue
interactivo debajo (`phoneCanvasInteractive`), y Escape lo cierra un listener global propio
(`onPhoneEscape`), no el rol de diálogo. Es un patrón de accesibilidad razonado — un modal
verdadero bloquearía el canvas en una pantalla donde el espacio ya es escaso. El script de QA
simplemente no siguió el ritmo de esa separación teléfono/tablet cuando se introdujo. Se
corrigió el locator de Playwright para no exigir el rol de diálogo a ese ancho, con un
comentario que explica por qué.

### Causa 2 — consecuencia directa y correcta de S11

Dos aserciones numéricas fallaban después: esperaban «2.0000 m» y «20.000 kN·m». Antes de S11
estos valores pasaban por `.toPrecision(5)` crudo, que rellena con ceros; ahora pasan por
`formatSignificant`, que los recorta según exige §15 («Evita decimales sin utilidad»). Verifiqué
el valor real en la aplicación (Máximo «2 m», Máximo del tren «20 kN·m») y actualicé las
aserciones para reflejar el comportamiento correcto — que S11 ya había corregido, sin que
nadie hubiera notado que esta suite quedó desincronizada.

### Resultado tras las dos correcciones

```
npm run qa         → exit 0, 0 comprobaciones en falso
npm run qa:webkit  → exit 0, iPhone 13 e iPad Pro 11, touchTargetsAtLeast44: true
```

`qa:webkit` usa emulación de dispositivo real de Playwright, así que confirma objetivos
táctiles de 44px con `pointer: coarse` genuino — precisamente lo que S17 no pudo verificar con
las herramientas de navegador de esta sesión (que reportan `pointer: fine` sin importar el
tamaño de la ventana).

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `.github/workflows/ci.yml` | **nuevo** |
| `.github/workflows/release-qa.yml` | **nuevo** |
| `.nvmrc` | **nuevo** |
| `scripts/validate-ci.mjs` | **nuevo** |
| `docs/releases/0.8.1/CI.md` | **nuevo** |
| `package.json` | script `validate:ci` |
| `qa.mjs` | 3 aserciones obsoletas corregidas (1 de accesibilidad, 2 numéricas) |

## Archivos protegidos comprobados

`node scripts/check-protected-baseline.mjs` → «Frontera protegida intacta: 22 archivos verificados.»
Los cambios de este slice son tooling de QA y CI, no motor.

## Pruebas ejecutadas

Cada paso del gate rápido, ejecutado realmente en el mismo orden que declara `ci.yml`:

| Paso | Comando | Resultado |
|---|---|---|
| Lint | `npx oxlint` | limpio |
| Tipos | `npm run typecheck` | limpio |
| Frontera protegida | `npm run verify:protected` | 22 archivos |
| Pruebas | `npm test` | **78 archivos, 530 pruebas en verde** |
| Build | `npm run build` | correcto |
| Rendimiento | `node scripts/measure-performance.mjs` | reporta bundle |
| Validación de CI | `node scripts/validate-ci.mjs` | 2 workflows sin problemas |
| Gate completo Chromium | `npm run qa` | **exit 0, 0 fallos** (tras corrección) |
| Gate completo WebKit | `npm run qa:webkit` | **exit 0, 0 fallos** |

No hay cambios en la suite de Vitest en este slice (530 pruebas se mantienen; las correcciones
fueron en `qa.mjs`, que usa su propio runner Playwright, no Vitest).

## Riesgos

- Ninguno nuevo hacia el producto: los cambios de este slice son tooling de CI/QA. El cambio
  en `qa.mjs` corrige aserciones para que coincidan con comportamiento ya correcto y en
  producción; no cambia ningún comportamiento de la aplicación.

## Limitaciones

- `qa-phase2.mjs` … `qa-phase14.mjs` (seis scripts históricos, hasta 1085 líneas) no se
  ejecutaron ni se auditaron. No están referenciados por los workflows nuevos. Auditarlos
  todos no era proporcional al objetivo de S18.
- Nada de esto se ejecutó de forma remota. No se declara que GitHub Actions «funcione» —
  sólo que la sintaxis es válida, las referencias existen, y los comandos que los workflows
  invocan, ejecutados directamente, pasan.

## Siguiente paso

S19 — Documentación.

## Commit local

`ci: prepare local verification workflows`
