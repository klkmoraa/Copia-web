# CRI-111 · `src/App.test.tsx` vuelve a probar el shell ACTUAL

**Fecha:** 2026-08-20 19:39
**Issue:** [CRI-111](https://linear.app/klkmoraa/issue/CRI-111/apptesttsx-17-fallos-el-archivo-sigue-probando-la-welcome-anterior-y)
**Clasificación documental:** AUDIT/TEMPORARY

## Baseline

`origin/main` = `d3d8b4e3ea0975cf6b51c4119a79cff4be449cab`
(`test(canvas): la prueba de ciclado del Candidate Picker deja de depender del reloj (CRI-110)`)

Revalidado antes de tocar nada. Las dependencias no estaban instaladas en el entorno: `npm ci` (134 paquetes) precede a cualquier ejecución.

## Los 17 fallos ANTES

```
npx vitest run src/App.test.tsx --maxWorkers=1
# → Test Files  1 failed (1)
#   Tests  17 failed | 10 passed (27)
```

| # | Prueba | Síntoma exacto |
|---|--------|----------------|
| 1 | opens Space 3D lazily from start and returns to both destinations | no encuentra `button` `/space 3d/i` |
| 2 | keeps the 2D project untouched while Space 3D stores its own model | no encuentra `button` `/space 3d/i` |
| 3 | shows a start screen and opens a blank project on demand | no encuentra `heading` `/analiza estructuras con claridad/i` |
| 4 | localizes built-in example cards and preserves English when an example opens | no encuentra `button` `/Example frame.*6 × 4 m frame/` |
| 5 | preserves English when creating a guided exercise | no encuentra `button` `/new exercise/i` |
| 6 | renders the editor and runs analysis for an existing model | no encuentra texto `/Diagrama de momento flector/i` |
| 7 | opens Model Doctor before analysis, isolates the workspace, and returns focus on Escape | `expected undefined to be false` (`shell.inert`) |
| 8 | keeps a completed analysis while Model Doctor is opened and closed | no encuentra texto `/Diagrama de momento flector/i` |
| 9 | collapses expanded mobile Results before opening Model Doctor | `expected false to be true` (`mobile-collapsed`) |
| 10 | draws mixed reactions as separate horizontal Rx and vertical Ry arrows | no encuentra `tab` `/^reacciones$/i` |
| 11 | creates a guided classroom exercise and analyzes it without prediction gates | no encuentra `button` `/nuevo ejercicio/i` |
| 12 | highlights the objects related to an open learning step | no encuentra `tab` `/aprender/i` |
| 13 | shows the N–V–M cursor and learning levels | no encuentra `[data-testid="diagram-chart"]` |
| 14 | exposes canvas shortcuts and selects structural objects from the keyboard | `expected 'false' to be 'true'` (`Desplazar (H)`) |
| 15 | localizes canvas object names, CAD entry, feedback, and result legend in English | no encuentra `form` `CAD numeric entry` |
| 16 | renames a project without invalidating completed analysis | no encuentra `[data-testid="diagram-chart"]` |
| 17 | does not run canvas shortcuts while the mobile inspector is modal | no encuentra `dialog` `/inspector/i` |

**No comparten causa.** Son cuatro causas independientes más dos artefactos de entorno.

## Causa principal

No hay una sola: hay **cuatro contratos que otras issues cerraron a propósito**, y el archivo seguía describiendo el producto anterior a todas ellas. Por volumen, la dominante es la pareja **CRI-94 / CRI-101** (7 de 17): las superficies auxiliares dejaron de ser residentes.

| Causa | Qué cambió | Fallos |
|---|---|---|
| **CRI-104** · Welcome de cuatro pasos | El titular editorial se retiró (V-11) y cada puerta vive en su paso: `Nuevo ejercicio`, `Proyecto completo`, ejemplos, importación, DXF y Space 3D ya no están todos en la primera pantalla. | 1, 2, 3, 4, 5, 11 |
| **CRI-94 / CRI-101** · superficies invocadas | Analizar **no** monta Resultados: el broker sólo la retiene mientras está pedida. `Reacciones` y `Aprender` dejaron de ser pestañas y son la superficie `dense`. | 6, 8, 10, 12, 13, 16 (y la mitad de 11) |
| **CRI-89** · la clase sale del viewport | Ningún componente consulta ya `matchMedia` para decidir layout: `resolveShellClass` lee `innerWidth`/`innerHeight`. El defecto de jsdom (1024×768) cae **bajo** la frontera X2 calculada (1117 px a 768 de alto), así que la app se montaba en `M1` mientras la prueba creía estar en Expanded o en Compact. | 9, 17 (y el fondo silencioso de 6, 8, 13, 15, 16) |
| **CRI-103** · atajos con foco | Un atajo de UNA letra sólo dispara con el foco dentro del lienzo; en cualquier otro sitio secuestraría la navegación rápida de un lector de pantalla. `fireEvent.keyDown(canvas, …)` sin enfocar ya no dispara — y eso **es** el contrato. | 14, 15 |
| *(artefacto)* `inert` en jsdom | `'inert' in HTMLElement.prototype === false`: React lo escribe como propiedad expando y al desactivarlo la **borra**, así que «no inerte» se lee `undefined`, nunca `false`. | 7 |
| *(artefacto)* «el inspector móvil es modal» | CRI-94 fijó el vocabulario: **sólo** `drawer` y `fullscreen` son modales. En `K0` el Inspector es `sheet` y **convive** con el trabajo. La premisa de la prueba dejó de existir. | 17 |

## Tabla test → causa → contrato actual → acción

| # | Prueba | Causa | Contrato vigente hoy | Clase | Acción |
|---|---|---|---|---|---|
| 1 | Space 3D perezoso desde Inicio | CRI-104 | Space 3D sigue alcanzable desde Inicio, marcado experimental, en el paso «Por dónde» | **B** | Navegar al paso antes de pulsar; se añade que volver a Inicio devuelve la Bienvenida entera |
| 2 | El proyecto 2D no lo toca Space 3D | CRI-104 | Igual, más la separación 2D/3D del almacenamiento | **B** | Navegar al paso; la afirmación funcional no cambia |
| 3 | Pantalla de inicio + proyecto en blanco | CRI-104 | Wordmark y **una** línea, cuatro pasos, trabajo primero; el titular editorial se retiró a propósito | **C** | Reescrita y **partida en tres**: los cuatro pasos y la marca; el proyecto en blanco desde el paso 1; y las puertas una a una por su paso actual |
| 4 | Ejemplos localizados en inglés | CRI-104 | Los ejemplos siguen existiendo y siguen localizados, en el paso «Por dónde» | **B** | Navegar al paso (con su rótulo traducido) |
| 5 | Ejercicio guiado en inglés | CRI-104 | El diálogo de ejercicio se abre desde su lanzador del paso 3; en el paso 2 «Nuevo ejercicio» es una **elección de modo** que avanza | **B** | Navegar a «Where to start» |
| 6 | Editor + análisis | CRI-94 | Analizar resuelve; Resultados es una superficie que **se pide** | **B** | Pedir Resultados; se **añade** la afirmación de que antes de pedirla no está montada |
| 7 | Model Doctor aísla y devuelve el foco | artefacto jsdom | Mientras está abierto el shell queda inerte y `aria-hidden`; al cerrar, ninguno de los dos | **A** | `toBeFalsy()` en vez de `toBe(false)`, con la razón escrita; `aria-hidden` se sigue comprobando entero |
| 8 | El análisis sobrevive a Model Doctor | CRI-94 | Igual | **B** | Pedir Resultados |
| 9 | Results Compact se pliega ante Model Doctor | CRI-89 | En `K0` Results se pliega cuando entra una superficie modal | **B** | Viewport de teléfono real (390×844) en vez de `matchMedia` fingido; se afirma `data-shell-class === 'K0'` |
| 10 | Reacciones Rx/Ry separadas | CRI-101 | La capa de reacciones del lienzo se dibuja con el resultado resuelto; `Reacciones` es ahora un lanzador de la superficie densa | **C** | Se deja de pulsar la pestaña; se comprueba que el lanzador existe y la capa del lienzo sigue igual |
| 11 | Ejercicio de Aula sin puertas de predicción | CRI-104 + CRI-101 + CRI-95 | Aula sigue sin puertas de predicción; «Aprender» es la vista `learn` de la superficie densa; el estado del análisis lo afirma la TopBar | **B+C** | Navegar al paso 3; abrir Resultados y la vista densa; `Resultados resueltos` → `Análisis actualizado` |
| 12 | Resaltado por paso de aprendizaje | CRI-101 | Abrir un paso resalta sus objetos en el lienzo | **C** | Abrir la vista densa `learn`; consultar el portal en `document`, no en el contenedor de render |
| 13 | Cursor N–V–M y niveles de detalle | CRI-94 + CRI-101 | El cursor vive en el panel pedido; los niveles, en la vista densa | **C** | Pedir Resultados y la vista densa; acotar `Completo` a su grupo |
| 14 | Atajos del lienzo | CRI-103 | Un atajo de una letra dispara **sólo** con el foco en el lienzo | **B** | Enfocar el lienzo; se **añade** la mitad negativa (sin foco no dispara) |
| 15 | Localización de lienzo, CAD y leyenda | CRI-103 + CRI-94 | Igual, más la leyenda dentro de Resultados | **B** | Enfocar el lienzo; pedir Resultados |
| 16 | Renombrar sin invalidar el análisis | CRI-94 + CRI-95/CRI-108 | Igual | **B** | Pedir Resultados; el menú de utilidades se acota a la TopBar (las acciones contextuales del lienzo publican su propio «Más acciones») |
| 17 | Atajos bajo el inspector móvil | CRI-94 | Una `sheet` **convive** y no aísla; quien aísla es una superficie modal (`drawer`/`fullscreen`) | **C** | Reescrita: la hoja del Inspector no aísla y devuelve el foco en `Escape`; el bloqueo de atajos se comprueba contra Model Doctor, que en `K0` sí es modal |

**Recuento por clase:** A = 1 · B = 10 · C = 6 · D = 0 · E = 0.

**Ninguna prueba se eliminó.** El único caso que podría haber sido D (el test 3, cuya mitad «Welcome plana» ya no existe) se **amplió** en vez de recortarse: donde había una prueba hay tres, y cubren más superficie que antes.

## Expectativas pre-CRI-104 sustituidas

| Expectativa retirada | Por qué ya no existe | Qué la sustituye |
|---|---|---|
| `heading` `/analiza estructuras con claridad/i` | V-11 retiró el titular editorial a dos líneas: Welcome no es landing de marketing | Wordmark + **una** línea de marca, afirmados explícitamente, más la afirmación **negativa** de que el titular no vuelve |
| `button` `/nuevo ejercicio/i` en la primera pantalla | El ejercicio guiado se elige en el paso 2 y se abre desde el paso 3 | Navegación por el carril de pasos |
| `button` `/proyecto completo/i` en la primera pantalla | Es una opción del paso «Cómo trabajas» | Navegación por el carril de pasos |
| Ejemplos y `.welcome-template-card` accesibles de entrada | Viven en el paso «Por dónde» | Navegación por el carril; las cards se siguen comprobando |
| «todas las puertas en una pantalla» | CRI-104 reordenó el peso visual sin retirar ninguna puerta | Prueba dedicada que recorre importación, lienzo en blanco, ejemplos, DXF y Space 3D experimental, cada una por su paso |
| `tab` `/^reacciones$/i` y `tab` `/aprender/i` | CRI-101 las sacó del panel: son la superficie `dense` | Lanzadores `[data-dense-launcher]` y la superficie densa |
| Resultados montado por analizar | CRI-94: invocada, nunca residente | Se pide, y se afirma que antes de pedirla **no** está |
| `matchMedia` como forma de elegir composición | CRI-89: la clase sale de `innerWidth`/`innerHeight` | `setViewport('desktop' | 'phone')`, el mismo helper que `ResultsPanel.test.tsx` |
| `Resultados resueltos` | CRI-95 movió el estado del análisis a la TopBar | `Análisis actualizado` (`analysis.statusResolved`) — `success` sin prometer `reliable` ni `safe` |
| «el inspector móvil es modal» | CRI-94: sólo `drawer` y `fullscreen` lo son | La hoja convive; el aislamiento se prueba contra Model Doctor |

## Setup actual de usuario NUEVO

Es el camino por defecto y **no requiere preparar nada**: jsdom no implementa IndexedDB, `readWelcomeEntry` devuelve `new` y la Bienvenida se muestra entera con sus cuatro pasos.

```ts
setViewport('desktop');            // 1440×900 → X2
await clearPersistence();          // localStorage + sessionStorage + IndexedDB
render(<App />);                   // → welcome-screen, paso 1
```

Lo que se navega a partir de ahí se hace por el carril real de pasos, no por un atajo de prueba:

```ts
const stepRail = () => within(document.querySelector('.welcome-steps') as HTMLElement);
const goToStep = async (user, step) => user.click(stepRail().getByRole('button', { name: step }));
```

## Setup actual de usuario RECURRENTE

El mecanismo real de CRI-104 es **el repositorio**, no `localStorage`: `readWelcomeEntry` sólo hace `listProjects()` y `listRecoveries()`, y `shouldResumeDirectly` exige proyectos guardados **y** cero recuperaciones pendientes.

Se ejercita con `InMemoryProjectRepository`, que es la implementación de `ProjectRepository` que el **propio producto** expone y que ya usan `ProjectHub.test.tsx` y `welcomeFlow.test.tsx`:

```ts
const repository = new InMemoryProjectRepository();
await repository.saveProject({ ...createDefaultProject(), name: 'Trabajo de ayer' });
const entry = await readWelcomeEntry(repository);
expect(entry.status).toBe('returning');
expect(shouldResumeDirectly(entry)).toBe(true);
```

Y la protección de la recuperación, que es la que impide el auto-skip:

```ts
await repository.saveProject(project);
await repository.createRecovery(project, 'conflict');
expect(shouldResumeDirectly(await readWelcomeEntry(repository))).toBe(false);
```

**Nada de esto se finge.** No hay mock del Welcome, ni parche de `listProjects`, ni bypass del repositorio, ni flag privado, ni clave de `localStorage` inventada.

Se añade además la afirmación de que **escribir el proyecto activo en `localStorage` NO convierte a nadie en usuario recurrente** — precisamente para que ninguna prueba futura vuelva a intentar ese atajo:

```ts
localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
render(<App />);
expect(await readWelcomeEntry()).toEqual({ status: 'new', projects: 0, recoveries: 0 });
expect(await screen.findByTestId('welcome-screen')).toBeTruthy();
```

### Límite honesto, declarado

El **salto directo a la Mesa montando `<App />`** no se puede observar en jsdom: `App` no inyecta repositorio y `readWelcomeEntry` cae a `new` cuando `indexedDB` no existe. Fabricarlo exigiría una de las vías prohibidas (mockear el Welcome, parchear `listProjects`, o añadir `fake-indexeddb` como dependencia nueva sin autorización). Lo que se hace es lo honesto: probar la **derivación real** por su API real, y afirmar a nivel de `App` lo que sí es observable — que sin biblioteca **no** se finge un salto. El auto-skip como render sigue cubierto por `welcomeFlow.test.tsx` (`WelcomeScreen · salto directo a la Mesa`).

## Limpieza de persistencia / aislamiento de IndexedDB

Se limpia en `beforeEach` **y** en `afterEach`, para que ni el primer test herede ni el último deje residuo:

```ts
const clearPersistence = async () => {
  localStorage.clear();      // proyecto activo, modelo de Space 3D, modo del panel
  sessionStorage.clear();
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('structureCo.projects');
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
};
```

Hoy jsdom no implementa IndexedDB y no hay base que borrar; el borrado se escribe igualmente y **de verdad** para que este archivo no pueda empezar a depender en silencio de una base heredada si algún día la hay. El viewport también se restablece a `desktop` en cada `beforeEach`, de modo que un test que pasa a `phone` no contamina al siguiente.

**Sin dependencia de orden:** verificado con y sin `--maxWorkers=1` (abajo).

## Resultados

### El archivo, 3 de 3

```
npx vitest run src/App.test.tsx --maxWorkers=1
run 1 → Test Files 1 passed (1) · Tests 33 passed (33)
run 2 → Test Files 1 passed (1) · Tests 33 passed (33)
run 3 → Test Files 1 passed (1) · Tests 33 passed (33)
```

Y sin fijar workers, que es el otro orden de ficheros:

```
npx vitest run src/App.test.tsx
→ Test Files 1 passed (1) · Tests 33 passed (33)
```

De 27 pruebas (10 verdes) a **33 pruebas, todas verdes**: seis más, no seis menos.

### Gates

| Gate | Resultado |
|---|---|
| `npm run typecheck` | verde |
| `npm run lint` | verde (exit 0; sólo los `only-export-components` preexistentes, en ficheros no tocados) |
| `npm run verify:protected` | `Frontera protegida intacta: 38 archivos verificados.` |

### `npm test` completo

```
Test Files  1 failed | 223 passed (224)
     Tests  1 failed | 2243 passed | 8 skipped (2252)
  Duration  297.15s
```

El único fallo restante:

```
FAIL src/design-system/tokens.test.ts > Phase 4 design-token contract
     > never puts white ink on the light brand fill
AssertionError: expected '@import './design-system/tokens.css'…' not to match /background:\s*var\(--accent\)/
```

Es **CRI-109**, conocido y explícitamente fuera de alcance. **No se tocó.**

**No aparecieron otros fallos.** Los 17 de `App.test.tsx` desaparecieron y ninguna otra prueba de la suite cambió de estado: el diff toca **un solo archivo**, y es de pruebas.

## Producto: NO se tocó

```
$ git diff --stat
 src/App.test.tsx | 399 ++++++++++++++++++++++++++++++++++-------
 1 file changed, 343 insertions(+), 56 deletions(-)
```

Ni `src/App.tsx`, ni `WelcomeScreen`, ni `ProjectHub`, ni la persistencia, ni el broker, ni el solver. **Cero cambios de producto.** No hubo ningún bug de producto que demostrar: los dos candidatos se investigaron y los dos resultaron ser comportamiento diseñado.

### Los dos candidatos a bug, descartados con evidencia

1. **`Delete` borra el miembro seleccionado con la hoja del Inspector abierta en `K0`.** No es un bug. CRI-94 fija que sólo `drawer` y `fullscreen` son modales; `detail` en `K0` es `sheet` y **convive** por diseño. Comprobado en instrumentación: con la hoja abierta el shell **no** queda inerte (`shell.inert === undefined`, sin `aria-hidden`), el diálogo **no** es `aria-modal`, y el foco **nunca sale del lienzo** (`document.activeElement` es el `<g>` del miembro, `dialog.contains(activeElement) === false`). Un atajo del lienzo con el foco en el lienzo y sin superficie que aísle es exactamente lo que debe pasar. La hoja además no contiene ningún campo de texto que pudiera capturar la tecla (`inputs in sheet: 0`).
2. **`expect(shell.inert).toBe(false)` falla tras cerrar Model Doctor.** No es un bug: `'inert' in HTMLElement.prototype === false` en jsdom, así que React la escribe como propiedad expando y al desactivarla la borra. El DOM real queda correcto; lo que fallaba era la forma de mirarlo.

### Hallazgo menor, anotado y NO arreglado aquí

Las claves `results.stateResolved`, `results.stateResolvedLimited` y `results.stateResolvedUnreliable` de `src/i18n/catalogs.ts` están **huérfanas**: ningún componente las lee desde que CRI-95 movió el estado del análisis a la TopBar. Es higiene de catálogo, no afecta a nadie, y tocarla queda fuera del alcance de esta issue.

## Alcance respetado

- **CRI-104 intacto**: cuatro pasos, proyectos primero, salto directo, protección de recuperación, recientes, import, DXF, ejemplos, Aula y Space 3D experimental. Nada revertido; la Welcome antigua no se recreó — se afirma explícitamente que su titular **no** vuelve.
- **CRI-109** no se empezó. **CRI-106** no se empezó. Sin remate visual.
- **CRI-93** sigue BLOCKED, sin tocar.

## Cómo verificar

```bash
npm ci
npx vitest run src/App.test.tsx --maxWorkers=1   # 33 passed, tres veces seguidas
npx vitest run src/App.test.tsx                  # 33 passed
npm run typecheck && npm run lint && npm run verify:protected
npm test                                         # 1 failed (CRI-109) | 2243 passed
```

## Pendientes

- **CRI-109** — `tokens.test.ts`, único rojo restante de la suite.
- Cobertura de render del auto-skip a nivel de `<App />`: bloqueada por la ausencia de IndexedDB en jsdom. Si alguna vez se autoriza `fake-indexeddb` como dependencia de desarrollo, esa prueba se puede subir de `welcomeFlow.test.tsx` a `App.test.tsx` sin cambiar producto.
- Claves i18n huérfanas de `results.stateResolved*`.
