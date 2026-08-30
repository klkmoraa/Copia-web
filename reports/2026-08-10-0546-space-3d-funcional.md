# Space 3D S3D-1 funcional end-to-end

**Fecha:** 2026-08-10 05:46
**Agente:** Claude Code
**Rama:** main (15 commits locales, sin push)

## Qué cambió

Space 3D pasa de no existir a ser una superficie completa: crear, editar,
analizar, visualizar, guardar, reabrir, importar y exportar un marco espacial
elástico lineal de seis grados de libertad por nudo. Todo el dominio nuevo vive
bajo `src/space3d/**` y `src/features/space3d/**`; el producto 2D y su frontera
matemática no se tocan.

Además, por corrección de alcance pedida durante el QA: el visor planar
`Experimental 3D` se retira por completo, Space 3D queda como única experiencia
3D, y el botón del cubo de la mesa 2D abre **el proyecto 2D actual** convertido
al dominio espacial mediante un puente explícito.

## Por qué

Ejecución del plan `docs/superpowers/plans/2026-08-09-space-3d-functional.md`
(Tasks 1–12), con TDD estricto. Las tres correcciones de alcance llegaron
durante Task 12 y están integradas en el mismo trabajo.

## Archivos tocados

Dominio espacial nuevo:

- `src/space3d/model/` — contratos discriminados, límites, proyectos iniciales
  y validación fail-closed acumulativa y ordenada.
- `src/space3d/engine/` — orientación y triada local, elemento frame 12×12,
  ensamblaje, solver con auditoría de equilibrio 6D, fixtures canónicos,
  invariantes, guardas de mutación, comparación con oráculos y capacidad.
- `src/space3d/runtime/` — protocolo versionado, worker aislado y cliente
  cancelable con worker degradado en hilo principal.
- `src/space3d/data/` — códec portable estricto, almacenamiento con copia de
  seguridad, comandos reversibles y **puente 2D → Space 3D**.
- `src/space3d/store/Space3DProjectContext.tsx` — estado, historial, análisis y
  resultados obsoletos.
- `src/space3d/view/` — scene model puro, cámara XYZ, viewport Three.js y
  lienzo React con fallback.
- `src/features/space3d/` — workspace, editor de entidades, panel de resultados
  y CSS responsive sobre los tokens del producto.
- `validation/space3d/` — corpus manual derivado fuera del solver, modelos
  nativos OpenSees/Frame3DD, manifiesto con hashes y scripts de regeneración.
- `scripts/check-space3d-capacity.mjs`, `scripts/space3d-capacity-policy.mjs`,
  `scripts/check-space3d-capacity.test.mjs` — gate de capacidad.
- `package.json` — sólo el script `verify:space3d`. Sin cambios de versión ni
  de dependencias.

Producto existente:

- `src/App.tsx`, `src/features/welcome/WelcomeScreen.tsx`,
  `src/features/topbar/TopBar.tsx`, `src/features/workspace/WorkspaceShell.tsx`
  — Space 3D como única superficie 3D, con carga diferida.
- `src/features/experimental3d/**` — **eliminado**.
- `src/styles.css` — tarjeta de Inicio de Space 3D y corrección de la TopBar.
- `src/i18n/catalogs.ts` — catálogo ES/EN completo de Space 3D; retirado el de
  Experimental 3D.
- `docs/architecture/` — nuevo `structureco-space-3d-s3d1.md` y actualización
  honesta de la matriz de gates.

## Cómo verificar

```bash
npm.cmd run verify:space3d
```

```bash
npm.cmd run lint && npm.cmd run typecheck && npm.cmd run verify:protected && npm.cmd test && npm.cmd run build && npm.cmd run verify:perf
```

Resultados obtenidos:

- Suite completa: **134 archivos, 997 aprobadas, 13 omitidas, 0 fallos**.
  Las 10 omitidas de Space 3D son los oráculos externos no ejecutados.
- `verify:space3d`: 19 archivos, 170 aprobadas; capacidad **150 nudos / 300
  barras** aprobada (189 ms y 18,4 MiB en el escalón máximo).
- `verify:protected`: 29 archivos de la frontera 2D intactos.
- Build correcto. El chunk de entrada no incluye Three.js ni Space 3D: sólo
  entran al abrir la pantalla.
- Navegador real a 1440×900, 1280×860, 1024×800 y 390×844, temas claro y
  oscuro, español e inglés.

## Validación matemática

Cinco casos manuales con derivación cerrada, cuyos valores esperados produce un
script Python que **no usa el solver**: axial, torsión, flexión con `Iz`,
flexión con `Iy` y un miembro inclinado que ejercita la transformación 12×12
completa. Los cinco pasan.

Los guardas de mutación se comprobaron provocando el fallo real: intercambiar
`Iy`/`Iz` rompe 5 pruebas, quitar `GJ` rompe 12, invertir el producto vectorial
de la triada rompe 9 y leer el `roll` en grados rompe 4.

**Oráculos externos: NO EJECUTADOS.** Los modelos OpenSees y Frame3DD están
escritos y versionados, pero ninguno de los dos ejecutables está disponible en
el entorno. Su equivalencia de ejes es una afirmación no verificada; las
pruebas quedan omitidas con razón explícita, nunca como aprobadas.

## Fallos reales encontrados y corregidos en QA de navegador

Ninguno de los tres era visible en jsdom:

1. `forceContextLoss()` en el dispose del viewport mataba el contexto WebGL del
   `<canvas>` que React reutiliza al remontar; la superficie caía al fallback.
2. El proveedor guardaba el cliente del worker entre montajes y, tras la
   limpieza de StrictMode, quedaba desechado para siempre: todo análisis
   respondía `cancelled` sin explicación.
3. La TopBar 2D solapaba 46 px la zona de acciones sobre los selectores a
   1440 px, porque la columna central era `max-content`.

## Puente 2D → Space 3D

Adaptador explícito de una sola dirección; los stores no se acoplan y el solver
no se vuelve híbrido. Conserva nombre, identificadores, unidades, topología,
apoyos planos, cargas nodales, casos y combinaciones, y levanta los nudos a
`z = 0`.

Lo que un modelo plano no puede saber no se inventa: `G`, `Iy` y `J` quedan a
cero —valor que el validador rechaza y el editor pide completar— y ninguna
restricción fuera del plano se añade sola. Celosías, liberaciones, muelles,
apoyos inclinados, cargas en barra y efectos iniciales se publican como
diagnóstico bloqueante; hasta resolverlos o reconocerlos, no se analiza.

Volver al 2D y reentrar reabre el mismo modelo derivado, con almacenamiento
propio por proyecto de origen. Si el 2D cambió se ofrece «Re-derivar desde 2D»
en vez de sobrescribir el trabajo 3D.

Dos reglas internas tuvieron que cambiar para que el flujo fuera posible, y
ambas son mejores que las anteriores: guardar comprueba la forma y no la
admisibilidad, para que un modelo a medio completar sobreviva a una recarga; y
un comando se rechaza si introduce un problema nuevo, no si el modelo ya tenía
uno — la regla anterior impedía justo las ediciones que sirven para completarlo.

## Pendiente / siguiente paso

- **Oráculos externos.** Requieren autorización para descargar los ejecutables
  oficiales de OpenSees y Frame3DD fuera del repositorio. Es el único gate del
  plan que queda sin ejecutar.
- **Push.** Los 16 commits están sólo en local; `autoPush` está desactivado a
  propósito. Codex no verá nada hasta que se confirme el push.
- Space 3D sigue siendo **experimental**: sin certificación de seguridad
  estructural y sin prueba con tecnología de asistencia real.
