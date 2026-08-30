# Reporte de entrega: cinco mejoras más

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/code-optimization-amgvfw`
**Commits:** `1a4d62c` … `1903165`, sobre `3b1530e`
**Gate de cierre:** `npm run verify` en verde, salida 0

---

## 1. Qué se pidió

> «Propón otras 5 mejoras.»

Se propusieron cinco, medidas contra el código y el build. **Se entregaron cuatro.**
La quinta se abandonó a mitad, con evidencia, y esa es la parte de este reporte que
más conviene leer (§3).

## 2. Lo entregado

### 2.1 MathJax fuera de la ruta de importar — `1a4d62c`

`portableBundle.ts` importaba `createCalculationReport` de forma estática y esa
cadena llega hasta MathJax. Sólo lo necesita `createPortableBundle` —exportar—;
`readPortableBundle` descomprime, valida y parsea sin tocarlo.

| Ruta de importar un `.structureco` | bytes | gzip |
|---|---|---|
| Antes | 1 826 357 | ~635 000 |
| Después | 9 975 | 4 105 |
| **Diferencia** | **−1 816 382** | **−99,4 %** |

**El gate necesitaba una regla nueva, no un centinela más.** El existente compara
carga inicial contra diferido, y esta regresión era diferido con diferido: MathJax
estaba diferido antes y lo seguiría estando después. `SEPARATIONS` afirma que dos
rutas no comparten archivo. Comprobado en las dos direcciones — con el import
estático restaurado señala `portableFile` por su nombre y sale 1.

### 2.2 Una superficie que no carga ya no tumba la aplicación — `01a8362`

Había **un solo `ErrorBoundary`**, en la raíz, con nueve fronteras diferidas
colgando y ni un `.catch()`. Un chunk que no llega —corte de red, o el service
worker sirviendo un `index.html` cacheado que apunta a hashes que ya no existen
tras un despliegue— sustituía la aplicación entera por la pantalla de error. En un
producto local-first eso puede ser trabajo sin guardar.

`LazySurface` compone `ErrorBoundary` + `Suspense` y sustituye a los nueve
`Suspense` sueltos. **No se promete un reintento**: el registro de módulos cachea
el rechazo, y un botón que no puede funcionar sería peor que ninguno. Recargar
sigue siendo la salida, pero pasa a ser decisión del usuario.

`ErrorBoundary` **no tenía ninguna prueba**. Ahora hay cuatro; la que importa
afirma que con un `lazy()` que rechaza, el aviso sale y lo de al lado sigue en
pantalla. Coste: **+2 383 bytes gzip** en la carga inicial.

### 2.3 Dos gates que no ejecutaba nadie — `6513832`

`verify:space3d` y `verify:structural-assets` estaban en `package.json`, con
scripts y pruebas propias, y no los llamaba ni `verify` ni ningún workflow. La
capacidad declarada de Space 3D —150 nudos / 300 barras— no la comprobaba nadie.

Ejecutados antes de conectarlos: **0,56 s** y **25,6 s**, los dos en verde. Ahora
están en `verify` y en `ci.yml`. El de assets importa más de lo que parece: su
primera mitad corre sobre el runner de Node, no sobre vitest, así que `npm test`
nunca lo cubrió.

### 2.4 Los popovers de la Cinta, un valor en vez de cuatro banderas — `1903165`

Aquí apareció **un defecto real**. La exclusión mutua estaba escrita cuatro veces
con un subconjunto distinto cada una: `toggleProjectMenu` y `toggleExportMenu` no
cerraban la configuración de análisis, así que quedaban dos popovers abiertos.

Y no era sólo visual: al cerrar con Escape el foco vuelve al disparador que eligen
unos ternarios encadenados que dan por hecho que hay **uno** abierto — con dos, el
foco volvía al botón equivocado.

Un `openMenu` único no puede representar ese estado. Los cuatro `showX` se derivan
de él, así que los 49 sitios que los leen no cambian. La prueba nueva se comprobó
contra el código viejo: falla justo donde debe.

## 3. Lo que se abandonó, y por qué

### 3.1 El CSS de entrada (propuesta 4): la premisa era falsa

La propuesta decía: 306 893 bytes de CSS render-blocking, 33 hojas «organizadas por
orden de acumulación en vez de por área», con `results` repartido en 7 archivos.
El plan mandaba consolidar por área y luego diferir lo que no pinta al arranque.

**Antes de mover nada se midieron las colisiones de selectores. El resultado
canceló la propuesta:**

| | |
|---|---|
| Selectores totales | 1 885 |
| Repetidos dentro de una misma «área» | 39 |
| **Repetidos ENTRE «áreas» distintas** | **263** |

Los nombres de archivo mienten. `14-results.css` define `.toolbar`, `.tool-button`,
`.welcome-launcher-card`, `.brand-mark` e `.inspector-panel`. `23-inspector.css`
define `.welcome-*`. `11-topbar.css` define `:root` e `.inspector-panel`.

No son hojas por área: son **capas cronológicas de overrides responsive**.
`.brand-mark` se ajusta a 26 px en `03-topbar`, a 30 y 28 px dentro de `@media` en
`14-results`, y a 46 px en `23-inspector`. Agruparlas «por área» reordenaría 263
overrides que se cruzan, cambiando en silencio qué regla gana en qué breakpoint.

Ninguna prueba puede ver eso: los cinco gates de identidad visual comprueban
tokens, contraste, radios y materia — no cuál de dos reglas de igual especificidad
gana. Sólo `npm run qa`, y sólo en los viewports que recorre.

**Conclusión honesta: el problema es real, el arreglo propuesto no lo era.** No es
una reorganización mecánica sino una reescritura de riesgo alto sin red. Se deja
sin hacer, y queda documentado aquí para que la decisión se tome con el dato
delante y no con el nombre de los archivos.

### 3.2 `useProjectExport` (parte de la propuesta 5): no pasó su propio listón

Medido antes de escribir: **diez entradas para nueve salidas**. Reubica complejidad
en vez de reducirla — el mismo criterio por el que se descartó `useQuickEntry` en
la tanda anterior. En su lugar se atacó la duplicación que sí era real (§2.4), que
además destapó el defecto de foco.

## 4. Verificación

`npm run verify` completo **en verde, salida 0**, ya con los dos gates nuevos
dentro:

```
Frontera protegida intacta: 50 archivos verificados.
Three.js structural render contract PASS · 80 PNG · 40 Day + 40 Night
Test Files  318 passed (318)  ·  Tests  3060 passed | 8 skipped
Test Files    1 passed (1)    ·  Tests     6 passed
Reparto en chunks correcto:
  el catálogo inglés … (diferido)
  el compresor fflate … (diferido)
  la ruta de importar un .structureco … — sin MathJax
Bundle del navegador limpio: 91 archivos sin construcciones exclusivas de Node.
Capacidad Space 3D aprobada: 150 nudos / 300 barras.
```

La frontera protegida sigue intacta: `verify:protected` pasa **sin** refrescar
`scripts/protected-baseline.sha256`, y ningún archivo bajo `src/engine`,
`src/workers`, `src/data`, `ProjectContext.tsx` ni `types.ts` aparece en el diff.

**Salvedad de entorno.** Node v22.22.2 en el contenedor; `.nvmrc` pide 24 y CI usa
`node-version-file`. La confirmación en v24 la da CI.

**Sin comprobar a mano.** No se ejecutó `npm run qa` (navegador real). Las dos
rutas nuevas quedan cubiertas por pruebas: el fallo acotado por
`LazySurface.test.tsx`, la exclusión de popovers por `TopBar.test.tsx` —ambas
verificadas fallando contra el código anterior—.
