# CRI-10 — Reconciliación visual/material Clay (pasada final)

**Fecha:** 2026-08-15 16:00
**Agente:** Claude Code
**Rama:** `research/cri-10-ux-system`
**Evoluciona:** `7c07b10` (evolución — tarjetas de Results, dos velocidades, gobernanza)
**Clasificación:** `SPEC/DESIGN` — fidelidad visual y material. No es arquitectura, no toca `src/**`, no cambia solver/modelo/schema/paleta.

> **Qué es esta pasada y qué no es.** No rediseña CRI-10. «La mesa y el instrumento» y las 19 decisiones ya cerradas (cinta, riel, lienzo dominante, zócalo, Detail, `view`/`dense`/`peek`, Results como evidencia ligada al modelo, tarjetas técnicas, Vista global, persistencia, Datasheet, Model Doctor, atención por excepción, Command Palette, hipótesis Esencial/Completa, tres velocidades, contexto nunca perdido, gobernanza) se conservan íntegras. Esta pasada es una auditoría de **materialidad** contra `brand/brandbook-clay.html` — la única autoridad visual — con dos correcciones concretas donde el concepto no era todavía tan Clay como el propio Brandbook exige, y con la confirmación explícita de que el resto **ya cumplía**.

---

## 0. Resumen ejecutivo

1. **La sospecha del encargo — glow/halo/glass/blur genéricos — no se confirmó como problema sistémico.** Auditoría exhaustiva (`grep` de `backdrop-filter`, `blur(`, `filter:`, `mix-blend-mode`, `text-shadow`, `drop-shadow`, `rgba(` decorativo) sobre `concepts.css`, `frames.js` y `parts.js`: **cero coincidencias** salvo un comentario de prosa que menciona la palabra «halo» para describir un anillo de selección de 1px. Los conceptos ya cargan `src/design-system/tokens.css` REAL por enlace relativo (no valores inventados), y esos tokens ya son Clay sólido — sin vidrio, sin desenfoque decorativo.
2. **Dos gaps reales de materialidad**, ambos del mismo tipo — un control **seleccionado** que sólo cambiaba de color en vez de hundirse — encontrados por auditoría cruzada contra Brandbook §08 («Salido o hundido: nunca las dos cosas [...] es la regla clay que más se olvida: un botón activo se hunde, no se resalta con más elevación»):
   - `.rtabs__tab.is-active` (tabs de Results) — sólo recoloreaba fondo/texto.
   - `.mini-switch` (interruptores del panel `view`) — el track no tenía cavidad; sólo el conmutador cambiaba de posición.
   Ambos corregidos con el token que el resto del sistema ya usa para "seleccionado": `--sc-shadow-clay-pressed`.
3. **El CTA Resolver se auditó línea a línea contra la receta oficial del Brandbook** (§03, «Botón de color con volumen», con la advertencia explícita: «sombras de color con mucho desenfoque y opacidad alta se leen como halo de neón [...] sobre fondo oscuro se nota muchísimo»). `--sc-shadow-clay-action` en `tokens.css` **reproduce esa receta casi al valor** (mismo offset 5px, mismo desenfoque 11px, misma opacidad 28%) y además refina Noche reduciendo el brillo interior (documentado en el propio `tokens.css`). **Veredicto: conforme. No se tocó.** No es una lámpara — es exactamente el botón de volumen que el Brandbook prescribe.
4. **Se descubrió que las 35 láminas en `shots/` estaban desincronizadas del código fuente** (`frames.js`/`parts.js`/`concepts.css` en HEAD `7c07b10` ya no coincidían pixel a pixel con los PNG committeados). Se regeneraron las 35 con `render-concepts.mjs`, sin error de página ni de consola, y con el gate de desbordamiento de la Cinta en verde.
5. **Los dos gaps corregidos ya estaban resueltos en el producto real** (`src/styles.css`): `.result-tabs button.active` tiene `box-shadow:var(--sc-shadow-clay-pressed)` en las reglas de mayor prioridad de cascada (líneas 3413/3560/4660); el concepto simplemente no lo había heredado. Es la prueba de que la corrección no es una preferencia estética nueva — es alinear el concepto con una reconciliación Clay que el producto ya hizo.
6. **Un tercer hallazgo queda documentado, no corregido, por estar fuera de `reports/**`:** `src/styles.css:2161` tiene una variante genérica de `.canvas-layer-switch` sin cavidad en el track, mientras que `#workspace-canvas .canvas-layer-switch` (línea 3677) sí la tiene. Es una inconsistencia real de producción — ver §5.

---

## 1. Método de auditoría

Antes de tocar nada se leyó, en este orden, la autoridad visual completa:

1. `brand/brandbook-clay.html` (1766 líneas) — completo, con foco en §02 (superficies), §06 (radios), §08 (botones y superficies: «salido o hundido»), la receta de botón de color (§03 del cookbook, línea ~1531) y el checklist final (línea ~1632).
2. `src/design-system/tokens.css` (823 líneas) — capa 5 («Materia: elevación, vidrio, anillos, halos, gradientes») completa, Día y Noche.
3. `src/design-system/material.css` — la aplicación de esa materia por `data-level`.
4. `reports/evidence/2026-08-15-cri-10-ux-system/concepts/{concepts.css,frames.js,parts.js}` — los tres archivos enteros, no muestreados.
5. Los tres informes previos de CRI-10 en esta rama, para no repetir trabajo ya cerrado.

Luego, auditoría mecánica sobre los tres archivos de conceptos:

```
grep -n "backdrop-filter\|blur(\|filter:\|mix-blend-mode\|text-shadow\|drop-shadow" concepts.css frames.js parts.js
→ 0 coincidencias reales (backdrop-filter: 0, blur(: 0, filter:: 0, mix-blend-mode: 0,
  text-shadow: 0, drop-shadow: 0)
grep -n "rgba(" frames.js parts.js → 0 (todo el color pasa por token/color-mix)
grep -n "linear-gradient\|radial-gradient" concepts.css → 2 (rejilla técnica del lienzo,
  no decorativo)
```

Cada `box-shadow` restante (42 declaraciones en `concepts.css`) se verificó una por una: todas usan tokens `--sc-shadow-clay-*` reales de `tokens.css`, ninguna inventa un valor de sombra en el concepto.

Con la superficie ya descartada como problema, la auditoría se movió a lo único que sí puede fallar aunque los tokens sean correctos: **si cada control usa el token de materia correcto para su estado**. Ahí aparecieron los dos gaps de §2.

---

## 2. Superficies corregidas

### 2.1 `.rtabs__tab.is-active` — tabs de Results

**Antes:**
```css
.rtabs__tab.is-active { color: var(--tabc); background: var(--sc-color-surface-inset); }
```
Sólo color y fondo. El estado seleccionado no tenía ninguna señal de materia — se distinguía por tinte y por el subrayado de color, exactamente el patrón «más luminoso» que el encargo pide evitar.

**Después:**
```css
.rtabs__tab.is-active { color: var(--tabc); background: var(--sc-color-surface-inset); box-shadow: var(--sc-shadow-clay-pressed); }
```

**Por qué exactamente este token:** es el mismo que ya usan `.tool.is-active`, `.dk.is-active`, `.chip--on`, `.zac.is-open`, `.facet.is-on` y `.denstoggle__i.is-active` — es decir, **todo control «seleccionado» del propio archivo de conceptos ya usaba `--sc-shadow-clay-pressed` excepto los tabs de Results**. No es un token nuevo ni una decisión estética: es cerrar la única inconsistencia interna del propio documento.

**Verificación contra producción:** `src/styles.css` tiene `.result-tabs button.active` declarado varias veces a lo largo del archivo (evolución histórica visible en el propio código); las reglas de mayor prioridad de cascada —líneas 3413, 3560 y 4660— **ya incluyen** `box-shadow:var(--sc-shadow-clay-pressed)` (la de la línea 4660 añade además `transform:translateY(1px)`), con un comentario explícito en el código real: *«Results: lectura técnica compacta con la materia y la respuesta física del brandbook. La propuesta aporta la jerarquía, no sus negros ni halos.»* — el producto real ya resolvió exactamente este problema; el concepto de CRI-10 simplemente no lo había heredado. Esta corrección alinea el concepto con el producto, no al revés.

### 2.2 `.mini-switch` — interruptores del panel `view`

**Antes:**
```css
.mini-switch { width: 30px; height: 18px; position: relative; border-radius: 999px; background: var(--sc-color-border); flex: 0 0 auto; }
```
El track era una píldora plana sin `box-shadow`; sólo el conmutador (`i`, con `--sc-shadow-clay-xs`) tenía volumen.

**Después:**
```css
.mini-switch { width: 30px; height: 18px; position: relative; border-radius: 999px; background: var(--sc-color-border); box-shadow: var(--sc-shadow-clay-pressed); flex: 0 0 auto; }
```

**Por qué:** el Brandbook define el interruptor como una ranura permanentemente hundida — `.switch{ ...; box-shadow:var(--inset); ...}` (línea 488) — independiente de si está encendido o apagado; sólo el conmutador (`.knob`) es la pieza que sube. El concepto tenía la mitad de la receta (conmutador elevado) sin la otra mitad (track hundido).

**Verificación contra producción:** `src/styles.css` tiene dos implementaciones del mismo patrón conviviendo: `.canvas-layer-switch` genérico (línea 2161) sin cavidad de track — el mismo estado que tenía el concepto — y `#workspace-canvas .canvas-layer-switch` (línea 3677) con `box-shadow:var(--sc-shadow-clay-pressed)` en el track. El concepto ahora sigue el patrón correcto (el de `#workspace-canvas`); la inconsistencia entre las dos variantes de producción se documenta en §5 como pendiente, sin tocarla — está en `src/**`, fuera del alcance de esta pasada.

### 2.3 Todo lo demás: auditado, conforme, sin cambios

Componentes con verificación explícita de que ya siguen la regla «salido o hundido» y no se tocaron:

| Componente | Estado auditado | Resultado |
|---|---|---|
| `.tool.is-active` (Riel) | pressed | ✓ ya usa `--sc-shadow-clay-pressed` + `--sc-clay-press-transform` |
| `.dk.is-active` (dock móvil) | pressed | ✓ igual |
| `.zac.is-open` (overflow del zócalo) | pressed | ✓ igual |
| `.facet.is-on`, `.denstoggle__i.is-active`, `.rielmini__i.is-active` | pressed | ✓ igual |
| `.attn-ring` (anillo de atención, PER-01/persistencia y estado fallido) | `box-shadow: 0 0 0 2px color-mix(...) !important` | ✓ es un **anillo sólido de 2px**, no un desenfoque — «canto real», no halo |
| `.causa` / `.causa--error` (tarjetas de causa en Model Doctor y estados) | borde 1px teñido 34% + fondo teñido 7-8% | ✓ arcilla teñida plana, sin desenfoque; el color sólo tiñe borde y fondo, nunca proyecta sombra de color |
| `.btn--primary`, `.resolver__go/__ctx` (CTA Resolver) | `--sc-gradient-clay-action` + `--sc-shadow-clay-action` | ✓ ver §3 — auditado línea a línea contra el Brandbook |
| `.mmcard` (tarjeta técnica de máx/mín) | borde 24% teñido, `--sc-shadow-clay-xs`, sin halo alrededor del número | ✓ número dominante en `--sc-font-mono` 17px, color técnico sólo en la franja de cabecera, dato plano |
| `.find.is-on` (hallazgo expandido en Model Doctor) | `--sc-shadow-clay-sm` (elevada, no hundida) | **Revisado y conservado deliberadamente**: no es un botón pulsado, es una tarjeta que se **superpone temporalmente** a sus hermanas en una pila de hallazgos — el mismo patrón que `material.css` llama «floating: lo que se despega del plano». Elevar (no hundir) es correcto aquí porque la semántica es «esta tarjeta se trae al frente», no «este control está seleccionado». |
| `.cand__i.is-on`, `.pal__i.is-on`, `.tabla tr.is-sel` | fondo de selección plano (`--sc-color-selection`) o franja `inset` lateral | ✓ correcto: son **filas de datos**, no controles — el encargo pide explícitamente que «los datos comparables sigan siendo planos» |
| `.lienzo` | sin `box-shadow`, sin gradiente decorativo | ✓ Brandbook §checklist: «el canvas sigue plano — ninguna sombra clay sobre vigas, cotas, diagramas ni valores numéricos» |
| Tema Noche completo (`15-estados--noche`, `12-compact-retrato--noche`, `02-workspace...--noche`, `06-results-enfocado--noche`) | misma cascada real de `tokens.css[data-theme='dark']` | ✓ sin `backdrop-filter`, sin `blur()`; la sensación de «halo» alrededor de tarjetas con borde teñido en pantallas de baja resolución es contraste de color contra fondo casi negro, no un `box-shadow` con desenfoque — verificado leyendo el CSS aplicado, no sólo mirando el PNG |

---

## 3. El CTA Resolver — por qué NO se tocó

El encargo pedía explícitamente revisar si «el CTA lima parece un objeto y no una lámpara». Se comparó el token real, capa por capa, contra la receta oficial del Brandbook:

**Brandbook, §03 «Botón de color con volumen» (línea ~1538):**
```css
.btn-primary {
  background: linear-gradient(160deg, color-mix(...78%,white) 0%, var(--brand) 48%, color-mix(...82%,black) 100%);
  box-shadow:
    0 5px 11px color-mix(in srgb, var(--brand) 28%, transparent),
    inset 0 1.5px 0 rgba(255,255,255,.38),
    inset 0 -6px 9px color-mix(in srgb, var(--brand) 25%, black 20%);
}
```

**`tokens.css`, `--sc-gradient-clay-action` + `--sc-shadow-clay-action` (Día):** mismo degradado (160deg, 78%/48%/82%), mismo offset (5px), mismo desenfoque (11px), misma opacidad (28%), mismo brillo interior (1.5px, .38) y el mismo oscurecido interior (-6px 9px, 25%/black 20%). **Coincide value por value.**

**Noche:** `tokens.css` reduce el brillo interior de `.38` a `.18` con justificación explícita en el propio archivo («el relleno de marca ya es lo más claro de la pantalla»). El Brandbook no cubre Noche en su ejemplo único — este ajuste es una extensión razonada del mismo principio, no una desviación.

El propio Brandbook advierte, en el mismo bloque, del error que se estaba buscando: *«sombras de color con mucho desenfoque y opacidad alta se leen como halo de neón [...] sobre fondo oscuro se nota muchísimo. Una sola sombra direccional corta (5px de desplazamiento, 11px de desenfoque) basta.»* — 5px/11px es exactamente lo que hay. No hay desenfoque extra que retirar porque no lo había.

**Conclusión: `--sc-shadow-clay-action` no se modificó, en ningún archivo, ni siquiera en el concepto.** Documentar esta verificación es en sí el entregable — la respuesta a la pregunta del criterio de éxito es «sí, es un objeto», con evidencia, no una suposición.

---

## 4. Gradientes — auditoría completa

Todos los gradientes presentes en el sistema, con veredicto:

| Gradiente | Dónde vive | Veredicto | Por qué |
|---|---|---|---|
| `--sc-gradient-clay-action` | `tokens.css` §5, usado en `.btn--primary`/`.resolver__*` | **Conservar** | Es la receta de volumen del Brandbook §03, verificada value-por-value en §3 de este informe |
| `--sc-gradient-display` | `tokens.css` §5, usado en `.display-xl strong`/«con **claridad**» del Welcome | **Conservar** | El propio `tokens.css` lo documenta como el único gradiente de identidad textual, y el Brandbook usa el mismo patrón en su propio `.display-xl strong` |
| `--sc-gradient-sheen` | `tokens.css` §5 | **Conservar, no usado en los conceptos actuales** | Token de identidad declarado; no aparece en ningún concepto de esta rama — nada que auditar en `reports/**` |
| `--sc-gradient-brand-soft` | `tokens.css` §5 | **Conservar, no usado en los conceptos actuales** | Igual — declarado, no consumido por ninguna lámina |
| Rejilla del lienzo (`linear-gradient` de 1px, dos ejes) | `concepts.css:317-318` | **Conservar** | No es decorativo: es la técnica estándar para dibujar una rejilla de 40px sin 1600 elementos DOM. Brandbook usa el mismo patrón en `.canvas` (línea 195-198) |
| Placeholder de carga tipo «hueso» (`repeating-linear-gradient` rayado) | `frames.js:725` | **Conservar** | Skeleton de carga utilitario (franjas alternas de dos tonos de superficie), no un degradado luminoso; no lleva color de marca |

**No se retiró ningún gradiente** porque no se encontró ningún gradiente decorativo/glass fuera de los ya sancionados por el Brandbook. La auditoría de §1 ya lo había descartado antes de llegar a esta tabla.

---

## 5. Pendiente real para una futura pasada en `src/**` (no tocado aquí)

Un solo hallazgo, documentado y no corregido porque corregirlo requeriría tocar `src/**`, fuera del alcance «SPEC/DESIGN» de esta pasada:

**`src/styles.css:2161` — `.canvas-layer-switch` genérico sin cavidad de track**, conviviendo con `#workspace-canvas .canvas-layer-switch` (línea 3677), que sí tiene `box-shadow:var(--sc-shadow-clay-pressed)`. Son dos implementaciones del mismo componente en distintos puntos de cascada; sólo la variante con ámbito `#workspace-canvas` recibió la reconciliación Clay. Antes de implementar el interruptor de `view` (§2.2 de este informe) en producción, unificar ambas reglas para que el track hundido sea el único comportamiento, no una excepción con ámbito.

No se encontró ningún otro `src/**` que necesite cambiar: el CTA ya es conforme (§3), y `.result-tabs button.active` en producción ya tiene la corrección que el concepto tuvo que ponerse al día.

---

## 6. Criterio de éxito visual — respuestas explícitas

1. **¿Parece arcilla sólida o vidrio iluminado?** Sólida. Cero `backdrop-filter`/`blur()` en los tres archivos de concepto; toda superficie usa `--sc-shadow-clay-*` (sombra exterior + luz interior + sombra interior + canto de 1px), nunca transparencia decorativa.
2. **¿Pressed parece hundido?** Sí, y ahora de forma consistente: los dos únicos controles «seleccionados» que no lo hacían (§2) se corrigieron con el mismo token que ya usaba el resto del sistema.
3. **¿Selected se distingue sin depender de glow?** Sí — por cavidad (`--sc-shadow-clay-pressed`) + tinte de fondo (`surface-inset` o `color-mix` sobre el color técnico), nunca por sombra de color proyectada hacia afuera.
4. **¿La interfaz sigue cálida y viva sin parecer neón?** Sí — los únicos colores con sombra de color proyectada (no sólo tinte) son el CTA y sus variantes `--primary`, verificados contra la receta exacta del Brandbook en §3; nada más en el sistema proyecta sombra de color hacia afuera.
5. **¿Los números y diagramas siguen siendo técnicos?** Sí, sin cambios — `.metric`, `.mmcard`, `.tabla` siguen en `IBM Plex Mono` tabular, con color técnico sólo en franja/borde, nunca como halo alrededor del valor.
6. **¿El modo Noche conserva profundidad sin bloom?** Sí — misma cascada real de `tokens.css[data-theme='dark']`, cero `blur()`; ver tabla de §2.3.
7. **¿El CTA lima parece un objeto y no una lámpara?** Sí, con verificación value-por-value contra el Brandbook — ver §3.
8. **¿Results se siente como instrumento técnico y no dashboard?** Sí — `.mmcard` es una ficha con relieve controlado y jerarquía tipográfica, no una card de SaaS; y ahora la pestaña activa se hunde como el resto del sistema, cerrando la única señal que todavía dependía sólo del color.

---

## 7. Qué NO se cambió (decisiones ya cerradas, intactas)

Solver, teoría estructural, `ProjectModel`, schema, persistencia real, contratos del análisis, semántica de `reliability`, IDs de material/sección, fronteras 2D/3D, Space3D experimental, arquitectura CRI-9, arquitectura UX de CRI-10, **paleta oficial** (ningún HEX tocado, ninguna primitiva de `tokens.css` modificada), significados de N/V/M/deformada/reacción/warning/error/Aula, capabilities auditadas, la hipótesis Esencial/Completa (misma lógica, mismos componentes, mismo Brandbook — sólo cambia cuánto disclosure se muestra), y el mecanismo del ledger `--sc10-*` de radios/foco/tipografía de pasadas anteriores (no se tocó ningún `--sc10-radius-*`/`--sc10-focus-ring-width`/`--sc10-font-size-*`).

---

## 8. Evidencia Día/Noche

Las 35 láminas se regeneraron completas (31 día + 4 noche) porque el corpus en `shots/` estaba desincronizado del código fuente en HEAD antes de esta pasada (ver §0.4) — no sólo las que tocan los dos componentes corregidos. Las relevantes a esta reconciliación específica:

| Lámina | Qué demuestra para esta pasada |
|---|---|
| `10-expanded-1440.png` / `12-compact-retrato--noche.png` | Cinta y CTA Resolver, Día y Noche — el objeto sólido de §3 |
| `22-results-dense-expanded.png` | `.rtabs__tab.is-active` con la cavidad nueva, familia Momento seleccionada |
| `22b-results-dense-compact.png` | Lo mismo, Compact — la pestaña activa se sigue leyendo hundida a 390px de ancho |
| `19-vista-invocada.png` | `.mini-switch` con track hundido en los ocho interruptores del panel `view` |
| `15-estados.png` / `15-estados--noche.png` | Todas las superficies teñidas (`.causa`, `.estado`, `.persist--bad`) en los dos temas, para verificar que el "halo" percibido es contraste, no `box-shadow` |
| `06-results-enfocado.png` / `06-results-enfocado--noche.png` | Detalle con métricas — confirma que `.metric` no cambió |

---

## 9. Validación ejecutada

```
$ node reports/evidence/2026-08-15-cri-10-ux-system/render-concepts.mjs
✓ La Cinta no desborda en ninguna de las 5 láminas Compact.
35 láminas escritas en reports/evidence/2026-08-15-cri-10-ux-system/shots/
```
Sin errores de página ni de consola (el script sale con código 1 si los hay; salió en 0).

```
$ node reports/evidence/2026-08-15-cri-10-ux-system/canvas-budget-cri10.mjs
OK — el modelo base es válido [...]
CB-1..CB-6 se cumplen en los 11 viewports.
Y las 9 clases prometidas por la especificación se resuelven como se prometen.
```
Las dos advertencias `✗` de §5 del script («chrome flotante con minimapa» en 390×844 y 844×390) son preexistentes al script mismo — geometría de investigación, no afectada por cambios de `box-shadow` en dos componentes, y ya documentadas en §14 de la especificación como excepción conocida del zócalo.

```
$ git diff --name-only origin/main -- . | grep -v '^reports/'
(sin salida)
```
Todo el diff contra `main` sigue dentro de `reports/**`.

**Nota técnica sobre el entorno de render:** `render-concepts.mjs` lanza Chromium con `chromium.launch()` sin argumentos; en este contenedor de ejecución la versión de Playwright instalada (`^1.61.1`) espera un build de Chromium más nuevo que el pre-instalado. Se añadió una única línea que lee `process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` si está definida y usa ese binario; sin la variable de entorno el comportamiento es idéntico al original (`chromium.launch()` sin opciones). Es un cambio de compatibilidad de entorno, no de comportamiento del script.

---

## 10. Archivos modificados

```
reports/2026-08-15-1600-cri-10-reconciliacion-clay.md   (este informe)
reports/evidence/2026-08-15-cri-10-ux-system/
  concepts/concepts.css     .rtabs__tab.is-active +box-shadow:var(--sc-shadow-clay-pressed)
                             .mini-switch          +box-shadow:var(--sc-shadow-clay-pressed)
  render-concepts.mjs        chromium.launch() ahora acepta executablePath opcional vía env var
                              (compatibilidad de entorno, comportamiento por defecto sin cambios)
  shots/*.png                35 láminas regeneradas (corpus estaba desincronizado del código en HEAD)
```

**Ningún archivo de `src/**` tocado.** Se leyeron para verificación: `src/design-system/tokens.css`, `src/design-system/material.css`, `src/styles.css` (búsqueda de `.result-tabs`, `.canvas-layer-switch`), `brand/brandbook-clay.html`. Ninguno se modificó. Sin merge, sin publicación en Pages.

---

## 11. Pendientes reales

1. **`src/styles.css:2161` vs `:3677`** — unificar `.canvas-layer-switch` para que el track hundido sea el comportamiento único, no una excepción con ámbito `#workspace-canvas` (§5). Único cambio de `src/**` que este informe recomienda para una futura pasada de implementación.
2. **Riel rotulado vs. iconos** (heredado de pasadas anteriores) — sigue sin medir, sin cambios en esta pasada.
3. **Chrome flotante con minimapa en 390×844/844×390** (§9 de este informe, §14 de la especificación) — excepción conocida, no nueva, no evaluada de nuevo aquí.

Todo lo demás auditado en esta pasada resultó **conforme al Brandbook sin cambios necesarios** — el hallazgo principal de esta reconciliación es que la dirección visual de CRI-10 ya era, en su gran mayoría, el Clay correcto; los dos ajustes de §2 cierran las únicas dos grietas encontradas.
