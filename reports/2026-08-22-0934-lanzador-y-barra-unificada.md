# Rediseño Apple · fase 2: de estilo de sistema a *app* de sistema

**Fecha:** 2026-08-22 09:34
**Agente:** Claude Code
**Rama:** `claude/apple-style-redesign-6ebf0r`

## Qué cambió

La fase anterior (`2026-08-22-0715`) cambió la **materia**: paleta acromática, un
solo acento, material en vez de sombra. Ésta cambia la **disposición y la gramática
de interacción**, que es lo que aquel reporte dejaba anotado como pendiente.

- La bienvenida deja de ser un asistente de cuatro pasos y pasa a ser un **lanzador
  de documento**: una ventana acotada y centrada, seis puertas en una sola lista y
  la biblioteca al lado. La vitrina de ejemplos, que era la tercera etapa, es un
  diálogo.
- La barra superior funde sus cuatro `<select>` rotulados en **un ítem de barra
  unificada** que abre un popover con las cuatro decisiones de análisis, agrupa los
  iconos con separadores y recupera las etiquetas de estado.
- El HUD del lienzo deja de pintar en acento y pasa a control segmentado monocromo.
- Se resuelven las dos colisiones de superficies flotantes que se veían en la
  evidencia anterior, y se añade un gate que las vigila.
- El inspector recoge la ayuda de campo en un globo revelado en vez de apilar un
  párrafo bajo cada control.
- La iconografía pasa a monocroma y la escala de tamaños baja de catorce escalones
  a seis.

## Por qué

Petición explícita del usuario: continuar el rediseño hasta que el producto se lea
como una app nativa de Apple, con libertad para reacomodar, borrar y cambiar. Los
seis defectos que se atacan salen de medir la evidencia visual de la fase anterior
(`reports/evidence/2026-08-22-rediseno-identidad-sistema/`), no de una opinión:

| # | Defecto medido |
|---|---|
| 1 | Asistente de 4 pasos en la entrada. Ninguna app del sistema abre con un *stepper*. |
| 2 | Puertas duplicadas: carril de 5 + «Nuevo proyecto» + «Ver otras formas de empezar». Tres caminos al mismo sitio. |
| 3 | ~50 % del viewport vacío bajo el pliegue (390×844: 945 px de contenido en 844 de ventana, y aun así medio escritorio en blanco). |
| 4 | Cuatro `<select>` con etiqueta encima, truncados **a 1280 px**: «Caso o com…», «Modo de cál…», «Orden del a…». |
| 5 | «SNAP activo» / «GRID activo» en azul de acción, que el sistema reserva para lo que acciona. |
| 6 | «Editar selección» tapando el lector de escala; las pestañas Cargas/Vista/Resultados sobre el contenido del inspector. |

Y dos que aparecieron durante el trabajo, ninguno visible desde fuera:

- **`ui.css` no viajaba en el chunk de entrada.** La bienvenida ya montaba `Drawer`
  y ahora monta `Dialog` y `SegmentedControl`, pero su hoja sólo llegaba con
  `WorkspaceShell`, que es diferido: esas superficies se pintaban sin materia hasta
  que ganaba la carrera del precalentamiento.
- **Dos auroras radiales construidas sobre `--accent` y `--brand-secondary`** en el
  fondo de la bienvenida — exactamente lo que el sistema prohíbe («no usa el acento
  como luz»). Sobrevivieron enteras al rediseño de identidad porque el gate del
  acento sólo miraba los *tokens*, no los consumidores.

## Archivos tocados

**Bienvenida → lanzador**
- `src/features/welcome/WelcomeScreen.tsx` — reescrito (611 → 416 líneas). Fuera el
  estado de etapas, el carril de progreso y las puertas repetidas; entra el marco de
  dos columnas, la vitrina como `Dialog` y el idioma como `SegmentedControl`.
- `src/features/welcome/WorkCycleGlyph.tsx` — **borrado**. Sólo lo leía la etapa 2.
- `src/styles.css` — la sección de disposición de la bienvenida se sustituye entera;
  se retiran 29 clases sin consumidor y el `@keyframes` que sólo ellas usaban.
- `src/App.tsx` — `ui.css` entra en el chunk de entrada.
- `src/i18n/catalogs.ts` — 5 claves nuevas, 34 huérfanas retiradas (4 ya lo eran
  antes de este cambio).

**Barra superior → barra unificada**
- `src/features/topbar/TopBar.tsx` — nuevo `AnalysisContextFields`: **una sola**
  definición de las cuatro decisiones, consumida por el popover de escritorio y por
  el menú de desbordamiento móvil, que hasta ahora tenían copias divergentes. Grupos
  de iconos con separador.
- `src/styles.css` — el ítem de contexto y su popover sustituyen a los cuatro campos
  rotulados; se retiran las tres reglas de ocultación por *breakpoint* (ya no hay
  nada que esconder) y la clase `compact-select`, sin consumidores.
- Umbral de las etiquetas de estado: de 1536 px a 1280 px, medido.

**Lienzo, colisiones e inspector**
- `src/features/canvas/CanvasChrome.tsx` — snap y rejilla como segmentos monocromos;
  el rótulo se acorta, el anuncio de `role="status"` no.
- `src/styles.css` — el lector de escala cede ante la barra de selección.
- `src/features/workspace/phase1.css` — el lanzador de superficies se ancla al borde
  del lienzo y se apila sobre los controles de cámara.
- `src/styles.css`, `src/features/inspector/*` — la ayuda de campo se revela en un
  globo; el error y el motivo de bloqueo siguen siempre visibles.
- Cromo unificado del desplegable para los 35 `<select>` del producto.

**Iconografía**
- 33 archivos `.tsx`, 108 sustituciones de tamaño de icono. Catorce tamaños distintos
  entre 12 y 28 px pasan a seis: 14 · 16 · 18 · 20 · 22 · 28.
- Los mosaicos del lanzador pierden su matiz por tipo. **Los iconos del riel de
  herramientas lo conservan**: azul/verde/naranja ahí no son variedad, son la
  codificación técnica del lienzo (§3 de `tokens.css`).

**Gates**
- `src/design-system/tokens.test.ts` — el gate del acento pasa a mirar también los
  consumidores, no sólo los tokens. Es lo que faltaba para que las auroras se vieran.
- `src/features/welcome/welcomeFlow.test.tsx` — las 5 pruebas del asistente describían
  un recorrido que se retira; se sustituyen por las del lanzador, con la que faltaba:
  **una sola superficie por destino**, que es el defecto 2 y que ninguna prueba veía.
  Los 7 casos de `welcomeEntry` y salto directo no se tocan.
- `src/features/topbar/TopBar.test.tsx` — nueva prueba de que el ítem de barra abre
  las cuatro decisiones con sus nombres accesibles intactos.
- `qa.mjs` — cuatro checks nuevos de solape de superficies flotantes y cuatro de la
  ayuda revelada (que sigue en el árbol de accesibilidad); vocabulario de arcilla
  retirado de los nombres que quedaban (`…HasClayBackground`,
  `verifyResultsClayMaterial`); dos sondas que eran carreras —el pulsado se leía a
  los 80 ms de una transición, y el valor de unidades se leía sobre un nodo en plena
  animación de salida— pasan a ser deterministas.
- `scripts/qa-welcome.mjs` — `openWelcomeStep` ya no tiene pasos a los que ir; la
  sustituye `openTemplateGallery`, y con ella sus 6 llamantes.
- `src/design-system/README.md` — sección **Disposición** con las cinco reglas que
  este trabajo establece, y **Iconografía** con la escala.

## Cómo verificar

```bash
npm run verify   # lint · docs · frontera protegida · 2239 pruebas · build · presupuesto
npm run qa       # 149 checks compuestos por Chromium
```

Los dos en verde. La frontera matemática protegida no se tocó: `verify:protected`
pasa sin refrescar la línea base.

Contra la línea base de antes de empezar: **2236 → 2239 pruebas** y **145 → 149
checks**. Los renombrados son 1:1 (`welcomeRail* → welcomeFrame*`,
`…ActiveBoxShadowChanges → …ActiveFillChanges`); los 4 netos son los gates nuevos.

Se comprobó que el gate de solapes **puede fallar**: al reintroducir el defecto del
lanzador, `npm run qa` cae con `surfaceLauncherDoesNotCoverInspector`. Un gate que no
puede ponerse rojo no es una red.

Comprobación manual del defecto 4, en Chromium real y a los tres anchos:

```
1280 {"truncated":[],"barOverflow":false}
1440 {"truncated":[],"barOverflow":false}
1600 {"truncated":[],"barOverflow":false}
```

Capturas en `reports/evidence/2026-08-22-lanzador-y-barra-unificada/`, con el mismo
encuadre que las de la fase anterior para poder compararlas una contra otra.

## Pendiente / siguiente paso

- **`npm run qa:webkit` no se ejecutó.** WebKit no está instalado en este entorno y
  su descarga falla (`Failed to download WebKit 26.5`). Queda por correr en una
  máquina que sí lo tenga: es la única superficie de verificación de esta fase que no
  está cubierta.
- **Los `<select>` siguen siendo markup nativo.** Se les unificó el cromo por CSS en
  vez de migrarlos al componente `Select` del sistema de diseño. Es una decisión
  deliberada: la migración toca 8 archivos y sus pruebas para llegar al mismo píxel,
  porque lo que desentonaba era el cromo del navegador, no el marcado. Si en algún
  momento se necesita del componente algo más que su galón —prefijos, sufijos,
  estado de error— entonces sí compensa migrar.
- **GitHub Pages sigue necesitando las dos acciones del propietario** que anotó el
  reporte anterior: cambiar la fuente de Pages a «GitHub Actions» y llevar
  `pages.yml` a `main`. Nada de esta fase las desbloquea.
