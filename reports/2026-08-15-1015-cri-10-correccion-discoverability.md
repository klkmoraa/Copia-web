# CRI-10 — Corrección de discoverability y paridad funcional visible

**Fecha:** 2026-08-15 10:15
**Agente:** Claude Code
**Rama:** `research/cri-10-ux-system`, misma rama que la especificación base
**Corrige:** [`reports/2026-08-15-0730-cri-10-sistema-ux-ui.md`](2026-08-15-0730-cri-10-sistema-ux-ui.md) (SHA `2303cf7`)
**Clasificación:** `SPEC/DESIGN` — corrección de una especificación de diseño. No es implementación, no toca `src/**`.

## 0. Qué motivó esta corrección

La revisión de la especificación base encontró un patrón real, no una preferencia estética: **la propuesta reduce chrome permanente correctamente (P-B), pero en el camino algunas capacidades reales dejaron de tener una puerta visible.** Limpio no es lo mismo que descubrible, y la primera pasada confundió los dos.

El ejemplo que dio nombre a la corrección — **«el centro analítico ya no se encuentra»** — resultó ser real y verificable en el código: `ResultsPanel.tsx:510` renderiza hoy `{t('results.center')}` seguido de `resultContext.label`, que es «Vista global» cuando no hay selección o «Nodo N3» / «Miembro B-03» cuando la hay. Es el rótulo que le dice al usuario **de qué objeto está leyendo resultados**, y la descomposición de Results (D-03) de la especificación base no le daba ningún equivalente cuando no hay selección.

Auditando el resto de la Cinta con el mismo criterio aparecieron cuatro problemas más, uno de ellos un **defecto real en el código de los conceptos** (no sólo una omisión de prosa):

1. **Bug verificado**: el lanzador de Model Doctor sólo se pintaba con `doctor > 0` hallazgos. Con un modelo limpio —el caso más común al empezar a modelar— la herramienta de diagnóstico completa desaparecía de la interfaz.
2. **Capacidad sin puerta**: PER-01/02/03 (guardado, sin conexión, conflicto de revisión) no tenían ningún control en la Cinta rediseñada. El hueco de acceso más grave que encontró CRI-8 (§9.2 #1 — la recuperación de conflicto vive en otra pantalla) seguía sin resolverse.
3. **Puerta sin rótulo**: el caret junto a «Resolver» abría `analysis-setup` (casos, combinaciones, P-Delta) sin decir qué contenía — indistinguible de cualquier otro icono de la Cinta.
4. **Menú sin contenido declarado**: el menú de documento existía como caret pero su contenido nunca se enumeró, así que «Exportar», «Preferencias», «Cambiar de proyecto» y «Importar» quedaban implícitos.
5. **Superficies sin lanzador**: `dense` (Reacciones, Influencia, Aprender) y `view` (capas, snap, filtro de selección) se describían en prosa como «invocadas» sin decir **desde dónde**. Y el Datasheet —que hoy no se oculta ni en Compact— no tenía ningún icono permanente en la Cinta rediseñada.

Ninguno de estos es un desacuerdo con la dirección «la mesa y el instrumento». Los tres permanentes (Cinta, Riel, Lienzo) siguen siendo los tres permanentes. Lo que se corrige es que **cada capacidad real necesita una puerta visible, y varias no la tenían.**

---

## 1. Capability Relocation Ledger

Tabla exhaustiva, organizada como el inventario de CRI-8 (mismo orden de dominios, mismos IDs) para que la paridad se pueda verificar fila por fila. **Estado** se juzga sobre el diseño **ya corregido** (después de los cambios de esta pasada); donde el estado de la primera pasada era distinto, se anota en la columna Notas.

Leyenda de columnas: **P/C/I** = Persistente / Contextual / Invocada (CRI-9 §2.1). **Estado**: `clear` = puerta visible sin ambigüedad · `weak` = existe pero exige más de un paso o no está rotulada · `missing` = no había ninguna puerta.

### Entrada (ENT) — 15 capacidades

| ID | Capacidad | Superficie actual (CRI-7/8) | Nueva superficie (corregida) | P/C/I | Cómo se descubre | Primer punto de acceso visible | Estado | Notas |
|---|---|---|---|---|---|---|---|---|
| ENT-01 | Elegir por dónde empezar | Welcome, pantalla propia | Welcome (sin cambio) | Persistente | Es la pantalla de entrada | Welcome | `clear` | |
| ENT-02 | Continuar el proyecto anterior | Botón pequeño, arriba a la derecha | Tarjeta «Continuar», primaria, con miniatura y estado | Persistente (en Welcome) | Visual, con relleno de marca | Tarjeta «Continuar» | `clear` | §4 ya lo resolvía |
| ENT-03 | Crear proyecto en blanco | Welcome + menú de proyecto TopBar | Tarjeta Welcome + menú de documento › «Cambiar de proyecto…» | Persistente / Invocada | Tarjeta visible + entrada de menú | Tarjeta «Proyecto nuevo» | `clear` | |
| ENT-04 | Abrir ejemplo / plantilla | Tarjetas Welcome | Sin cambio | Persistente | Tarjetas | Welcome | `clear` | |
| ENT-05 | Filtrar plantillas por tipo | Chips Welcome | Sin cambio | Persistente (en Welcome) | Chips visibles | Welcome | `clear` | |
| ENT-06 | Ver/abrir proyectos guardados (Project Hub) | **Sólo Welcome** | Welcome **+ menú de documento › «Cambiar de proyecto…»** | Invocada | Entrada de menú con sub-etiqueta «Project Hub» | Menú de documento (§2.3, lámina 17) | `clear` | **Corregido** — antes GAP (CRI-8 §9.2 #2, «no se puede cambiar de proyecto desde la mesa») |
| ENT-07 | Renombrar proyecto guardado | Sólo Hub | Sin cambio (dentro del Hub) | Invocada | Dentro del Hub | Project Hub | `clear` | |
| ENT-08 | Duplicar proyecto guardado | Sólo Hub | Hub **+ menú de documento › «Duplicar proyecto»** (proyecto abierto) | Invocada | Entrada de menú | Menú de documento | `clear` | Mejora sobre CRI-8 |
| ENT-09 | Restaurar tras conflicto | **Sólo Project Hub, otra pantalla** | Hub **+ chip de persistencia en conflicto → `recovery`** | Invocada | Chip rojo permanente en la Cinta | Chip de persistencia (lámina 21) | `clear` | **Corregido** — antes GAP más grave de CRI-8 (§9.2 #1) |
| ENT-10 | Importar JSON / bundle / PDF | Menú de proyecto TopBar + Welcome | Welcome **+ menú de documento › «Importar…»** | Invocada | Entrada de menú | Menú de documento | `clear` | |
| ENT-11 | Importar geometría DXF | **Sólo Welcome** | Welcome **+ menú de documento › «Importar…»** | Invocada | Entrada de menú, misma puerta que ENT-10 | Menú de documento | `clear` | **Corregido** — antes GAP (CRI-8 §9.2 #3) |
| ENT-12 | Crear ejercicio de Aula | Botón Welcome | Sin cambio | Persistente | Tarjeta «Nuevo ejercicio» | Welcome | `clear` | |
| ENT-13 | Renombrar proyecto abierto | TopBar, zona documento | Cinta, `doc__name` + menú de documento › «Renombrar proyecto» | Persistente / Invocada | Nombre del documento, clicable | Cinta | `clear` | |
| ENT-14 | Volver a Inicio | Marca del TopBar | Cinta, `mark` + menú de documento › «Volver a Inicio» | Persistente | Marca «S», siempre visible | Cinta | `clear` | |
| ENT-15 | Abrir Space 3D | Icono TopBar + Welcome + «Más» Compact | Welcome + **menú de documento › «Space 3D · Experimental»** | Invocada | Entrada de menú, marcada Experimental (P-22) | Menú de documento | `clear` | Antes `weak` en el primer borrador — no tenía puerta en la Cinta rediseñada |

### Shell (SHL) — 24 capacidades

| ID | Capacidad | Superficie actual | Nueva superficie (corregida) | P/C/I | Cómo se descubre | Primer punto de acceso visible | Estado | Notas |
|---|---|---|---|---|---|---|---|---|
| SHL-01 | Ejecutar el análisis | TopBar, extremo derecho | Cinta, botón «Resolver» | Persistente | Único botón con relleno de marca en toda la Cinta | Cinta | `clear` | |
| SHL-02 | Saber el estado del análisis | Chip TopBar + texto Results | Cinta, chip de estado | Persistente | Chip con forma + color + palabra | Cinta | `clear` | |
| SHL-03 | Deshacer | Icono TopBar + «Más» + paleta | Cinta, icono permanente | Persistente | Icono, posición fija (nivel 1) | Cinta | `clear` | Nunca se degrada (§2.2) |
| SHL-04 | Rehacer | Igual que SHL-03 | Cinta, icono permanente | Persistente | Igual | Cinta | `clear` | |
| SHL-05 | Abrir la paleta de comandos | Rail + atajo + hoja «Más» táctil | `Ctrl/⌘+K` + **menú de documento › «Buscar comandos…»** | Invocada | Atajo global + entrada de menú para táctil | Menú de documento (lámina 17) | `clear` | La entrada de menú es la corrección — antes el texto de §12 la prometía sin que el menú la listara |
| SHL-06 | Navegar por identificador | Sólo en la paleta | Sin cambio | Invocada | Dentro de la paleta | Paleta de comandos | `clear` | |
| SHL-07 | Elegir caso/combinación | 4 sitios distintos | `analysis-setup`, invocado | Invocada | **Chip etiquetado junto a «Resolver»**, con el nombre de la combinación activa | Cinta — control `resolver__ctx` | `clear` | **Corregido** — antes un caret sin rótulo (`weak`) |
| SHL-08 | Cambiar modo de cálculo (Aula/Completo) | 4 sitios distintos | `preferences`, invocado | Invocada | Entrada de menú, sub-etiqueta «modo» | Menú de documento › Preferencias | `clear` | |
| SHL-09 | Elegir orden de análisis (P-Delta) | TopBar contexto + «Más» | `analysis-setup`, invocado | Invocada | Misma puerta que SHL-07 | Cinta — control `resolver__ctx` | `clear` | |
| SHL-10 | Parámetros avanzados P-Delta | Sólo dentro de «Más», `<details>` colapsado | `analysis-setup`, invocado | Invocada | Misma puerta que SHL-07/09 | Cinta — control `resolver__ctx` | `clear` | Sale de la triple-disclosure que CRI-8 §9.1 #1 marcó como la función más escondida |
| SHL-11 | Cambiar sistema de unidades | TopBar contexto + «Más» | `preferences`, invocado | Invocada | Entrada de menú + **cada campo numérico muestra su unidad activa como confirmación pasiva** | Menú de documento › Preferencias | `clear` | Ver nota en §2 sobre por qué no lleva chip propio |
| SHL-12 | Cambiar idioma | Welcome + «Más» | Welcome + `preferences`, invocado | Persistente (Welcome) / Invocada | Entrada de menú | Menú de documento › Preferencias | `clear` | |
| SHL-13 | Cambiar tema | 4 sitios, uno con lógica duplicada en Space 3D | Welcome + `preferences` + paleta | Persistente / Invocada | Entrada de menú | Menú de documento › Preferencias | `clear` | La duplicación de lógica en Space 3D se retira (D-15) |
| SHL-14 | Abrir Model Doctor | Icono TopBar (oculto <1024px) + «Más» + paleta + AnalysisStatus + Results fallido | **Cinta, icono permanente con badge de recuento** | Persistente | Icono, nivel 1, nunca se oculta | Cinta | `clear` | **Corregido** — la primera pasada del CÓDIGO de conceptos lo ocultaba con `doctor === 0`; ver §3 |
| SHL-15 | Abrir la hoja de datos (Datasheet) | Icono TopBar (no se oculta en Compact) + paleta | **Cinta, icono permanente** | Persistente | Icono, nivel 1 | Cinta | `clear` | **Corregido** — la primera pasada de esta especificación no le daba ningún icono en la Cinta; ver §3 |
| SHL-16 | Ocultar/mostrar el Inspector | Sólo «Más» › Vistas | **No existe como control** — el resolutor decide la composición | — | — | — | `clear` (transformado) | D-04: era un control manual sobre un problema que ahora resuelve la arquitectura. No es una capacidad perdida — es una decisión que deja de hacer falta |
| SHL-17 | Entrar/salir de «mesa completa» | Sólo «Más» › Vistas | Igual que SHL-16 | — | — | — | `clear` (transformado) | |
| SHL-18 | Contraer el Rail a iconos | Sólo «Más» › Vistas | Igual — es automático por clase (`X2`/`M1`) | — | — | — | `clear` (transformado) | |
| SHL-19 | Redimensionar el Detalle | Borde izquierdo del panel | Sin cambio mecánico — el Detalle sigue siendo redimensionable con `role="separator"` | Contextual | Tirador visible en el borde | Borde del Detalle | `clear` | |
| SHL-20 | Detent de la hoja en táctil | 3 botones en la cabecera | Grip visible (`hoja__grip`) + arrastre, con los 3 botones como alternativa | Contextual | Grip visible en la cabecera de la hoja | Hoja (lámina 12) | `clear` | P-12: ahora responde también al arrastre |
| SHL-21 | Persistencia y conectividad | Chip TopBar + bloque en «Más» | **Chip de persistencia, permanente, junto a la identidad del documento** | Persistente | Icono/chip, nivel 1 | Cinta | `clear` | **Corregido** — no existía ningún control en la primera pasada de esta especificación (`missing`); ver §3 |
| SHL-22 | Exportar y compartir | Menú propio + «Más» (7 repetidas) + 4 comandos de paleta | `output`, invocado, **una sola puerta** | Invocada | Entrada de menú | Menú de documento › «Exportar…» | `clear` | De 21 afordancias a 1 |
| SHL-23 | Avisos transitorios (toasts) | Sobre el lienzo | Sin cambio — canal `status`/`transient` (R-1 de CRI-9) | Persistente (canal) | Aparecen sobre el lienzo | Lienzo | `clear` | |
| SHL-24 | Actualizar la PWA | Aviso propio | Sin cambio | Persistente | Aviso propio | — | `clear` | |

### Modelado (MOD) — 16 capacidades

| ID | Capacidad | Superficie actual | Nueva superficie (corregida) | P/C/I | Cómo se descubre | Primer punto de acceso visible | Estado | Notas |
|---|---|---|---|---|---|---|---|---|
| MOD-01 | Elegir herramienta activa | Rail 164px / dock 5 botones | Riel (168px rotulado) / dock flotante | Persistente | Rail siempre visible | Riel | `clear` | |
| MOD-02 | Crear un nudo | Lienzo, con herramienta activa | Sin cambio | Contextual (canvas-local) | Herramienta en el Riel | Riel → Lienzo | `clear` | |
| MOD-03 | Crear una barra | Lienzo | Sin cambio | Contextual | Riel | Riel → Lienzo | `clear` | |
| MOD-04 | Aplicar/cambiar apoyo | Lienzo + Inspector + Datasheet + Bulk Edit | Riel (rápido) + Detalle (completo) + Datasheet + Bulk Edit (= Detalle con selección múltiple, D-12) | Contextual | Riel + zócalo (verbo cuando aplica) | Riel / zócalo | `clear` | |
| MOD-05 | Colocar carga puntual | Lienzo + hoja «Cargas» + Inspector › Cargas | Riel (Crear→Cargar) + dock táctil «Carga» | Persistente/Contextual | Riel, grupo Cargar | Riel | `clear` | El lanzador redundante del Inspector converge en el Riel (§9.1 CRI-9 ya lo señalaba) |
| MOD-06 | Colocar carga distribuida | Igual patrón | Igual patrón | Persistente/Contextual | Riel | Riel | `clear` | |
| MOD-07 | Colocar momento | Igual patrón | Igual patrón | Persistente/Contextual | Riel | Riel | `clear` | |
| MOD-08 | Dividir una barra (Split) | Rail «Editar» + hoja «Más» + paleta | **Verbo primario del zócalo** («Dividir») | Contextual | Zócalo, visible sin abrir nada | Zócalo | `clear` | Antes exigía abrir un grupo del rail; ahora es un botón directo con selección |
| MOD-09 | Borrar objetos | Rail + tecla + hoja «Más» | **Verbo primario del zócalo** (icono papelera, siempre presente) | Contextual | Zócalo | Zócalo | `clear` | Con deshacer inmediato accesible (P-20) |
| MOD-10 | Transformar selección (mover, rotar, espejo…) | Lanzador condicional en rail | Verbo del zócalo (`⋯` o primario según frecuencia) | Contextual | Zócalo | Zócalo | `clear` | |
| MOD-11 | Entrada numérica rápida | Sobre el lienzo, durante colocación | Sin cambio | Contextual (workflow) | Aparece durante el gesto | Lienzo | `clear` | |
| MOD-12 | Repetir (Repeat) | **Sólo tecla `R`, sin afordancia visible** | **Verbo del desbordamiento del zócalo**, con atajo mostrado | Contextual | `⋯` del zócalo | Zócalo → `⋯` (lámina 18) | `clear` | **Corregido** — antes `missing`; demostrado abierto por primera vez en una lámina |
| MOD-13 | Copiar / pegar / duplicar | **Sólo por teclado, sin botón, menú ni comando de paleta** | **Verbos del desbordamiento del zócalo**, con atajo mostrado | Contextual | `⋯` del zócalo | Zócalo → `⋯` (lámina 18) | `clear` | **Corregido** — antes `missing`, el hallazgo #4-5 de CRI-8 §9.1 |
| MOD-14 | Generar estructura completa | Botón rail «Crear» + «Más» + paleta | Riel, grupo Crear | Persistente | Riel | Riel | `clear` | |
| MOD-15 | Medir con herramienta de dimensión | Rail «Inspeccionar» + «Más» + paleta | Riel, grupo Anotar | Persistente | Riel | Riel | `clear` | |
| MOD-16 | Corte para leer valores internos | Rail «Inspeccionar» + «Más» + paleta | Riel, grupo Anotar + verbo del zócalo «Corte aquí» cuando hay selección con resultado | Persistente/Contextual | Riel + zócalo | Riel | `clear` | Con causa explicada si no hay análisis vigente (D-14, §13.3) |

### Selección (SEL) — 7 capacidades

| ID | Capacidad | Superficie actual | Nueva superficie (corregida) | P/C/I | Cómo se descubre | Primer punto de acceso visible | Estado | Notas |
|---|---|---|---|---|---|---|---|---|
| SEL-01 | Seleccionar un objeto | 5 puertas (lienzo, Datasheet, paleta, Doctor, Results) | Mismas 5 puertas, `Selection` único | Contextual (fuente) | Cada superficie | Lienzo (principal) | `clear` | Fortaleza preservada (§18 #1) |
| SEL-02 | Resolver solapados con puntero | Automático | Selector de candidatos (§7.3) | Contextual | Se abre por disparador propio de StructureCo — ≥2 candidatos en la región de captura, o hit-regions solapadas (§7.1) | Lienzo | `clear` | Corregido en la pasada de precisión: WCAG 2.5.8 es un piso de tamaño/espaciado, no el disparador |
| SEL-03 | Selección con marco | Lienzo | Lienzo, + semántica direccional propuesta (§7.5) | Contextual | Arrastre sobre el lienzo | Lienzo | `clear`/`ABIERTA-3` | El marco en sí es claro; la semántica direccional es adición declarada, no decidida |
| SEL-04 | Multiselección acumulativa | Lienzo (Shift+clic, marco) + Datasheet | Sin cambio | Contextual | Igual | Lienzo / Datasheet | `clear` | |
| SEL-05 | Deseleccionar | `Escape` + clic en fondo | Sin cambio | Contextual | Igual | Teclado / lienzo | `clear` | |
| SEL-06 | Filtro de selección por tipo | Inspector › Vista › «Precisión CAD», triple disclosure | **`view`, invocado, itemizado** («Precisión CAD» con su propia sección) | Invocada | Disparador de capas del lienzo | Lienzo — disparador de capas (lámina 19) | `clear` | **Corregido** — antes `weak` (descrito sólo como «`view` es dueño único», sin estructura). Era la 3.ª función más escondida (CRI-8 §9.1) |
| SEL-07 | Precisión táctil — ver bajo el dedo | Automático | Lupa, fase 2 del contrato de precisión | Contextual | Se activa con el gesto | Lienzo | `clear` | |

### Lienzo (CNV) — 10 capacidades

| ID | Capacidad | Superficie actual | Nueva superficie (corregida) | P/C/I | Cómo se descubre | Primer punto de acceso visible | Estado | Notas |
|---|---|---|---|---|---|---|---|---|
| CNV-01 | Encuadrar, acercar, alejar | Chrome flotante, esquina | Grupo «Cámara», flotante, nunca degrada | Persistente | Esquina inferior derecha | Lienzo | `clear` | |
| CNV-02 | Orientarse con el minimapa | Esquina, siempre visible | **Apagado por defecto** (§5.3, CB-3) | Invocada | Disparador de capas › activar minimapa | Lienzo — disparador de capas | `clear` (cambio de defecto) | No es un hueco: es una degradación deliberada y medida (rompe CB-3 en Compact si está siempre encendido) |
| CNV-03 | Controlar qué capas se ven | Disparador flotante + 5 presets en paleta | `view`, invocado, sección «Capas del lienzo» | Invocada | Disparador de capas, **con badge cuando hay contenido plegado en Compact** | Lienzo — disparador de capas (lámina 19) | `clear` | **Corregido** — el badge es nuevo; antes el plegado en Compact no tenía ninguna señal (`weak`) |
| CNV-04 | Activar rejilla y snap | Inspector › Vista + comandos de paleta + chips informativos | Chips **accionables** (Expanded/Medium) + `view` (Compact, con badge) | Persistente/Invocada | Chips en el lienzo | Lienzo (lámina 02) / `view` en Compact | `clear` | Antes los chips eran sólo informativos (P-11 los corrige) |
| CNV-05 | Leer posición y escala | Chrome de estado | Grupo «Cámara» | Persistente | Esquina inferior derecha | Lienzo | `clear` | |
| CNV-06 | Saber en qué modo está el lienzo | Esquina superior | Grupo «Estado del gesto», nunca degrada | Persistente | Esquina superior izquierda | Lienzo | `clear` | Incluye ahora «· vista global» cuando aplica (lámina 02b) |
| CNV-07 | Navegar el modelo con teclado | El propio lienzo | Sin cambio | Contextual | Tabulación | Lienzo | `clear` | Fortaleza preservada |
| CNV-08 | Arrastrar un nudo | Lienzo | Sin cambio | Contextual | Directo | Lienzo | `clear` | |
| CNV-09 | Exportar el lienzo como imagen | Menú export + «Más» + paleta | `output`, invocado | Invocada | Menú de documento › «Exportar…» | Menú de documento | `clear` | |
| CNV-10 | Modo impresión | Menú export + «Más» | `output`, invocado (mismo destino que CNV-09) | Invocada | Menú de documento › «Exportar…» | Menú de documento | `clear` | |

### Inspector / Detalle (INS) — 7 capacidades

| ID | Capacidad | Superficie actual | Nueva superficie (corregida) | P/C/I | Cómo se descubre | Primer punto de acceso visible | Estado | Notas |
|---|---|---|---|---|---|---|---|---|
| INS-01 | Ver/editar propiedades de la selección | Panel 320px siempre presente | Detalle, **sólo con selección** | Contextual | Aparece con la selección | Detalle | `clear` | |
| INS-02 | Aplicar material de catálogo | Inspector | Detalle | Contextual | Detalle, sección Propiedades | Detalle | `clear` | |
| INS-03 | Aplicar sección de catálogo | Inspector | Detalle | Contextual | Detalle | Detalle | `clear` | |
| INS-04 | Editar varios a la vez (Bulk Edit) | Sustituye la ficha individual | Detalle con cardinalidad múltiple (D-12) | Contextual | Detalle, con «mixto» explícito | Detalle | `clear` | |
| INS-05 | Gestionar casos y combinaciones | Inspector › Cargas, única puerta | `analysis-setup`, invocado | Invocada | Chip etiquetado junto a Resolver | Cinta — `resolver__ctx` | `clear` | |
| INS-06 | Ajustar visualización (~20 controles) | Inspector › Vista | `view`, invocado, itemizado (capas + snap + filtro) | Invocada | Disparador de capas | Lienzo — disparador de capas | `clear` | **Corregido junto con SEL-06** — antes sin estructura declarada |
| INS-07 | Elegir herramienta de carga desde el Inspector | Inspector › Cargas, 5.º lanzador de 5 | **Converge en el Riel** (siempre visible) y en el dock táctil | Persistente | Riel | Riel | `clear` (transformado) | CRI-9 ya lo señaló como duplicación parcialmente innecesaria; en Expanded el rail ya está a la vista |

### Resultados (RES) — 11 capacidades

| ID | Capacidad | Superficie actual | Nueva superficie (corregida) | P/C/I | Cómo se descubre | Primer punto de acceso visible | Estado | Notas |
|---|---|---|---|---|---|---|---|---|
| RES-01 | Leer resumen del análisis | Panel Results | Chip de estado (Cinta) + panel expandido con quick-links | Persistente | Chip de estado | Cinta (lámina 02b) | `clear` | |
| RES-02 | Leer reacciones y localizar la máxima | Panel Results, tabla | `dense`, invocado desde **enlaces del Detalle** y desde **quick-links del chip de estado** | Invocada | Chip «Reacciones» visible en dos sitios | Detalle (con selección) / chip de estado (sin selección) | `clear` | **Corregido** — antes `missing`, `dense` no tenía NINGÚN lanzador visible en ninguna lámina (lámina 20) |
| RES-03 | Leer diagramas N/V/M | Panel Results + overlay | Selector de capa (flotante) + overlay | Persistente | Chips de capa, siempre visibles | Lienzo | `clear` | «Elegir evidencia es elegir capa» |
| RES-04 | Ver la deformada | Panel Results + overlay | Selector de capa (δ) | Persistente | Chips de capa | Lienzo | `clear` | |
| RES-05 | Índice elástico estimado | Tarjeta Results + capa apagada por defecto | Selector de capa (η) + quick-link desde el chip de estado | Persistente/Invocada | Chips de capa + panel de estado | Lienzo / Cinta | `clear` | |
| RES-06 | Entender la fiabilidad | Texto con `title` (invisible sin ratón) | Chip de estado, causa siempre enfocable | Persistente | Chip de estado, `button` con `aria-expanded` | Cinta | `clear` | **Corregido en la base**, D-14, §13.2 |
| RES-07 | Ver líneas de influencia | Pestaña Results | `dense`, invocado | Invocada | Chip «Influencia» — Detalle y quick-links | Detalle / chip de estado | `clear` | **Corregido junto con RES-02** |
| RES-08 | Aprender por qué salió el resultado | Pestaña Results | `dense`, invocado | Invocada | Chip «Aprender» — Detalle y quick-links | Detalle / chip de estado | `clear` | **Corregido junto con RES-02** |
| RES-09 | Cambiar altura/modo del panel | Cabecera del panel | **No aplica** — no hay panel residente que redimensionar | — | — | — | `clear` (transformado) | El resize del Detalle (SHL-19) y el peek de `dense` cubren la necesidad real |
| RES-10 | Procedencia de un número | Tarjeta al pie de Results | Tarjeta de procedencia, colgada del número en Detalle | Contextual | Aparece con el resultado, en el Detalle | Detalle | `clear` | Elevada a objeto de primera clase (§9.3) |
| RES-11 | Localizar objeto de un resultado | 4 emisores, 1 consumidor | Sin cambio — `focus-object` | Contextual (destino) | Botón «Localizar» en cada emisor | Zócalo / Datasheet / Doctor / Detalle | `clear` | Fortaleza preservada |

### Datasheet (DAT) — 10 capacidades

| ID | Capacidad | Superficie actual | Nueva superficie (corregida) | P/C/I | Cómo se descubre | Primer punto de acceso visible | Estado | Notas |
|---|---|---|---|---|---|---|---|---|
| DAT-01 | Ver el modelo como tabla | Drawer inferior modal | Drawer, entorno declarado (§2.4) | Invocada | **Icono permanente en la Cinta** | Cinta | `clear` | **Corregido** — antes `missing` en la Cinta rediseñada; ver §3 |
| DAT-02 | Buscar en la tabla | Campo de búsqueda | Sin cambio | Invocada (dentro de Datasheet) | Campo visible en la barra | Datasheet | `clear` | |
| DAT-03 | Filtrar y ordenar | Chips bajo la barra | Sin cambio, **con recuento y botón de quitar filtros siempre visibles** (§10.3) | Invocada | Chips + recuento «3 de 214» | Datasheet | `clear` | |
| DAT-04 | Seleccionar filas, sincronizar con lienzo | Rejilla | Sin cambio | Invocada | Rejilla | Datasheet | `clear` | |
| DAT-05 | Editar una celda | Rejilla | Sin cambio | Invocada | Rejilla | Datasheet | `clear` | |
| DAT-06 | Pegar un bloque de celdas | `Ctrl+V` | Sin cambio | Invocada | Atajo, pie de ayuda visible | Datasheet | `clear` | |
| DAT-07 | Revisar/aplicar/cancelar cambio pendiente | Panel lateral del drawer | Sin cambio | Invocada | Panel lateral | Datasheet | `clear` | |
| DAT-08 | Editar objeto enfocado desde el panel editor | Panel lateral | Se funde con el Detalle (D-12) — misma ficha, misma cardinalidad | Invocada | Panel lateral, ahora la misma UI que el Detalle | Datasheet | `clear` | |
| DAT-09 | Cambiar de entidad (nudos/barras/cargas) | Barra de la tabla | Sin cambio | Invocada | Barra de la tabla | Datasheet | `clear` | |
| DAT-10 | Enfocar en el lienzo el objeto de la fila | Botón, **cerraba la tabla** | Botón, **la tabla se pliega a `peek`, no se cierra** | Invocada | Botón + banda `peek` | Datasheet → `peek` (lámina 07b) | `clear` | **Corregido en la base**, §10.2 |

### Model Doctor (DOC) — 7 capacidades

| ID | Capacidad | Superficie actual | Nueva superficie (corregida) | P/C/I | Cómo se descubre | Primer punto de acceso visible | Estado | Notas |
|---|---|---|---|---|---|---|---|---|
| DOC-01 | Diagnosticar antes de analizar | Drawer, lateral o inferior según ancho | Drawer, entorno declarado | Invocada | **Icono permanente en la Cinta, con badge de recuento** | Cinta | `clear` | **Corregido** — bug de código que lo ocultaba con 0 hallazgos; ver §3 |
| DOC-02 | Filtrar hallazgos por severidad | Cabecera del drawer | Sin cambio, con recuento por severidad | Invocada | Chips «Críticos · Advertencias · Sugerencias» | Model Doctor | `clear` | |
| DOC-03 | Entender un hallazgo | Tarjeta con disclosure | Tarjeta con qué/por qué/qué hacer, siempre visibles (P-14) | Invocada | Tarjeta, sin disclosure adicional | Model Doctor | `clear` | |
| DOC-04 | Localizar objeto de un hallazgo | Botón, **cerraba el Doctor** | Botón, **el Doctor se pliega a `peek`** | Invocada | Botón + banda `peek` | Model Doctor → `peek` (lámina 08b) | `clear` | **Corregido en la base** |
| DOC-05 | Previsualizar/aplicar corrección | Vista sustitutiva | Igual, con vocabulario corregido (nunca «reparar») | Invocada | Botón «Ver corrección» / «Corrección ambigua» | Model Doctor | `clear` | §11.3 |
| DOC-06 | Reconocer (acknowledge) un hallazgo | Botón de la tarjeta | Verbo dentro de «qué hacer» | Invocada | Tarjeta de hallazgo | Model Doctor | `clear` | |
| DOC-07 | Saltar del hallazgo a la herramienta | Botón de la tarjeta | Igual, con la selección ya hecha al llegar | Invocada | Tarjeta de hallazgo | Model Doctor | `clear` | |

### Persistencia (PER) — 4 capacidades

| ID | Capacidad | Superficie actual | Nueva superficie (corregida) | P/C/I | Cómo se descubre | Primer punto de acceso visible | Estado | Notas |
|---|---|---|---|---|---|---|---|---|
| PER-01 | Guardado automático | Invisible; chip TopBar | **Chip de persistencia, Cinta** | Persistente | Icono junto a la identidad del documento | Cinta | `clear` | **Corregido** — `missing` en la primera pasada de esta especificación |
| PER-02 | Trabajar sin conexión | Chip TopBar | Chip de persistencia (estado «sin conexión») | Persistente | Mismo chip | Cinta | `clear` | Corregido junto con PER-01 |
| PER-03 | Resolver conflicto de revisión | Estado en TopBar; **resolución en otra pantalla** | Chip de persistencia → `recovery`, invocado desde la mesa | Persistente/Invocada | Chip rojo, `aria-haspopup="dialog"` | Cinta → `recovery` (lámina 21) | `clear` | **Corregido** — el hueco de acceso más grave de CRI-8 (§9.2 #1) |
| PER-04 | Migrar proyecto de versión anterior | Invisible, automático | Sin cambio | Persistente | — | — | `clear` | |

### Estados (STA) — 6 capacidades

| ID | Capacidad | Superficie actual | Nueva superficie (corregida) | P/C/I | Cómo se descubre | Primer punto de acceso visible | Estado | Notas |
|---|---|---|---|---|---|---|---|---|
| STA-01 | Entender un estado vacío | Dentro de cada superficie | Generalizado, con siguiente paso (P-13) | Transversal | Cada superficie | — | `clear` | |
| STA-02 | Entender un estado de carga | Cada superficie que carga | Sin cambio | Transversal | Cada superficie | — | `clear` | |
| STA-03 | Entender un análisis obsoleto | Chip TopBar + Results | Chip de estado (`obsoleto`) | Persistente | Cinta | Cinta | `clear` | §13.1 |
| STA-04 | Entender un análisis fallido | Cuerpo Results + chip | Chip de estado (`fallido`) + causa enfocable | Persistente | Cinta | Cinta | `clear` | |
| STA-05 | Entender un control deshabilitado | Disperso | `aria-disabled` + causa, generalizado (D-14) | Transversal | Cada control afectado | — | `clear` | §13.3 |
| STA-06 | Movimiento reducido / alto contraste | Automático | Sin cambio | Transversal | Automático | — | `clear` | |

### Aula (AUL) y Space 3D (S3D) — 5 capacidades

| ID | Capacidad | Superficie actual | Nueva superficie (corregida) | P/C/I | Cómo se descubre | Primer punto de acceso visible | Estado | Notas |
|---|---|---|---|---|---|---|---|---|
| AUL-01 | Recorrido guiado del ejercicio | Banda sobre el lienzo | Sin cambio — fuera de alcance de CRI-10 (diagnóstico, no rediseño) | Persistente (en Aula) | Banda visible | Lienzo | `clear` | |
| AUL-02 | Niveles pedagógicos del resultado | Results › Entender | `dense` › Aprender | Invocada | Detalle / chip de estado | Detalle | `clear` | |
| AUL-03 | Mantener sesión de aula | Invisible | Sin cambio | Transversal | — | — | `clear` | |
| S3D-01 | Trabajar en Space 3D | Pantalla completa propia | Menú de documento › «Space 3D · Experimental» | Invocada | Entrada de menú, marcada | Menú de documento | `clear` | Ver ENT-15 |
| S3D-02 | Navegar el modelo espacial por lista | Panel dentro de Space3D | Sin cambio — dominio congelado (D-15) | Invocada | Dentro de Space 3D | Space 3D | `clear` | |

**Recuento final: 122/122 capacidades de CRI-8 con destino declarado. 0 en `missing`, 0 en `weak`.** Antes de esta corrección había 2 en estado real `missing` (PER-01/02/03 sin chip; `dense` sin lanzador) y 3 en `weak` (SEL-06/INS-06 sin estructura; SHL-07/09/10 con puerta sin rótulo; CNV-03 con plegado sin señal), más un defecto de código verificado (SHL-14/DOC-01 con existencia condicional).

---

## 2. Capacidades que estaban poco claras, y cómo quedaron resueltas

| # | Capacidad | Problema en la primera pasada | Corrección |
|---|---|---|---|
| 1 | **Centro analítico** (`results.center` en el código actual) | La descomposición de Results (D-03) no dejaba ningún equivalente visible cuando no hay selección. | El chip de modo del lienzo añade «· vista global» cuando hay análisis vigente y ninguna selección; y el chip de estado se abre a un panel con el mismo texto («Resuelto · Vista global · sin selección, se muestra el modelo completo») más los enlaces a Reacciones/Índice elástico/Aprender. Lámina 02b. |
| 2 | **Model Doctor** | *Bug de código*: el lanzador sólo existía con `doctor > 0`. Con un modelo limpio, la herramienta de diagnóstico entera desaparecía. | Lanzador permanente en la Cinta; el recuento es un badge superpuesto, nunca una condición de existencia. |
| 3 | **Datasheet** | La especificación nunca le dio un icono en la Cinta rediseñada, a pesar de que hoy no se oculta ni en Compact. | Icono permanente junto a Model Doctor, mismo nivel. Verificado que no desborda la Cinta de Compact (`render-concepts.mjs`, comprobación de desbordamiento). |
| 4 | **Persistencia / guardado / conflicto** | Ningún control en la Cinta corregida. Era el hueco de acceso más grave de CRI-8 (§9.2 #1). | Chip de persistencia permanente junto a la identidad del documento, con estado `guardado`/`guardando`/`sin conexión`/`conflicto`; el estado de conflicto es la puerta directa a `recovery` desde la mesa. |
| 5 | **Casos / combinaciones / contexto de análisis** | El caret junto a «Resolver» no llevaba ningún rótulo — indistinguible de cualquier otro icono. | El caret se sustituye por un control etiquetado con el nombre de la combinación activa («Servicio 1 ▾»), que además funciona como confirmación pasiva de cuál está activa. |
| 6 | **Unidades** | Se relocalizaba a `preferences` sin dejar ninguna confirmación visible de qué sistema está activo. | Cada campo numérico del Detalle y del Datasheet ya muestra su unidad como afijo (`kN`, `m`, `kN·m`) — es la confirmación pasiva. El cambio de sistema vive en el menú de documento, ahora itemizado. |
| 7 | **Snap / Rejilla** | En Compact se plegaban dentro del disparador de capas sin ninguna señal de que seguían existiendo. | Badge de punto («hay más aquí») sobre el disparador de capas cuando algo se plegó dentro. |
| 8 | **Repeat / Duplicate / Copy / Paste / Delete** | Existían sólo en el texto de la especificación (§6.3/§6.4); ninguna lámina los mostraba, así que una revisión visual los sentía «desaparecidos» aunque estuvieran especificados. | Lámina nueva (18) con el desbordamiento del zócalo abierto, los cuatro verbos visibles con su atajo. |
| 9 | **Filtro de selección (SEL-06) y ajustes de visualización (INS-06)** | La superficie `view` se describía sólo como «dueño único de la visibilidad», sin estructura declarada — un hueco que CRI-11 habría tenido que inventar. | Estructura itemizada: Capas del lienzo · Snap · Precisión CAD, con el filtro de selección como su propia sección. Lámina 19. |
| 10 | **Reacciones / Influencia / Aprender** (`dense`) | Ninguna lámina ni ninguna frase decía desde dónde se invoca. Sin selección, no había ninguna ruta en absoluto. | Dos puertas: enlaces al pie de los resultados del Detalle (con selección) y quick-links del chip de estado expandido (sin selección). Láminas 02b y 20. |
| 11 | **Cambiar de proyecto / importar DXF desde la mesa** | Estos dos huecos ya los había nombrado CRI-8 §9.2 (#2 y #3) y la especificación base los dejó sin resolver porque el menú de documento nunca se itemizó. | Menú de documento completo y demostrado (lámina 17): renombrar, cambiar de proyecto, duplicar, importar, exportar, buscar comandos, preferencias, Space 3D, volver a inicio. |

---

## 3. El defecto de código, específicamente

No es sólo una omisión de la prosa: `reports/evidence/2026-08-15-cri-10-ux-system/concepts/parts.js` tenía, antes de esta corrección:

```js
${doctor > 0 ? `<button class="ib">${ICON.doctor}</button>` : ''}
```

Es decir, el propio generador de conceptos —la pieza que se supone demuestra la especificación— **contradecía su propio texto**. El §11 de la especificación base dice «su lanzador sube al nivel 1 de la Cinta con recuento de severidad»; el código lo condicionaba a tener hallazgos. Con `doctor: 0` (el valor por defecto en 8 de las 17 láminas que usan `cinta()`), el botón simplemente no existía.

Esto es exactamente el tipo de discrepancia que una revisión puramente textual no atrapa: el texto sonaba bien, la mitad de las láminas lo desmentían. La corrección:

```js
<button class="ib doctor-launcher" aria-label="Model Doctor${doctor > 0 ? ` · ${doctor} hallazgos` : ''}">
  ${ICON.doctor}${doctor > 0 ? `<i class="badge-count">${doctor}</i>` : ''}
</button>
```

El botón es incondicional; el recuento es un badge que se superpone.

---

## 4. Verificación

`render-concepts.mjs` gana un paso nuevo: **comprobación de desbordamiento de la Cinta en Compact.** Al devolver el icono de Datasheet a la Cinta (junto al de Doctor), la Cinta de Compact gana un elemento más, y en vez de asumir que cabe en 320-390px, se mide contra el DOM real:

```js
const overflowing = await page.$$eval('.frame[data-class="K0"] .cinta', (nodes) =>
  nodes.filter((node) => node.scrollWidth > node.clientWidth + 1)...);
```

Se verificó el gate en los dos sentidos:
- **Positivo** (estado actual): `✓ La Cinta no desborda en ninguna de las 4 láminas Compact.`
- **Negativo** (inyectando un elemento de 600px no-encogible): el script detecta el desbordamiento en las 4 láminas Compact y sale con código 1. Revertido después de la prueba.

```
$ node reports/evidence/2026-08-15-cri-10-ux-system/render-concepts.mjs
✓ La Cinta no desborda en ninguna de las 4 láminas Compact.
28 láminas escritas en reports/evidence/2026-08-15-cri-10-ux-system/shots/
```

El resto de gates de la especificación base no se tocó y sigue en verde: `canvas-budget-cri10.mjs` no depende de nada de lo corregido aquí (esta pasada es sólo Cinta/zócalo/menú/superficies invocadas — ningún cambio de ancho de rail, detalle ni banda).

---

## 5. Láminas actualizadas

**Las 22 láminas originales se regeneran automáticamente** porque comparten `cinta()` y `flotantes()`: corregir esas dos funciones una vez corrige el chrome permanente en las 22 a la vez. Es la razón por la que la corrección se hizo en los componentes compartidos y no lámina por lámina.

**6 láminas nuevas** (`02b`, `17`, `18`, `19`, `20`, `21`), cada una demostrando una capacidad que antes no tenía ninguna imagen que la probara:

| Lámina | Demuestra |
|---|---|
| `02b-vista-global` | Chip de estado expandido, sin selección, con «vista global» y los quick-links a `dense` — el equivalente visible del «Centro analítico» de hoy |
| `17-menu-documento` | Menú de documento abierto, 9 entradas, cierra los huecos #2 y #3 de CRI-8 §9.2 |
| `18-zocalo-desbordamiento` | El `⋯` del zócalo abierto: Copiar, Pegar, Duplicar, Repetir, Cota, Corte |
| `19-vista-invocada` | La superficie `view` abierta: capas, snap, filtro de selección |
| `20-dense-reacciones` | La tabla de reacciones (`dense`), invocada desde el Detalle |
| `21-recuperacion-conflicto` | El chip de persistencia en conflicto, abriendo `recovery` desde la mesa |
| *(las 22 anteriores, regeneradas)* | Ahora muestran: chip de persistencia, lanzador de Datasheet, lanzador de Model Doctor incondicional, y el contexto de análisis etiquetado |

**Total: 28 láminas** (24 día + 4 noche), todas en `reports/evidence/2026-08-15-cri-10-ux-system/shots/`.

---

## 6. Qué NO se inventó

Por instrucción explícita, ninguna capacidad nueva entra sólo para llenar un hueco. Lo que se añadió en esta pasada es, en cada caso, **una puerta a algo que la especificación base o el producto actual ya afirmaban que existía**:

- El chip de persistencia expone PER-01/02/03, que **ya son tareas de CRI-8**, no invenciones.
- Los quick-links a `dense` exponen RES-02/07/08, **ya existentes** como pestañas de Results hoy.
- El menú de documento expone ENT-06/08/09/10/11/15 y SHL-05/08/11/12/13/22, **todas tareas de CRI-8**.
- El desbordamiento del zócalo expone MOD-12/13, **ya existentes** hoy sólo por teclado.
- La superficie `view` expone SEL-06/INS-06, **ya existentes** hoy en el Inspector.
- La lámina 21 (conflicto) usa exactamente la mecánica que CRI-9 U-10 ya verificó en el código actual (`ProjectContext.tsx:38,87-111,161-200`): la copia en conflicto se guarda en la misma transacción antes de lanzar el error. No se inventó ningún comportamiento de recuperación nuevo — se le dio puerta visible al que ya está decidido.

La única pieza sin precedente directo en CRI-8 es el marco de selección con semántica direccional (§7.5 de la base), y **ya estaba marcada como «adición declarada» y como ABIERTA-3**, no como decisión — esta corrección no cambia su estatus.

---

## 7. GAPs reales que quedan

**Ninguno de discoverability.** Las 122 capacidades de CRI-8 tienen destino declarado y puerta visible (§1).

Lo que sigue abierto es lo que ya estaba abierto en la especificación base y no es materia de esta corrección — decisiones que necesitan medición, no una puerta que falte:

| # | Asunto | Por qué sigue abierto |
|---|---|---|
| GAP-1 | Ancho exacto de la Cinta de Compact con Datasheet + Doctor + persistencia + estado + resolver, en el producto real (no en la lámina de 390px fija) | El gate de esta pasada mide el DOM de la lámina, no el producto. CRI-11 debe repetir la medición contra el prototipo real, con nombres de proyecto y combinaciones reales (más largos que «Servicio 1») |
| GAP-2 | ABIERTA-1 de la base (riel rotulado vs. iconos, descubribilidad) | Sigue pendiente de tarea cronometrada, sin cambios en esta pasada |
| GAP-3 | ABIERTA-4 de la base (cuántos verbos primarios caben en el zócalo antes de desbordar, en Compact apaisado, en los dos idiomas) | El zócalo con overflow abierto (lámina 18) es más ancho que el zócalo cerrado; su comportamiento en 844×390 con overflow abierto no se ha medido |
| ~~GAP-4~~ | ~~LEDGER-07 de la base (el aviso de responsabilidad)~~ | **Cerrado en la corrección de precisión posterior** (`reports/2026-08-15-*-cri-10-correccion-precision.md`). Ya no es un gap: es una decisión de UX/producto aprobada — ver §20.2 de la especificación base |

Estos cuatro **ya estaban documentados** en la especificación base (§21) o son la consecuencia directa y medible de esta corrección (GAP-1, GAP-3); ninguno es nuevo por descuido. **Nota de una corrección posterior:** GAP-4 dejó de estar abierto — se mantiene tachado aquí por fidelidad histórica de este informe, no porque siga pendiente.

---

## Archivos modificados por esta corrección

```
reports/2026-08-15-1015-cri-10-correccion-discoverability.md   (este informe)
reports/evidence/2026-08-15-cri-10-ux-system/
  concepts/parts.js            cinta() y flotantes() corregidas; +persistChip, +docMenu,
                                +denseLinks, +estadoQuickLinks, +viewPanel; zocalo() con overflow
  concepts/concepts.css        +.persist, +.badge-count, +.badge-dot, +.docmenu*,
                                +.zocalo-overflow/.zoc-item, +.dense-links, +.estado-panel,
                                +.view-panel/.mini-switch
  concepts/frames.js           +6 láminas nuevas (02b, 17, 18, 19, 20, 21);
                                Detalle ahora incluye denseLinks() en su pie
  render-concepts.mjs          +comprobación de desbordamiento de la Cinta en Compact
  shots/*.png                  28 láminas (24 día + 4 noche), todas regeneradas
```

**Ningún archivo de producción fue tocado.** `src/**`, tokens, componentes, gates y schema siguen intactos — esta es una corrección de la especificación de diseño, no una implementación.

## Cómo verificar

```bash
git diff --stat origin/main -- . | grep -v '^ reports/'
```

```bash
node reports/evidence/2026-08-15-cri-10-ux-system/canvas-budget-cri10.mjs
```

```bash
node reports/evidence/2026-08-15-cri-10-ux-system/render-concepts.mjs
```

El primero debe salir vacío. El segundo no se ve afectado por esta corrección (sigue igual que en la base). El tercero **ahora sale con código 1** si la Cinta desborda en Compact, además de las comprobaciones ya existentes (errores de página, láminas faltantes).

## Confirmación para CRI-11

Con esta corrección, CRI-11 parte de una base donde:

1. **Las 122 capacidades de CRI-8 tienen destino y puerta visible declarados** (§1) — nada que inventar en cuanto a dónde vive cada función.
2. **El chrome permanente de la Cinta está completo y demostrado**: identidad, persistencia, deshacer/rehacer, aviso, Datasheet, Model Doctor (con badge), estado del análisis, contexto de análisis etiquetado, Resolver. Las 22 láminas originales lo muestran de forma consistente porque comparten el mismo componente.
3. **Las tres superficies que antes eran cajas negras** (`view`, `dense`, menú de documento) **tienen estructura itemizada y una lámina que las demuestra abiertas** — CRI-11 no tiene que decidir su contenido desde cero.
4. **El hueco de acceso más grave de CRI-8 (§9.2 #1, recuperación de conflicto) y los dos siguientes (#2 cambiar de proyecto, #3 importar DXF) quedan cerrados** con una puerta visible desde la mesa.
5. La dirección **«la mesa y el instrumento»** no cambió: sigue habiendo sólo tres superficies permanentes, el zócalo sigue trayendo las acciones al objeto, y Results sigue sin ser un panel. Lo que cambió es que cada pieza de esa composición ahora tiene una puerta que un usuario nuevo puede encontrar sin haber leído la especificación.
