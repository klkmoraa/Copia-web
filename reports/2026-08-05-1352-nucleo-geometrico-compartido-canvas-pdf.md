# Núcleo geométrico compartido entre el canvas web y el renderizador PDF

**Fecha:** 2026-08-05 13:52
**Agente:** Claude Code
**Rama:** main

## Qué cambió

La geometría en espacio-modelo que el canvas (React/SVG) y la memoria de cálculo (`pdf-lib`)
calculaban cada uno por su lado vive ahora en un único módulo puro,
`src/graphics/structureGeometry.ts`, y ambos renderizadores la consumen.

Estaba escrita a mano en ~20 sitios con distinta ortografía: eje del miembro y cosenos
directores, normal unitaria, conversión entre la estación del tramo flexible y la posición
sobre el miembro completo (brazos rígidos), proyección de un puntero sobre el miembro,
rotación de ejes locales a globales, intensidad interpolada de una carga distribuida y la caja
envolvente del modelo.

**Ni un píxel cambió en ninguno de los dos renderizadores** — ver «Cómo verificar».

## Por qué

Quedó documentado como deuda abierta al cerrar AG-003
(`reports/2026-08-05-1326-ag003-refactor-modulo-pdf.md`): la propuesta señalaba «duplicación de
lógica de trazado vectorial entre el Canvas web y el renderizador PDF», pero unificarla era una
decisión de arquitectura mayor y no un efecto colateral del refactor del PDF. El usuario pidió
ejecutarla explícitamente.

Efecto secundario que valía por sí solo: `grossRatioFromFlexible` y `flexibleRatioFromGross`
vivían **dentro de un componente React** (`CanvasGeometryLayer.tsx`), exportadas con dos
`oxlint-disable react/only-export-components` para que `StructuralCanvas` pudiera importarlas.
Al mudarse a un módulo puro, esos dos supresores de lint desaparecen.

## Qué NO se unificó, y por qué

El vocabulario visual de cada renderizador se mantiene separado, porque no es duplicación sino
política de presentación:

- El canvas dibuja glifos SVG de apoyo (rodillos, resortes, achurados), curvas **Bézier exactas**
  vía `segmentBezierControls`, flechas con `marker-end` y longitudes en píxeles que dependen del
  zoom. El PDF dibuja barbas de flecha a mano con tres líneas, **polilíneas muestreadas** y
  longitudes en puntos de página.
- Los dos encajes a vista tampoco se fusionaron: el del canvas acota la escala
  (`MIN/MAX_CAMERA_SCALE`) y respeta los insets del chrome; el del PDF centra en una caja con
  padding fijo. Comparten `modelBounds`, que es la parte que sí es la misma pregunta.

Forzar una capa de dibujo común habría exigido cambiar el aspecto de uno de los dos, que es
justo lo contrario de lo que pedía el encargo.

## Archivos tocados

- `src/graphics/structureGeometry.ts` — **nuevo**. El núcleo: `memberAxis`,
  `grossRatioFromFlexible`, `flexibleRatioFromGross`, `grossRatioAtPoint`, `pointAtGrossRatio`,
  `lerpPoint`, `toGlobalVector`, `distributedIntensityAt`, `modelBounds`.
- `src/graphics/structureGeometry.test.ts` — **nuevo**. 13 casos: ida y vuelta de estaciones con
  brazos rígidos, miembro degenerado de longitud cero, ortogonalidad de la normal, rotación de
  ejes locales, intensidad faltante tratada como uniforme.
- `src/features/canvas/CanvasGeometryLayer.tsx` — cargas de miembro sobre el núcleo; se eliminan
  las dos funciones exportadas desde el componente y sus `oxlint-disable`.
- `src/features/canvas/CanvasResultLayer.tsx` — diagramas, deformada, cursor de resultados y las
  tres ramas del overlay de líneas de influencia.
- `src/features/canvas/StructuralCanvas.tsx` — colocación de carga puntual y de momento, corte
  (`showCut`), `fitModel` y las etiquetas inteligentes de cargas y de valores de diagrama.
- `src/utils/pdf/pdfDiagrams.ts`, `src/utils/pdf/pdfFormat.ts` — DCL global, diagrama global de
  cantidad y luz flexible sobre el núcleo.
- `docs/architecture/FRONTEND.md` — nueva sección «10 bis · Geometría compartida entre
  renderizadores», más la fila de `utils/pdf/` que faltaba tras AG-003.

Saldo: **116 líneas añadidas, 144 eliminadas** en los renderizadores, más el núcleo y su prueba.

## Cómo verificar

```bash
npm run verify
```

Pasó completo: oxlint, frontera matemática protegida, **666 tests en 90 archivos**, build y
presupuesto de rendimiento (630 252 bytes eager / 169 326 gzip, techo 648 000 / 174 000).

```bash
npm run qa
```

Recorrido Playwright desktop + móvil: todas las comprobaciones en `true`, `console: []`,
`pageErrors: []`, salida 0. Incluye cargar el proyecto Hibbeler y comprobar reacciones y
diagrama de momento en pantalla.

**Fidelidad de los dos renderizadores, medida y no supuesta** (arneses temporales, eliminados
al terminar):

- *PDF*: hash SHA-256 de la lista de operadores de cada página vía PDF.js sobre los dos fixtures
  de prueba. Idéntico, página por página, al PDF posterior a AG-003 — incluidos los vectores.
- *Canvas*: render de `CanvasGeometryLayer` y `CanvasResultLayer` en jsdom (los cuatro *slots*)
  sobre cuatro fixtures — pórtico por defecto, práctica de diagramas, armadura y un pórtico con
  **brazos rígidos y cargas en ejes locales**, que son los dos caminos que más toca el núcleo.
  `diff` del SVG resultante contra el mismo render con las tres capas del canvas revertidas a
  `HEAD`: **0 líneas de diferencia** sobre 32 884 caracteres de marcado.

El panel de navegador integrado no estaba disponible en esta sesión (no compone frames), así que
la verificación en navegador real fue la de Playwright.

## Pendiente / siguiente paso

- **Sin pushear** — el commit quedó local, a la espera de confirmación del usuario.
- `CLAUDE.md` (sin commitear en el working tree) describe el árbol de `src/`; cuando se
  commitee conviene añadirle `src/graphics/` junto a `src/utils/`.
- Candidato natural para el núcleo, no incluido porque hoy no tiene un segundo consumidor:
  `src/data/modelOperations.ts:351` repite la misma rotación de ejes locales, y
  `src/features/inspector/InspectorProperties.tsx:507` la longitud del miembro. Son del dominio
  del modelo, no del dibujo; moverlos implicaría que `data/**` —frontera protegida— dependa de
  `graphics/**`, y eso requiere autorización explícita.
