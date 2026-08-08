# CI preparado localmente — structureCo 0.8.1

**Estado: preparado y validado localmente. No conectado a GitHub. Ningún workflow se ha
ejecutado de forma remota.**

## Qué existe

| Archivo | Propósito | Disparador |
|---|---|---|
| `.github/workflows/ci.yml` | Gate rápido | `push` a `main`, todo `pull_request` |
| `.github/workflows/release-qa.yml` | Gate completo | manual (`workflow_dispatch`) únicamente |
| `.nvmrc` | Node canónico (24) para ambos workflows | — |
| `scripts/validate-ci.mjs` | Validación local de los workflows, sin tocar GitHub | — |

## Por qué el gate completo es manual y no automático

Instala navegadores Playwright (Chromium + WebKit) y tarda considerablemente más que el gate
rápido. Disparar eso en cada `push`/`pull_request` sería caro y lento para iteración diaria.
Queda como `workflow_dispatch`: **cualquier ejecución requiere que alguien la inicie a
propósito**, nunca ocurre por accidente al hacer push.

## Prohibiciones de §28, verificadas

Ninguno de los dos workflows:

- llama a un modelo de IA (Anthropic, OpenAI, Claude, Codex);
- usa FTool gráfico;
- hace deploy;
- crea commits, tags ni publica paquetes;
- usa `git push`.

`scripts/validate-ci.mjs` comprueba esto automáticamente sobre el texto ejecutable de cada
workflow (excluyendo comentarios, para no dispararse con su propia documentación). Se
verificó por mutación: al insertar `npm publish` de prueba en un workflow, el validador lo
detectó y falló; al retirarlo, volvió a pasar.

## Validación realizada

### 1. Sintaxis y referencias (`node scripts/validate-ci.mjs`)

```
Validacion de CI local: 2 workflow(s) sin problemas detectables sin conectarse a GitHub.
  - .github\workflows\ci.yml
  - .github\workflows\release-qa.yml
```

Comprueba: ausencia de tabulaciones, claves de nivel superior (`name`, `on`, `permissions`,
`jobs`), que cada `npm run <script>` referenciado exista en `package.json`, que `.nvmrc`
exista, y las prohibiciones de §28.

### 2. Cada paso del gate rápido, ejecutado realmente, en el mismo orden que `ci.yml`

| Paso | Comando | Resultado |
|---|---|---|
| Lint | `npx oxlint` | limpio |
| Tipos | `npm run typecheck` | limpio |
| Frontera protegida | `npm run verify:protected` | 22 archivos verificados |
| Pruebas | `npm test` | 78 archivos, 530 pruebas en verde |
| Build | `npm run build` | correcto |
| Rendimiento | `node scripts/measure-performance.mjs` | reporta composición del bundle |

No es una suposición de que el YAML «debería» funcionar: son los comandos reales, ejecutados
en este equipo, en el mismo orden que el workflow declara.

### 3. El gate completo existente (`qa.mjs`, `qa-webkit.mjs`) — encontrado roto, reparado

Antes de referenciarlos desde `release-qa.yml`, se ejecutaron ambos localmente para
comprobar que un workflow que los invoque tendría sentido.

**`npm run qa` (Chromium) fallaba** con un timeout de 30 s esperando
`getByRole('dialog', { name: 'Resultados del análisis' })` en la prueba móvil. Investigación:

- A ancho de teléfono (`≤700px`, `PHONE_RESULTS_QUERY`), `ResultsPanel` usa
  intencionalmente un panel **no modal** (`mobileResultsModal = isMobile && mobileExpanded &&
  !isPhone`), para que el canvas siga interactivo debajo (`phoneCanvasInteractive`). El cierre
  con Escape en teléfono lo maneja un listener global independiente (`onPhoneEscape`), no un
  `role="dialog"`.
- El script de QA esperaba el rol de diálogo también en teléfono. Es una aserción vieja que
  no siguió el ritmo de esa separación teléfono/tablet, ya deliberada y correcta en el
  producto. Se corrigió el locator para no exigir el rol de diálogo a ese ancho.

**Dos aserciones numéricas más fallaban** después de esa corrección:
`influenceMomentExact` esperaba `«2.0000 m»` y `influenceSingleAxleExact` esperaba
`«20.000 kN·m»`. Ambas eran el resultado directo del cambio de S11: antes, estos valores
pasaban por `.toPrecision(5)` crudo, que rellena con ceros; ahora pasan por
`formatSignificant`, que los recorta según exige §15 («Evita decimales sin utilidad»). Se
confirmó el valor real en la aplicación (`«Máximo 2 m»`, `«Máximo del tren 20 kN·m»`) y se
actualizaron las aserciones para reflejar el comportamiento correcto y ya vigente.

Tras ambas correcciones:

```
npm run qa         → exit 0, 0 comprobaciones en falso, consola y errores de página vacíos
npm run qa:webkit  → exit 0, iPhone 13 e iPad Pro 11, incluido touchTargetsAtLeast44: true
```

`qa:webkit` usa emulación de dispositivo real de Playwright (no sólo redimensionar la
ventana), así que **sí confirma objetivos táctiles de 44px con `pointer: coarse` genuino** —
la comprobación que S17 no pudo hacer con las herramientas de navegador de esta sesión.

## Qué no se ejecutó en este slice

- `qa-phase2.mjs`, `qa-phase3.mjs`, `qa-phase11.mjs`, `qa-phase12.mjs`, `qa-phase13.mjs`,
  `qa-phase14.mjs`: comprobaciones históricas de fases puntuales del rediseño 0.8.0 (hasta
  1085 líneas cada una). No están referenciadas por ningún workflow nuevo. Ejecutarlas y
  auditarlas todas no era proporcional al objetivo de S18; quedan como herramientas
  disponibles pero fuera del gate de 0.8.1.

## Qué falta antes de que esto certifique algo en GitHub

Nada de esto se ha ejecutado de forma remota. Antes de confiar en un resultado verde de
GitHub Actions:

1. Autorización explícita del usuario para conectar con GitHub.
2. Push de estos archivos.
3. Observar una ejecución real de `ci.yml` (automática) y de `release-qa.yml` (disparado a
   mano) en la interfaz de GitHub.

No se declara que «GitHub Actions funciona» — sólo que el contenido de los workflows es
sintácticamente válido, referencia comandos que existen, y que esos comandos, ejecutados
directamente en este equipo, pasan.
