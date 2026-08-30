# Reporte de entrega: optimización y mejoras

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/code-optimization-amgvfw`
**Commits:** `a39b01f` … `9062467`, sobre `ff7a98e`
**Gate de cierre:** `npm run verify` en verde (salida en §6)

---

## 1. Qué se pidió

> «Optimiza el código y todo mejóralo.»

Y, al acotar: ganancias medibles, el refactor de `StructuralCanvas`, y paralelizar las
pruebas. El usuario **autorizó expresamente** tocar la frontera protegida. No autorizó
actualizar dependencias, y no se actualizó ninguna.

## 2. El diagnóstico primero, porque cambia la respuesta

«Todo» no aplicaba. El repositorio tiene 134 k LOC, 317 archivos de prueba, **0
TODO/FIXME/HACK**, **4 `any`** en 90 k LOC editables y 26 supresiones de lint. La carga
diferida ya estaba aplicada en todo el árbol. No había una limpieza amplia que hacer, y
decirlo era más útil que fabricar trabajo para justificar el encargo.

Lo que sí había era un puñado de cosas concretas y comprobables. Son éstas.

## 3. Qué se hizo

### 3.1 `fflate` fuera del chunk de entrada — `a39b01f`

`App.tsx` traía `decodeProjectFragment` de `utils/shareLink` con importación estática, y
ese módulo importa `fflate`. El compresor entero viajaba en la primera pintada por una
rama que la línea siguiente descarta (`if (!fragment) return;`). Ahora se pide con
`import()` dentro del efecto — el mismo trato que `utils/portableBundle.ts` ya le daba al
mismo paquete.

| | bytes | gzip |
|---|---|---|
| Carga inicial antes | 840 819 | 216 665 |
| Carga inicial después | 807 738 | 203 932 |
| **Diferencia** | **−33 081** | **−12 733 (−5,9 %)** |

El fragmento se retira de la barra de direcciones **antes** de esperar al módulo, que es
donde se retiraba: `decodeProjectFragment` no lanza —devuelve `{ ok: false }`—, así que
hoy la barra se limpia con cualquier hash, se decodifique o no, y eso no cambia.
`App.test.tsx:239` construye un enlace de verdad, lo pone en el hash y comprueba las dos
cosas.

**El gate es la mitad del cambio.** El centinela nuevo en `check-entry-chunk.mjs` se
comprobó en las dos direcciones: con la importación estática restaurada **falla** y señala
el chunk de entrada por su nombre; con el arreglo, pasa. Un gate que no puede fallar no
vigila nada.

### 3.2 El O(n²) de los avisos del puente — `a4ef00d`

`Space3DWorkspace` deduplicaba los avisos por código y luego, dentro de cada `<li>`, volvía
a barrer `pendingNotes` entera con un `filter` para reunir las entidades de ese código.
Cuadrático sobre la lista que se acababa de recorrer, y en la ruta de dibujo. Una sola
pasada de agrupación. Mismo texto y mismo orden.

### 3.3 `StructuralCanvas`: 2390 → 2203 líneas — `0aa13ca`, `9d19dcc`, `76e8018`, `482e72a`

Tres hooks nuevos, siguiendo el patrón que ya marcaban `useCanvasCamera.ts` y
`useCanvasKeyboardShortcuts.ts`:

| Hook | Qué se lleva |
|---|---|
| `useCanvasFeedback` | El aviso efímero y su temporizador, que se cancelaba en el efecto de desmontaje compartido con los `requestAnimationFrame` de la máquina de gestos. |
| `useCanvasSnapping` | Cuatro memoizaciones y un estado: segmentos, candidatos, pie perpendicular, previsualización, y las tres formas de preguntar por un punto. |
| `useStructuralEditDraft` | Cuatro estados, cuatro referencias, tres memoizaciones y el efecto de foco de la edición estructural. |

Lo que más valía no era el tamaño, sino **la duplicación que la extracción sacó a la luz**:

- La secuencia de deshacer la edición en vuelo —cancelar el frame pendiente, limpiar dos
  referencias, restaurar el borrador previo, apagar el borrador en vivo— estaba escrita
  **cuatro veces**. Ahora es `revertStructuralEditTo`.
- El par «limpiar la referencia del borrador en vivo y apagarlo» aparecía en **cinco sitios
  más**. Ahora es `discardStructuralEditFrame`, que además cancela el frame pendiente — lo
  que impide que un `requestAnimationFrame` en vuelo reescriba el borrador recién puesto a
  cero. En los cinco no había frame que cancelar (todos van precedidos de
  `cancelActiveInteraction` o corren fuera de un gesto), así que el comportamiento es el
  mismo y el hueco se cierra.

`useQuickEntry` estaba en el plan y **no se hizo**: habría necesitado ocho parámetros para
devolver ocho valores, y `submitQuickEntry` no es «entrada rápida» sino dibujo — crear
nudos y miembros. Eso no reduce complejidad, la reubica y añade una interfaz. Se dejó
donde está.

Se declararon en sus arrays de dependencias los callbacks que ahora cruzan la frontera del
hook (`clearSnapPreview`, `revertStructuralEditTo`, `discardStructuralEditFrame`, los
setters). Son estables, pero el linter no puede saberlo desde fuera, y declararlos es más
barato que silenciarlos: **no se añadió ni una supresión**.

### 3.4 La suite deja de serializarse — `9062467`

`npm test` corría con `--maxWorkers=1`, sin explicación en `package.json`. El motivo se
deja leer: `src/engine/performance.test.ts` es **el único** archivo que afirma sobre reloj
de pared, y bajo contención de CPU eso mide la máquina. Se serializaban 317 archivos para
proteger a uno.

Dos proyectos de Vitest: `unit` en paralelo, `perf` solo y con un worker, encadenados por
`npm test` para que el que mide tiempo tenga la máquina entera.

| | duración |
|---|---|
| Antes (serie, 317 archivos) | 410,45 s |
| Después (`unit` + `perf`) | ~170 s |

Los mismos 3054 tests (3048 + 6). El proyecto aislado, tres veces seguidas: 4,86 / 4,71 /
4,89 s, en verde.

Dos detalles que costaron una vuelta: el `include` de la raíz **eclipsa** al de los
proyectos —con él arriba, `perf` recogía los 317 archivos en vez de uno—, y el `exclude` de
un proyecto **reemplaza** al heredado, así que la lista de copias y worktrees se repite en
cada uno. Ambos quedan comentados en `vite.config.ts`.

## 4. La frontera protegida: autorizada, y deliberadamente no usada

El usuario autorizó tocarla. **No se tocó**, y la decisión está medida, no intuida.

`src/engine/math.ts` ya trae LDLT disperso con reordenación de Cuthill-McKee inversa,
factorización simbólica separada de la numérica, solver híbrido denso/disperso, estimación
de número de condición y residuo relativo. `multiply` está en orden `ikj` y salta
coeficientes bajo 1e−30; sus llamadas son matrices de elemento 6×6. `solver.ts` usa suma
compensada de Neumaier.

El plan fijaba una puerta de medición: reabrir esto sólo si el modelo de 300 miembros
apareciera sin margen. Lo que dice la medición:

| Prueba | Medido | Techo | Margen |
|---|---|---|---|
| Modelo pequeño | 71 ms | 500 ms | 7,0× |
| Modelo mediano (100 miembros) | 341 ms | 3 000 ms | 8,8× |
| Modelo máximo (300 miembros) | 2 106 ms | 20 000 ms | 9,5× |

Nueve veces de holgura contra cada techo declarado. No hay problema de rendimiento que
resolver ahí, así que `scripts/protected-baseline.sha256` **no se refrescó** y
`verify:protected` pasa byte a byte: *«Frontera protegida intacta: 50 archivos
verificados»*. La autorización levantaba una restricción; no creaba una obligación.

## 5. Qué no se hizo, y por qué

- **Dependencias**: no autorizado.
- **`src/utils/pdf/**`** (~5100 LOC): es el bulto más grande después del lienzo, pero está
  recién trabajado —quince commits en los últimos días— y funcionando. Refactorizarlo ahora
  sería movimiento, no mejora.
- **`React.memo` a discreción**: el componente ya resuelve su problema real de re-render con
  `useStableCanvasEvent` y con el `memo` de `AnalysisStatus`. Memoizar sin medir es ruido.
- **`useQuickEntry`**: ver §3.3.

## 6. Verificación

`npm run verify` completo —lint · documentación · frontera protegida · pruebas · build ·
presupuesto · chunk de entrada · bundle del navegador— **en verde, salida 0**.

```
Frontera protegida intacta: 50 archivos verificados.
Test Files  316 passed (316)  ·  Tests  3048 passed | 8 skipped
Test Files    1 passed (1)    ·  Tests     6 passed
Métrica de rendimiento registrada: 807738 bytes / 203932 gzip
Chunk de entrada limpio:
  el catálogo inglés: assets/catalogEn-CXRPRYDi.js (diferido)
  el compresor fflate: assets/browser-FeX9rYkk.js (diferido)
Bundle del navegador limpio: 91 archivos sin construcciones exclusivas de Node.
```

**Salvedad de entorno.** El contenedor tiene Node v22.22.2; `.nvmrc` pide 24 y CI usa
`node-version-file: '.nvmrc'`. Todo lo anterior se ejecutó en v22. La confirmación en v24
la da CI.

**Sin comprobar a mano.** No se ejecutó `npm run qa` (navegador real) ni se abrió la
aplicación con un fragmento `#m1:` en `npm run dev`. La ruta del enlace compartido queda
cubierta por `App.test.tsx:239`, que la ejerce de punta a punta; la del lienzo, por 242
pruebas en 35 archivos.
