# CRI-110 — Candidate Picker: la prueba de ciclado por teclado deja de depender del orden

**Fecha:** 2026-08-20 18:12
**Agente:** Claude Code
**Rama:** main
**Baseline:** `5775c737b7e8f588d6aaacfff01e5f581b8dd5d5` (confirmado igual a `origin/main` antes de tocar nada)

## Qué cambió

Sólo el archivo de prueba `StructuralCanvas.candidatePicker.test.tsx`. La prueba crítica ahora
establece por sí misma la precondición que antes heredaba del azar del reloj: espera —por
condición, no por retardo— a que la restauración de foco diferida que dispara el cierre del picker
haya aterrizado, antes de volver a abrirlo. Se añade además una prueba pequeña que fija esa
precondición de forma explícita.

**El producto no se tocó.** `src/features/canvas/StructuralCanvas.tsx` conserva su hash de baseline
`e3ad873bdc7dc714b0ddac15e67ff0194b1709be620d8d030e530a3779f4c55d`.

## Por qué

### Reproducción antes del cambio

Sobre el baseline intacto:

```
npx vitest run src/features/canvas/StructuralCanvas.candidatePicker.test.tsx
# → 1 failed | 9 passed
npx vitest run src/features/canvas --maxWorkers=1
# → 1 failed | 155 passed  (27 archivos)
npx vitest run src/features/canvas
# → 1 failed | 155 passed  ← en este contenedor el orden paralelo TAMBIÉN falla
```

```
AssertionError: expected '{"kind":"node","id":"N3"}' to contain 'M1'
  at StructuralCanvas.candidatePicker.test.tsx:157
```

### Causa raíz demostrada — NO es estado entre archivos

La hipótesis registrada en CRI-110 (registro de comandos del workspace, listeners `structureco:*`,
estado del picker o algún singleton que sobrevive entre archivos de prueba) es **incorrecta**.
Queda descartada por dos hechos:

1. `vite.config.ts` no define `setupFiles`, ni `globals`, ni `environment`, ni `pool`, ni `isolate`.
   Vitest aplica sus valores por defecto (`isolate: true`), de modo que cada archivo recibe un
   registro de módulos y un jsdom nuevos. No hay canal por el que el estado pueda cruzar.
2. **Experimento decisivo:** la prueba falla igual ejecutada *completamente sola*, con sus 9
   hermanas saltadas:

   ```
   npx vitest run src/features/canvas/StructuralCanvas.candidatePicker.test.tsx \
     -t "cycles preview through the keyboard"
   # → Tests  1 failed | 9 skipped (10)
   ```

   No corrió ningún otro archivo ni ninguna otra prueba. No hay nada de lo que heredar.

La causa real es **una carrera en tiempo real contra la restauración de foco diferida del propio
picker**.

`StructuralCanvas.tsx:1021-1025`:

```ts
const closeCandidatePicker = useCallback(() => {
  setCandidatePicker(null);
  surfaceBroker?.closeSurface('candidatePicker');
  window.requestAnimationFrame(() => svgRef.current?.focus({ preventScroll: true }));
}, [surfaceBroker]);
```

Es comportamiento correcto y deseado: al cerrar el picker, la ruta de teclado vuelve al lienzo
(CRI-96, «ruta de teclado equivalente — obligatoria»). Pero es **diferida**: en jsdom,
`requestAnimationFrame` se implementa sobre un temporizador de ~16 ms.

La instrumentación temporal sobre la secuencia exacta de la prueba lo muestra sin ambigüedad
(`activeElement` en cada frontera):

```
[1-after-first-open]      picker=OPEN  activeDescendant=node-N1    activeElement=DIV[role=listbox]
[2-after-first-ArrowDown] picker=OPEN  activeDescendant=member-M1  activeElement=DIV[role=listbox]
[3-after-Escape]          picker=null  activeElement=BODY
[4-after-reopen]          picker=OPEN  activeDescendant=node-N1    activeElement=DIV[role=listbox]
[5-after-2nd-ArrowDown]   picker=OPEN  activeDescendant=member-M1  activeElement=svg[role=application]  ← robo de foco
[6-after-Enter]           picker=OPEN  activeDescendant=member-M1  activeElement=svg[role=application]
                          selection={"kind":"node","id":"N3"}                     ← Enter nunca llegó al picker
```

Secuencia real del fallo:

1. `{Escape}` cierra el picker y **encola** el rAF que devolverá el foco al lienzo.
2. `openByPointer('mouse', 4)` es `fireEvent`, síncrono: el picker se reabre y su listbox toma foco
   en su efecto de montaje — **dentro del mismo frame**, con el rAF todavía pendiente.
3. Durante los `await` internos de `user.keyboard(...)` transcurren los ~16 ms: el rAF encolado en
   el paso 1 se ejecuta y mueve el foco al `<svg role="application">`, **encima del picker nuevo**.
4. `{Enter}` se despacha al lienzo, no al listbox. No hay confirmación. La selección se queda en
   `N3`, que es exactamente lo que afirma el error.

Nótese que el `{ArrowDown}` sí cicló (paso 5 muestra `member-M1`): el robo de foco ocurre entre el
`ArrowDown` y el `Enter`. La descripción de CRI-110 («`{ArrowDown}` no avanza… `{Enter}` confirma el
primero») describía mal el síntoma: el ciclado funciona, lo que se pierde es el `Enter`.

### Prueba de causalidad única

Experimento de control: se neutralizó **sólo** el rAF (`vi.stubGlobal('requestAnimationFrame', () => 0)`),
dejando todo lo demás idéntico — misma mezcla `fireEvent`/`userEvent`, mismo `localStorage`, mismo
`matchMedia`, mismos temporizadores, sin ninguna espera añadida. Resultado: la secuencia confirma
`M1` y la prueba pasa.

Eso aísla el rAF como **único** factor causal y descarta uno por uno el resto de sospechosos
enumerados en el encargo:

| Sospechoso | Veredicto |
|---|---|
| Estado compartido entre archivos | Descartado — falla sola, con `isolate: true` |
| Estado compartido entre pruebas del mismo archivo | Descartado — falla con las 9 hermanas saltadas |
| Registro global / singleton de módulo | Descartado — `candidatePicker.ts` es puro; registro de módulos nuevo por archivo |
| Listener global sin limpiar | Descartado — `StructuralCanvas.tsx:1937-1942` los retira; además el experimento de control los deja intactos |
| `localStorage` | Descartado — se limpia en `beforeEach`; intacto en el experimento de control |
| `matchMedia` | Descartado — se redefine en `beforeEach`; intacto en el experimento de control |
| Efecto React pendiente | Descartado — el listbox ya está enfocado justo tras reabrir (sonda 4) |
| `userEvent`/`fireEvent` mezclados | Es el **vehículo**, no la causa: los `await` de `userEvent` sólo ceden el turno para que el rAF ya encolado se ejecute |
| «Foco perdido tras Escape» | Descartado en su forma ingenua: el foco **no** se pierde, se restaura correctamente. El defecto es que esa restauración aterriza *tarde*, sobre un picker posterior |
| Temporizador | Sí, pero uno real y legítimo (el rAF del producto), no un fake timer filtrado |

### Por qué dependía del orden

Porque el desenlace es una carrera contra el reloj de pared entre dos cosas que no están
sincronizadas: el temporizador de ~16 ms del `requestAnimationFrame` de jsdom y los `await`
inter-tecla de `userEvent`. Bajo contención de CPU (varios workers compitiendo) el callback del rAF
se retrasa lo suficiente como para ejecutarse **después** del `{Enter}`, y entonces el `Enter` sí
alcanza el listbox y la prueba pasa. Con un solo worker, o con la máquina despejada, el rAF gana la
carrera y roba el foco antes del `Enter`. No era el *orden de los archivos*: era la *carga de la
máquina*. Por eso el mismo binario da resultados distintos con `--maxWorkers=1` y sin él, y por eso
en este contenedor (4 CPUs) **también falla en paralelo**, al contrario de lo observado por quien
abrió la issue.

## Cambio exacto realizado

`src/features/canvas/StructuralCanvas.candidatePicker.test.tsx`, y nada más:

1. Se importa `waitFor` de `@testing-library/react`.
2. Se añaden dos helpers (`canvas()`, `pickerListbox()`) y un ayudante de espera **por condición**:

   ```ts
   const settleFocusAfterClose = async () => {
     await waitFor(() => expect(document.activeElement).toBe(canvas()));
   };
   ```

   No es un `sleep` ni un `setTimeout`: es espera por condición sobre un estado observable, que
   reproduce el secuenciado real (un segundo gesto humano siempre llega mucho después de ese frame).
3. En la prueba crítica, una sola línea — `await settleFocusAfterClose();` — entre el `Escape` y el
   `openByPointer('mouse', 4)`.
4. Se añade una prueba pequeña que fija la precondición de forma directa:
   `hands the keyboard route to the picker on open and back to the canvas on Escape`.

## Contrato CRI-96: no se relajó nada

Ninguna afirmación se tocó. La prueba crítica sigue siendo literalmente la misma en todo lo que
comprueba:

- `ArrowDown` sigue estando, en ambas fases. No se eliminó.
- El preview esperado tras abrir + `ArrowDown` sigue siendo `M1`, no `N1`.
- `Escape` sigue teniendo que dejar la selección exactamente en `N3`.
- Tras reabrir, `ArrowDown` + `Enter` sigue teniendo que confirmar `M1`.
- No hay `skip`, `only`, reintentos, ni cambio de `--maxWorkers=1`, ni cambio en `npm test`.

La cobertura **aumenta**: la nueva prueba fija el punto 6 del contrato (reabrir inicia un ciclo
coherente e independiente) por su mecanismo real — la propiedad del teclado — y el punto de
operabilidad sin ratón.

### Verificación rojo–verde del guardián

Para comprobar que la prueba nueva no es decorativa, se retiró temporalmente la línea del rAF de
`closeCandidatePicker` en el producto:

```
Tests  2 failed | 9 passed (11)
  FAIL … cycles preview through the keyboard, confirms only the active candidate…
  FAIL … hands the keyboard route to the picker on open and back to the canvas on Escape
```

Ambas caen. Restaurado el producto (hash de baseline verificado), ambas pasan. La prueba crítica
sigue dependiendo del comportamiento real del producto: no se la aisló del producto, se la aisló
del reloj.

## Archivos tocados

- `src/features/canvas/StructuralCanvas.candidatePicker.test.tsx` — espera por condición de la
  restauración de foco antes de reabrir el picker; helpers; prueba nueva de precondición.
- `reports/2026-08-20-1812-cri-110-candidate-picker-test-isolation.md` — este reporte.

Sin cambios en producto, solver, model, schema, estilos, CRI-109, CRI-106 ni CRI-93.

## Cómo verificar

```
npx vitest run src/features/canvas/StructuralCanvas.candidatePicker.test.tsx --maxWorkers=1
npx vitest run src/features/canvas --maxWorkers=1
npx vitest run src/features/canvas
npm run typecheck && npm run verify:protected && npm run lint
```

### Evidencia obtenida

| Gate | Resultado |
|---|---|
| Prueba aislada `--maxWorkers=1`, 5 ejecuciones seguidas | **5/5** — `Tests 11 passed (11)` en cada una |
| `src/features/canvas --maxWorkers=1`, 3 ejecuciones | **3/3** — `Test Files 27 passed (27)`, `Tests 157 passed (157)` |
| `src/features/canvas` (paralelo) | Verde — `Test Files 27 passed (27)`, `Tests 157 passed (157)` |
| `npm run typecheck` | Verde, exit 0 |
| `npm run verify:protected` | Verde — «Frontera protegida intacta: 38 archivos verificados» |
| `npm run lint` | Verde, exit 0 (4 warnings preexistentes de `only-export-components`, ninguno en el archivo tocado) |
| `npm test` | **CRI-110 resuelto.** Ver la nota siguiente. |

## `npm test`: CRI-110 deja de aparecer, pero el gate sigue rojo por otra causa

```
Test Files  2 failed | 222 passed (224)
     Tests  18 failed | 2220 passed | 8 skipped (2246)
```

`StructuralCanvas.candidatePicker.test.tsx` **ya no está entre los fallos**: el defecto de CRI-110
está cerrado y el criterio de la issue («recuperar el gate con `--maxWorkers=1`» en lo que a esta
issue respecta) se cumple.

Quedan 18 fallos **preexistentes y ajenos a CRI-110**, en dos archivos:

- `src/App.test.tsx` — 17 fallos, p. ej. `Unable to find an accessible element with the role
  "button" and name /space 3d/i`.
- `src/design-system/tokens.test.ts` — 1 fallo, `never puts white ink on the light brand fill`.

**Demostrado preexistentes, no asumidos:** se guardó el cambio en `git stash`, se confirmó
`git diff origin/main` vacío (árbol idéntico al baseline `5775c73`) y se ejecutaron esos dos
archivos:

```
npx vitest run src/App.test.tsx src/design-system/tokens.test.ts --maxWorkers=1
# → Test Files 2 failed (2) | Tests 18 failed | 38 passed (56)
```

Los mismos 18 fallos, sobre el baseline intacto, sin mi cambio. Además `isolate: true` impide por
construcción que un archivo de `src/features/canvas` los influya.

No se tocaron: caen en territorio de shell y design-system, y el encargo prohíbe explícitamente
empezar CRI-109 y CRI-106.

## Pendiente / siguiente paso

- **Fuera de CRI-110:** los 18 fallos preexistentes de `src/App.test.tsx` y
  `src/design-system/tokens.test.ts` mantienen `npm test` en rojo. Merecen su propia issue; no se
  abordaron aquí por alcance explícito.
- **Hueco latente de producto, no corregido a propósito:** la restauración de foco de
  `closeCandidatePicker` se ejecuta de forma incondicional. Si el picker se reabriera dentro del
  mismo frame en que se cerró, robaría el foco a la instancia nueva. Con un puntero o un teclado
  reales eso exige menos de ~16 ms entre el cierre y la reapertura, lo que no es alcanzable por una
  persona, así que **hoy no incumple CRI-96 en uso real** y no se cambió el producto: habría sido
  modificar comportamiento de foco en producción justificándolo sólo con un escenario sintético, y
  esta issue no autoriza tocar `StructuralCanvas.tsx`. Se deja anotado por si se quiere endurecer
  (guardar el rAF tras comprobar que ninguna superficie posterior reclamó el foco) en una issue
  propia.
