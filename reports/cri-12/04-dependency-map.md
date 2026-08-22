# CRI-12D · Mapa de dependencias

**Clasificación:** `AUDIT/TEMPORARY`
**Complementa:** `04-implementation-roadmap.md`

Tres categorías, deliberadamente distintas:

- **`HARD`** — bloqueo duro. Ejecutar antes produce trabajo que hay que rehacer, o rompe un contrato. Está reflejado como `blockedBy` en Linear.
- **`SOFT`** — secuenciación recomendada. Ejecutar antes funciona, pero cuesta re-QA o produce un resultado provisional. **No** está en Linear como bloqueo; se documenta aquí y en la descripción de la issue.
- **`PARALLEL`** — sin conflicto de archivos ni de contrato. Puede ejecutarse a la vez que cualquier otra cosa.

---

## 1. Tabla de dependencias

| Issue | Depende de | Tipo | Razón | ¿Paralelizable? | Riesgo de ejecutar fuera de orden |
|---|---|---|---|---|---|
| **CRI-89** Resolutor X2/M1/K0 | — | — | Fundación. | Sí, con CRI-90/91/92/93 | — |
| **CRI-90** Materia `SHEET`/`MODAL` | — | `PARALLEL` | Sólo `src/design-system/**`. | Sí, con todo | — |
| **CRI-91** Brandbook renovado | — | `PARALLEL` | Sólo `brand/**`, `tokens.css`, Lab. | Sí, con todo | — |
| **CRI-92** Evaluación `settings.show*` | — | `PARALLEL` | Sólo lectura + informe. | Sí, con todo | — |
| **CRI-93** Medición de rendimiento | — | `PARALLEL` | Sólo medición + informe. | Sí, con todo | Medir un producto que luego cambia; mitigado declarando el SHA medido |
| **CRI-94** Broker + continuidad | CRI-89 | `HARD` | Sin clase única no hay a qué migrar; T-INV-5 usa la histéresis del resolutor. | Con CRI-95 | El broker acabaría leyendo `matchMedia` sueltos: la doble fuente de verdad que CRI-89 elimina |
| | CRI-90 | `SOFT` | Las presentaciones `sheet`/`drawer` se ven mal sin materia, aunque se comporten bien. | | QA visual del slice queda provisional; hay que repetirlo |
| **CRI-95** Chrome global | CRI-89 | `HARD` | El piso de Cinta Compact se define por clase, no por breakpoint. | Con CRI-94 | El piso se calibraría contra un breakpoint que va a desaparecer |
| **CRI-96** Selección 5 fases | CRI-89 | `HARD` | Afordancias por clase. | No con CRI-97 | |
| | CRI-94 | `HARD` | El picker es capa contextual: R-1 y T-INV-1 lo gobiernan. | | Dos capas contextuales simultáneas en Compact; picker que commitea al rotar |
| **CRI-97** `contextual-actions` + D-07 | CRI-89, CRI-94 | `HARD` | Presentación del zócalo y regla R-1. | No | Zócalo y picker coexistiendo en Compact |
| | CRI-96 | `HARD` | Las acciones cuelgan de la selección; sin contrato firme se construyen sobre ambigüedad. | | Verbos aplicados al objeto equivocado cuando hay varios candidatos |
| **CRI-98** ToolRail | CRI-89 | `HARD` | La forma del riel viene de la clase. | Sí, con capa 3 | Se reintroduce un `matchMedia` propio |
| | CRI-90 | `HARD` | Necesita `INSET` bien definido y el patrón de anidamiento bandeja/herramientas. | | Bandeja y activo mal resueltos; hay que rehacer la materia |
| **CRI-99** Inspector partido | CRI-89, CRI-94 | `HARD` | Presentación por clase y migración de `detail`. | Sí, con CRI-100 | `detail` que se cierra al recomponer |
| | **CRI-92** | `HARD` | **La superficie `view` no se puede especificar sin saber dónde vive el estado de visibilidad.** `src/types.ts` está bajo baseline protegido. | | Se implementa `view` sobre una decisión de schema que luego cambia, o se rompe `verify:protected` sin autorización |
| **CRI-100** Results 1/2 | CRI-89, CRI-94 | `HARD` | El panel tiene su propio `matchMedia`, su propio `role="dialog"` y su propio `role="separator"`; los tres los centraliza la fundación. | Sí, con CRI-99 | |
| | CRI-95 | `HARD` | El estado y la fiabilidad se mudan **al** chrome: tiene que estar saneado antes de recibirlos. | | Se mete la afirmación más crítica del producto en un chrome que aún es un cajón |
| **CRI-101** Results 2/2 | CRI-100 | `HARD` | Continúa la misma descomposición. | No | |
| | CRI-90 | `HARD` | Tarjeta `RAISED` con tabla `BASE` dentro. | | Tarjetas sin materia correcta, o tabla elevada dentro de tarjeta |
| | CRI-91 | `HARD` | Las guardas de V-10 son cromáticas ("una tarjeta nunca cambia de color para decir que el resultado es bueno"); con la marca en menta el riesgo de leerse como "aprobado" **aumenta**. | | QA completo de Día/Noche + escala de grises repetido dos veces |
| **CRI-102** Datasheet + Doctor `peek` | CRI-94 | `HARD` | `peek` es un **estado** del broker (R-4); sin él no hay dónde colgarlo. | Sí, con CRI-103/104 | Se inventa un `peek` paralelo que luego hay que desmontar |
| | CRI-90 | `HARD` | Materia `MODAL` y `BASE` para la superficie en `peek`. | | |
| | CRI-93 | `SOFT` | Informa si `peek` con modelo grande necesita algo más. | | Se anticipa virtualización sin dato — exactamente lo que el principio prohíbe |
| **CRI-103** Registro de comandos | CRI-89 | `HARD` | Presentación de la paleta y alcance de atajos por clase. | Sí, con capa 3 | |
| | CRI-93 | `SOFT` | Cubre la latencia de la paleta con modelo grande. | | |
| **CRI-104** Welcome | CRI-90 | `HARD` | Hoy casi todo Welcome es `floating`; necesita `RAISED`/`BASE` correctos. | Sí, con capa 3 | |
| | CRI-91 | `HARD` | Welcome es donde más se nota la marca. Hacerlo antes obliga a rehacerlo. | | Rehacer el vestido entero |
| **CRI-105** Reconciliación Clay | CRI-91 | `HARD` | La escala de radios y los tokens de sombra **los fija el Brandbook**; aplicarlos antes es inventarlos. | Sí, al final | Se inventa una escala que luego contradice al Brandbook |
| | CRI-90 | `HARD` | Hay que repartir radios por nivel; los seis niveles deben existir. | | |
| **CRI-106** Gate de accesibilidad | CRI-91 | `HARD` | Medir sobre lima produce un resultado que caduca al entrar la menta. | Sí | Medición desechable |
| | capa 3 completa | `SOFT` | Mide mejor el producto final que un estado intermedio. | | Resultado envejecido; mitigable declarando el SHA medido y repitiendo |

---

## 2. Grafo resumido

```
CRI-86 (esta fase) ──► CRI-88 (épico) ──► CRI-87 (cierre del programa)

CAPA 0 — todos arrancables hoy, en paralelo
  CRI-89 resolutor ─────────┐
  CRI-90 materia ───────────┤
  CRI-91 BRANDBOOK ─────────┤
  CRI-92 spike schema ──────┤
  CRI-93 spike rendimiento ─┘

CAPA 1
  CRI-89 ──► CRI-94 broker/continuidad
  CRI-89 ──► CRI-95 chrome

CAPA 2
  CRI-89 + CRI-94 ─────────────► CRI-96 selección
  CRI-89 + CRI-94 + CRI-96 ────► CRI-97 contextual-actions

CAPA 3
  CRI-89 + CRI-94 + CRI-92 ────► CRI-99  Inspector
  CRI-89 + CRI-94 + CRI-95 ────► CRI-100 Results 1/2
  CRI-100 + CRI-90 + CRI-91 ───► CRI-101 Results 2/2
  CRI-94 + CRI-90 ─────────────► CRI-102 Datasheet + Doctor peek
  CRI-89 + CRI-90 ─────────────► CRI-98  ToolRail
  CRI-89 ──────────────────────► CRI-103 registro de comandos
  CRI-90 + CRI-91 ─────────────► CRI-104 Welcome

CAPA 4
  CRI-91 + CRI-90 ─────────────► CRI-105 reconciliación Clay
  CRI-91 ──────────────────────► CRI-106 gate de accesibilidad
```

---

## 3. Qué puede correr a la vez

**Frente inicial (día 1, cinco pistas simultáneas):** CRI-89 · CRI-90 · CRI-91 · CRI-92 · CRI-93. Ficheros disjuntos, contratos disjuntos, cero conflicto.

**Tras CRI-89:** CRI-94 y CRI-95 en paralelo. Tocan `WorkspaceShell.tsx` los dos — coordinar, o serializar en ese archivo.

**Tras CRI-94 + CRI-90 + CRI-91:** se abre el abanico más ancho — CRI-99, CRI-100, CRI-102, CRI-98, CRI-103 y CRI-104 son razonablemente disjuntos entre sí (Inspector / Results / Datasheet+Doctor / riel / comandos / Welcome).

**Punto de mayor contención:** `src/features/workspace/WorkspaceShell.tsx`. Lo tocan CRI-89, CRI-94, CRI-95, CRI-99, CRI-101 y CRI-102. **Recomendación**: no ejecutar dos slices que lo modifiquen a la vez, aunque no haya bloqueo formal entre ellos.

**Segundo punto de contención:** `src/features/results/ResultsPanel.tsx` (1019 líneas), tocado por CRI-89 (quitar `matchMedia`), CRI-95 (ruta de la causa gobernante), CRI-100 y CRI-101. Aquí el orden **sí** es estricto y ya está en el grafo.

---

## 4. Camino crítico

```
CRI-89 → CRI-94 → CRI-96 → CRI-97
```

Cuatro slices. Todo lo demás cuelga de la fundación con más holgura o corre en paralelo.

**La ruta de identidad visual (CRI-91 → CRI-101/104/105/106) es más larga en calendario que el camino crítico funcional**, precisamente porque el gate cromático de `03-color-decision.md` §4 es trabajo de medición real. Es la razón principal por la que se adelanta al día 1: si empieza tarde, se convierte en el camino crítico de facto.

---

## 5. Riesgos de ejecutar fuera de orden — los tres que más cuestan

1. **Construir cualquier superficie antes que CRI-89.** Se reintroduce un `matchMedia` local y se consolida la doble fuente de verdad. Es el fallo que hoy existe y que el backlog entero viene a eliminar.
2. **Implementar `view` (dentro de CRI-99) antes de CRI-92.** `src/types.ts` está bajo baseline protegido: o se rompe `verify:protected` sin autorización, o se construye sobre una decisión de schema que luego cambia. Es el único bloqueo del backlog que nace de un gate del repositorio, no de una decisión de diseño.
3. **Hacer CRI-101, CRI-104 o CRI-105 antes que CRI-91.** No rompe nada, pero obliga a repetir el QA de Día/Noche, contraste, escala de grises y CVD sobre cada superficie tocada. Es el coste que la Desviación 1 del roadmap existe para evitar.
