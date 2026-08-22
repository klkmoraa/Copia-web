# Composición compacta: nav bar, barra inferior y una pila para el borde de abajo

**Fecha:** 2026-08-22 15:09
**Agente:** Claude Code
**Rama:** claude/apple-design-redesign-cp63k4

## Qué cambió

El rediseño anterior cambió la **materia** (tokens, material, tipografía, radios) y dejó
intacta la **disposición en teléfono**. Esta tanda arregla eso: la barra superior de
Compact pasa a ser una nav bar de tres ranuras, aparece una barra inferior única sobre el
pulgar, el borde de abajo gana un solo dueño, y se borra el panel flotante de capas —que
era el segundo destino de una decisión que sólo debería tener uno—.

Cuatro fallos concretos, con su causa medida y no supuesta:

| Síntoma | Causa | Arreglo |
|---|---|---|
| Los chips de filtro del Model Doctor salían cortados por la mitad | `.model-doctor-filters` es hijo de un flex-column y **todo hijo de una columna flex encoge**: la lista de hallazgos lo aplastaba. El `min-height` estaba en los botones, no en el contenedor, que era quien cedía | `flex:0 0 auto` a los hermanos, `flex:1 1 auto` a la lista, y los filtros pasan a `sticky` |
| «Evidencia» sin materia, pegado al borde, y «Restablecer capas» montado sobre una fila | `.canvas-evidence-layers` y sus tres clases hijas **no tenían ni una regla CSS** en todo el repo | Se borró el panel entero: las capas viven ahora dentro de «Vista», donde el marcado ya tiene materia |
| El menú `⋯` se salía de la pantalla por la izquierda, con las etiquetas cortadas | `.mobile-actions-menu { right:0 }` colgado de un disparador que en teléfono **no está en el borde derecho**. Medido a 390px: 155px de hoja fuera del viewport | En Compact el desbordamiento es una hoja inferior; el popover se conserva sólo donde el disparador sí está en el borde |
| Aviso, entrada por coordenadas, lanzador y dock apilados unos sobre otros | Seis piezas ancladas abajo, cada una con su `bottom` a mano —12px, 16px, 70px, 76px— y ninguna sabía de las otras | Una pila declarada en `tokens.css` §7, con un suelo y escalones que se apilan contra el alto REAL del control |

## Por qué

Los cuatro screenshots que motivaron el encargo eran cuatro fallos de **composición
compacta**, no de estilo: la materia ya estaba bien. La regla 4 del propio sistema
(«ninguna superficie flotante se solapa con otra») se estaba incumpliendo en el teléfono
sin que ningún gate lo viera, porque `verifyFloatingSurfacesDoNotOverlap` vigilaba cuatro
parejas y **sólo en escritorio**.

Dos decisiones se tomaron con el usuario antes de escribir código: la barra superior pasa
a nav bar con el resto del chrome sobre el pulgar, y «Capas de información» se fusiona
dentro de «Vista» borrando el panel flotante.

## Archivos tocados

**La pila del borde inferior**
- `src/design-system/tokens.css` — suelo, alto de barra y tres escalones (§7). Doce
  literales repartidos por cuatro archivos pasan a leerlos.
- `src/styles.css` — `--sc-dock-height` en `:root` bajo el puente de 1023px; entrada
  rápida, avisos y chrome de esquina consumen la pila. Tres variables `--canvas-safe-*`
  se quedaron sin consumidor y se borran.
- `src/features/canvas/phase2.css`, `src/features/workspace/phase1.css` — zócalo, control
  de repetición y superficie de edición estructural sobre la pila.

**Nav bar y barra inferior**
- `src/features/workspace/CompactBottomBar.tsx` — **nuevo**. Ranura de herramienta que
  enseña la ACTIVA, cuatro destinos y «Analizar» aparte con el acento.
- `src/features/topbar/TopBar.tsx` — en K0 la barra queda en marca · título · `⋯`. El
  contenido del desbordamiento se define UNA vez y se presenta como popover o como hoja.
- `src/features/workspace/WorkspaceShell.tsx`, `AppShellLayout` — la barra inferior es
  una fila del shell; el pill flotante de lanzadores sólo existe fuera de Compact.
- `src/features/canvas/ToolRail.tsx` — el dock de seis ranuras se borra; las dos hojas
  parciales («Cargas» y «Más», que dejaban fuera a las cuatro herramientas `primary`)
  pasan a una sola con el catálogo entero. El riel de escritorio se retira del DOM en K0.

**Fusión de capas**
- `src/features/canvas/CanvasLayers.tsx` y su prueba — **borrados**.
- `src/features/canvas/editorLayerCatalog.tsx` — **nuevo**: el catálogo de capas junto al
  reducer que las guarda, no dentro de la presentación que se fue.
- `src/features/inspector/Inspector.tsx` — `LayersSection` dentro de «Vista».
- `src/styles.css` — 50 bloques (~7 KB) del panel flotante, incluida `sc-popover-in`.

**Model Doctor**
- `src/features/model-doctor/ModelDoctor.tsx` · `modelDoctor.css` — se retira la frase
  duplicada (estaba en la cabecera y otra vez en la tarjeta), el riel de color de 4px a la
  izquierda (cuarta señal de una severidad que ya decían tres), «Sin ubicación física
  disponible» (texto muerto donde debería haber acción) y una regla `--bottom` que en K0
  no se aplica nunca.

**Hojas**
- `src/design-system/components/overlays.tsx` · `ui.css` — asa y arrastre para cerrar en
  hojas inferiores, cabecera fija y el glifo de cierre circular del sistema (28px pintados
  dentro de un botón que sigue midiendo 44).

**Gates**
- `qa.mjs` — el check de solapes compara TODAS las parejas y corre también en Compact; dos
  gates nuevos: ninguna superficie fuera del viewport, ningún hijo del cuerpo de una hoja
  aplastado. 160 checks, ninguno fallido.
- `scripts/qa-topbar.mjs` · `qa-model-doctor.mjs` — esperan a que la composición se
  **commitee** (120ms de tamaño estable) en vez de a 32ms fijos, y buscan el lanzador del
  Doctor donde su composición lo ponga. D-14 exige que Doctor no desaparezca, no que viva
  en un sitio concreto de la pantalla.

## Cómo verificar

```bash
npm run verify   # lint · documentación · frontera protegida · pruebas · build · presupuesto
npm run qa       # 160 checks compuestos en Chromium real
npm run qa:topbar
npm run qa:model-doctor-peek
npm run qa:datasheet-k0
npm run qa:bulk-edit
npm run qa:structure-generator
```

A ojo, a 390×844: abrir el Doctor, abrir «Vista», abrir `⋯`, y colocar un nodo por
coordenadas con algo seleccionado. En ningún momento debe haber dos superficies pisándose
ni una etiqueta cortada.

La frontera matemática (`src/engine/**`, `src/workers/**`, `src/data/**`,
`store/ProjectContext.tsx`, `types.ts`) queda byte a byte idéntica: `verify:protected`
pasa sin `--update`, 38 archivos verificados.

## Pendiente / siguiente paso

- `scripts/qa-model-doctor.mjs` falla en la última fase (Ctrl+K → paleta → Doctor → Escape:
  el foco vuelve a `BODY` en vez de al lanzador). **Comprobado que ya fallaba antes de esta
  tanda**: se reprodujo el mismo fallo, en la misma línea, con las fuentes del commit base.
  El diagnóstico es que `ModalSurface` captura `document.activeElement` cuando la paleta
  aún lo tiene y está a punto de desmontarse; el arreglo es pasar el lanzador por
  `returnFocusTo`, lo que toca el contrato de foco del broker y queda fuera del alcance de
  este rediseño.
- `scripts/qa-structural-edits.mjs` también venía rojo (en base lo bloqueaba justamente el
  pill flotante de lanzadores que aquí se retira). Su recorrido táctil quedó avanzando
  mucho más lejos y se le corrigieron tres rutas, pero no se declara verde.
