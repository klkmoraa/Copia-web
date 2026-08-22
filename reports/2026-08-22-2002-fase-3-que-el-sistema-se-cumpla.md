# Rediseño Apple · fase 3: que el producto cumpla el sistema que ya declaró

**Fecha:** 2026-08-22 20:02
**Agente:** Claude Code
**Rama:** `claude/apple-ios-redesign-3l63ej`

## Qué cambió

Las dos fases anteriores cambiaron la **materia** (`2026-08-22-0715`) y la
**disposición** (`2026-08-22-0934`). Ésta no añade dirección de arte: hace que el
producto **cumpla el sistema que ya tenía escrito**, y corrige diez defectos que
ningún gate podía ver.

Cuatro commits, cada uno con su gate:

1. **Se retira el bisel neumórfico** que sobrevivió entero al rediseño de
   identidad en trece superficies del producto.
2. **Diez defectos de bloqueo**, empezando por una hoja que en teléfono no se
   podía cerrar.
3. **Cuatro escalas declaradas que no se cumplían** —tipografía, iconos, alturas
   de control y apilamiento— más dos colisiones de cascada que sólo Chromium veía.
4. **La app deja de decir «Ctrl»** y `⌘⇧Z` vuelve a rehacer.

## Por qué

El diagnóstico salió de medir el árbol y la evidencia visual de la fase 2, no de
una opinión. El hallazgo de fondo: **`src/styles.css` (5392 líneas) es la hoja que
el rediseño nunca migró.** Las hojas nuevas —`tokens.css`, `material.css`,
`ui.css`, `datasheet.css`, `projectHub.css`, `space3d.css`— tienen **cero**
literales de tipografía por debajo de 12 px. `styles.css` tenía **197**, y
consumía 260 literales `font-size:…px` frente a 90 tokens.

Y un patrón que se repite en casi todo lo de abajo, el mismo que la fase 2
encontró con el acento: **el contrato valía para el token y no para quien lo
consume.** Un gate que sólo abre `material.css` no puede ver un bisel en
`styles.css`; uno que sólo lee `size=` en los `.tsx` no ve el CSS que lo
sobreescribe.

### 1 · El bisel que no se fue

`material.test.ts` comprobaba que `[data-level='inset']` se pintara con un
relleno y no con una sombra interior. Sólo leía `material.css`. Mientras tanto,
trece superficies —`.number-control`, `.select-field select`,
`.segmented-control`, `.inspector-summary`…, es decir **los controles más usados
del producto**— se pintaban con:

```css
box-shadow:
  inset  6px  7px 14px color-mix(in srgb, var(--sc-color-text-primary) 14%, transparent),
  inset -6px -6px 13px color-mix(in srgb, var(--sc-color-surface-elevated) 86%, transparent);
```

Sombra oscura arriba a la izquierda, luz clara abajo a la derecha: una pieza con
su propia fuente de luz. Exactamente la identidad que la fase 1 retiró.

### 2 · Los diez defectos de bloqueo

| # | Defecto |
|---|---|
| A1 | **La hoja del Inspector no se podía cerrar en táctil.** Su único cierre vivía dentro de la barra de pestañas, que se pinta bajo `{!surface ? …}` — y los tres sitios que montan `Inspector` pasan `surface`. Código muerto. `.mobile-inspector-backdrop` llevaba estilo, animación y regla de lienzo completo sin que nadie lo renderizara. Sólo `Escape`, que en un teléfono no existe. |
| A2 | **`Escape` borraba la sesión de edición.** El manejador del lienzo no comprobaba `defaultPrevented`; el de la hoja vive en `document`, que dispara antes. Un `Escape` cerraba la hoja y se llevaba selección, corte, inicio de miembro y borrador de entrada rápida. |
| A3 | **Los extremos del diagrama se pintaban dos veces**, y una copia no evitaba colisiones. Se solapaban entre sí y encima de las cargas. |
| A4 | **Model Doctor reconstruía el informe completo** en cada cambio de identidad del proyecto, incluido cambiar de unidades, de idioma o de capa visible. |
| A5 | **Dos dueños del `inert` del shell.** Con la hoja del riel abierta, el broker capturaba `true` como estado de reposo y lo reponía al cerrar: **el shell entero quedaba inerte sin ningún modal**, muerto al tacto y al teclado hasta recargar. |
| A6 | El lanzador flotante anunciaba `aria-expanded` pero **sólo abría**. |
| A7 | **Dos fuentes de verdad** para el Inspector: abrirlo desde el lienzo dejaba la persistida en «plegado», así que al salir de lienzo completo no volvía. |
| A8 | **La paleta de comandos era el único diálogo sin trampa de foco**, sin bloqueo de scroll y sin `aria-modal` — reimplementaba a mano lo que `useModalFocus` ya hace bien. |
| A9 | El foco al cerrar una superficie iba a **la primera del array**, no a la más reciente. |
| A10 | `role="separator"` sobre un `<button>`, que destruye el rol de botón. |

Más: los temporizadores de los toasts nunca se limpiaban, su región viva nacía
con su contenido —así que probablemente no se anunciaban— y `ResultsPanel` leía
`localStorage` sin guarda **dentro de un inicializador de `useState`**, que
revienta el render en Safari privado.

### 3 · Cuatro escalas y dos cascadas

- **`font-size:7px!important`**, más 8,5 px (×2) y 9,5 px. El sistema dice «no
  baja de 10 px: por debajo no hay tipografía, hay textura».
- **Nueve reglas forzaban iconos a 17, 19, 21, 23, 24 y 30 px**, fuera de la
  escala de seis que la fase 2 estableció — incluida la del riel de herramientas.
- **Seis controles por debajo del suelo de 28 px** (24, 26, 22).
- **44 valores de `z-index` crudos** entre 0 y 1200 contra seis tokens.

Y dos defectos de cascada que **sólo el navegador podía ver**:

- **A 390 px el nombre del proyecto y las flechas de deshacer se dibujaban uno
  encima del otro.** Los dos `display:none` que esconden el historial en compacto
  perdían **por orden de fuente** contra `.topbar-tool-group`, la clase que la
  fase 2 añadió al agrupar los iconos. La columna del documento se quedaba en
  28 px para 134 de contenido.
- **A 1280 px exactos, con resultados en pantalla, «Analizar» se solapaba 69 px
  con «Model Doctor».** Dos umbrales escritos por separado disparaban al mismo
  ancho. La fase 2 lo dio por bueno midiendo `barOverflow:false` — y era cierto:
  la barra no desbordaba, **sus zonas se solapaban por dentro**. La medida no
  medía el defecto.

Además, el comentario de `TopBar.tsx` afirmaba que Model Doctor «colapsa a icono
en CSS por debajo de 1536px». **Ese CSS no existe**: no hay ninguna regla para
`.model-doctor-launcher` en todo el repo.

### 4 · «Ctrl» en un producto que imita a Apple

No había detección de plataforma en ningún sitio de `src`. Convivían tres
convenciones: `'Ctrl Z'`, `'Ctrl/Cmd+C'` —que enseña las dos plataformas a la vez,
lo peor de los dos mundos— y `<kbd>Ctrl K</kbd>` escrito a mano tres veces. Y
**`⌘⇧Z`, el rehacer de macOS, estaba explícitamente rechazado**: la guarda salía
ante cualquier `shiftKey`.

## Archivos tocados

**Materia**
- `src/styles.css` — el bisel de trece superficies pasa a los niveles `inset` y
  `raised` que `material.css` ya define.
- `src/design-system/material.test.ts` — el gate abre los consumidores.

**Defectos de bloqueo**
- `src/features/inspector/Inspector.tsx` — cabecera de hoja con asa y cierre,
  dueño único del cierre; el asa de redimensionado deja de ser un `<button>`.
- `src/features/canvas/StructuralCanvas.tsx` — `Escape` guarda
  `defaultPrevented`; `Delete`/`Backspace` exige foco en el lienzo; el extremo
  entra al solver con sus dos líneas.
- `src/features/canvas/labelLayout.ts` — `secondaryText` y altura por líneas.
- `src/features/canvas/CanvasResultLayer.tsx` — el sello suelto se retira; queda
  el tallo y el punto, que es la marca geométrica que ningún solver puede dar.
- `src/features/workspace/shellInert.ts` — **nuevo**. Un dueño, por conteo.
- `src/features/workspace/WorkspaceShell.tsx` — `openDetail`/`closeDetail`/
  `toggleDetail` definidos una vez; Model Doctor por firma.
- `src/features/workspace/CommandPalette.tsx` — consume `useModalFocus`.
- `src/features/workspace/SurfacePresentationProvider.tsx` — `latest()`.
- `src/features/workspace/ToastNotification.tsx`, `src/features/results/ResultsPanel.tsx`.

**Escalas**
- `src/design-system/tokens.css` — cuatro peldaños de lienzo, `--sc-z-scrim`, `--sc-z-dock`.
- `src/design-system/surfaceGeometry.test.ts` — tres gates nuevos.
- `src/design-system/typography.test.ts` — el suelo de 10 px en los consumidores.
- `src/styles.css`, `phase1.css`, `phase2.css`, `structureGenerator.css`, `pwa.css`.

**Atajos**
- `src/design-system/platformKeys.ts` y `.test.ts` — **nuevos**.
- `src/features/workspace/commandRegistry.ts` — `resolveHistoryAction`, junto a
  `isOwnHistoryScope`: las dos responden a la misma pregunta.
- `ContextualActions.tsx`, `ToolRail.tsx`, `CommandPalette.tsx`,
  `DatasheetPanel.tsx`, `catalogs.ts`.

**Gates de navegador**
- `qa.mjs` — `topBarControlsNeverOverlap`, `topBarZonesFitTheirContent`,
  `topBarNeverOverflows`, `verifyResultTabsDoNotOverlap`, `waitForSurfaceToSettle`.

**Documentación**
- `src/design-system/README.md` — secciones **Apilamiento** y **Atajos**, la
  regla 4 extendida a los consumidores, y la tabla de gates al día.

## Cómo verificar

```bash
npm run verify   # lint · docs · frontera protegida · 2262 pruebas · build · presupuesto
PLAYWRIGHT_CHANNEL="" PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium npm run qa
```

Los dos en verde. **2239 → 2262 pruebas** y **149 → 156 checks**. La frontera
matemática protegida no se tocó: `verify:protected` pasa sin refrescar la línea
base (38 archivos).

Comprobaciones específicas que `verify` no cubre:

1. **Los seis gates nuevos se pusieron rojos a propósito** antes de darlos por
   buenos, reintroduciendo el defecto exacto: el bisel, un `font-size:9px`, un
   `svg{width:17px}`, un `min-height:24px`, un `z-index:31`. Cada uno nombró el
   archivo y la línea. Un gate que no puede fallar no es una red.
2. **Medición de A3 en Chromium real**, a 1280, 1440 y 1600:
   `{"labels":22,"overlappingPairs":0,"freestandingStamps":0}`. Cero solapes a los
   tres anchos.
3. **Medición de la barra superior** a 390, 768 y 1280 con resultados en
   pantalla: 0 solapes, 0 zonas desnutridas, sin desborde. Antes: 69 px de solape
   entre «Analizar» y «Model Doctor» a 1280, y 124 px para 134 de contenido a 390.
4. **A1 comprobado en teléfono real emulado** (390×844):
   `{"hojaAbierta":true,"cierreVisible":true,"asa":true}`.

Evidencia en `reports/evidence/2026-08-22-fase-3-defectos/`, con el mismo encuadre
que las dos fases anteriores para poder compararlas.

## Una corrección al plan de esta misma sesión

El plan aprobado decía «el slot `backdrop` recibe por fin el
`.mobile-inspector-backdrop`, que cierra al tocar fuera». **Se hizo y se
deshizo.** Al renderizarlo, el pan y el pellizco de `npm run qa` se rompieron: el
velo cubría el lienzo. Y tenían razón — la hoja del Inspector en teléfono es **no
modal por contrato**, y así lo afirma `App.test.tsx` («keeps the Compact inspector
sheet coexisting»). Un velo que atenúa y bloquea es de una superficie modal.

Así que el velo se retira entero, con su CSS muerto, y quien cierra la hoja es su
propio control. El defecto A1 —no había forma de cerrar en táctil— queda
resuelto igual; lo que cambia es el medio. Queda escrito porque el plan decía
otra cosa y quien lo lea después merece saber por qué.

## Pendiente / siguiente paso

Del plan de esta fase quedan **tres tandas sin empezar**, todas con su diagnóstico
ya medido:

- **Densidad y silencio.** Cuatro afirmaciones permanentes en la barra («Local»,
  «Model Doctor», «Análisis actualizado», «Fiabilidad Confiable»); **cinco
  regiones `aria-live` simultáneas** en la mesa; el Inspector sin selección apila
  dos tarjetas que dicen lo mismo y deja ~700 px muertos; la esquina inferior
  derecha acumula cuatro piezas —«Repetir · R» sigue solapando la barra
  segmentada, visible en la evidencia nueva—; y truncamientos en reposo
  («Curva exac», «M máx. 36.3484 kN…»).
- **Las cinco superficies que nadie miró.** No hay una sola captura de Aula,
  Centro de importación, Datasheet, Model Doctor ni Space 3D, y su CSS vive en
  las mega-líneas de 10-11 px de `styles.css`. **Primero capturarlas.** Además
  `datasheet.css` y `projectHub.css` no tienen ni un `env(safe-area-inset-*)`, y
  la Datasheet a pantalla completa usa `88vh` en vez de `dvh`.
- **Migrar `styles.css` por secciones.** Siguen 256 literales `font-size:…px`, la
  línea de 3797 caracteres, el encabezado muerto *Green Frame visual system* y el
  comentario que afirma que el acento es verde en Noche — falso desde la fase 1.

Y dos cosas que este entorno no puede cerrar:

- **`npm run qa:webkit` sigue sin ejecutarse.** WebKit no está instalado y su
  descarga falla. Lo arrastran las tres fases.
- **`npm run qa` necesita aquí `PLAYWRIGHT_EXECUTABLE_PATH`.** El script pide el
  canal `chrome`, que no existe en este contenedor; con el Chromium de Playwright
  pasa entero. No se cambió el valor por defecto porque en la máquina del
  propietario el canal sí existe.
