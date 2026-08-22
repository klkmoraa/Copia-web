# CRI-10 — Welcome: segunda pasada, reestructura real

**Fecha:** 2026-08-15 21:00
**Agente:** Claude Code
**Rama:** `research/cri-10-ux-system`
**Evoluciona:** `d9d64c3` (Welcome recuperada — pórtico 3D, tarjetas, dos velocidades)
**Clasificación:** `SPEC/DESIGN` — reestructura de una pantalla dentro de CRI-10. No toca `src/**`.

> **Por qué esta pasada es distinta de la anterior.** La pasada `d9d64c3` recuperó piezas que faltaban (pórtico 3D, lanzadores, hub, vitrina) pero las acomodó en la misma arquitectura visual que ya existía — una cabecera pesada, cuatro tarjetas iguales, todo apilado con el mismo peso. El encargo de esta pasada fue explícito: no redecorar, **reestructurar**. Esta vez cambia qué existe, dónde vive y cuánto pesa cada cosa.

---

## Comparación directa con la pasada anterior

| | Pasada anterior (`d9d64c3`) | Esta pasada |
|---|---|---|
| Cabecera | La Cinta de trabajo completa (Resolver, Datasheet, Doctor, undo/redo) | Cabecera propia y ligera: marca, velocidad, tema, menú — sin controles de análisis que no aplican sin proyecto abierto |
| «Continuar» | Una tarjeta más, en pie de igualdad con «Nuevo ejercicio» y «Explorar 3D» | `.spotlight`: banda propia, tinte de marca, el CTA más grande de la pantalla — antes de cualquier otra acción |
| Lanzadores secundarios | 4 tarjetas iguales (incluía «Continuar») | 3 tarjetas (Proyecto nuevo · Modo Aula · Explorar 3D) — «Continuar» ya se fue al spotlight |
| Pórtico 3D | Flotaba junto al texto, mismo fondo que el resto de la hoja | Vive en `.stage`: la misma superficie que el lienzo real (`--sc-color-bg-canvas`), con marcas de esquina y una leyenda técnica (`PÓRTICO · 2 CRUJÍAS · IPE-240 · A992`) |
| Recuperación | `<details>` plegado dentro del hub — había que abrirlo para verlo | Alerta siempre visible cuando existe, con canto ámbar — nunca escondida |
| Tres pasos (Modela/Carga/Analiza) | Presentes | **Eliminados** — el badge + subtítulo + highlights ya prometen lo mismo; era relleno |
| Superficie de las tarjetas | `--sc-color-surface-1` — el mismo fondo que la hoja que las contiene | `--sc-color-surface-elevated` + canto `border-strong` EN REPOSO |
| Mobile | Cinta truncaba el nombre a «st…»; hub con textos cortados a mitad de palabra | Cabecera de dos botones, sin truncar nada crítico; spotlight con su propio botón a ancho completo |
| Altura total (Expanded, Completa) | 2115px | 1790px — más corta, no más larga, con más contenido útil arriba del pliegue |

---

## Qué se quitó

1. **La Cinta de trabajo entera.** No es un recorte — es una corrección de categoría: la Cinta es la barra de un análisis activo (Resolver, Datasheet, Model Doctor, undo/redo). Welcome no tiene ningún análisis activo. Ponerla ahí no sólo desperdiciaba una fila completa de alto — en Compact la obligaba a truncar el nombre del documento a «st…», que es exactamente el síntoma que se reportó.
2. **Los tres pasos genéricos** (Modela → Carga → Analiza). Es la clase de relleno de onboarding que no le aporta nada a quien ya entendió qué es la herramienta por el badge y el subtítulo — y en la revisión de «qué sobra» de este encargo, era el candidato más claro.
3. **La cuarta posición del grid de lanzadores.** «Continuar» no se eliminó — se promovió, pero eso significa que el grid de cuatro columnas iguales ya no existe.

## Qué se agregó

1. **`.spotlight`** — una banda dedicada para retomar el proyecto más reciente, con miniatura, nombre, estadísticas y un botón «Continuar» del tamaño del CTA principal (mismo token `--sc-gradient-clay-action` que usa el Resolver del resto de la app).
2. **`.stage`** — la vitrina del pórtico 3D: fondo de lienzo real, cuatro marcas de esquina (estética de plano técnico, no decorativas — usan `--sc-color-border-strong`, sin brillo) y una leyenda tipo placa de especificación.
3. **`.recovery`** como alerta de primer nivel, no como detalle plegado.
4. **Cabecera propia (`.wh`)** con icono de tema (sol/luna, según el tema activo) y menú — recuperando lo que `WelcomeScreen.tsx` ya hace en producción con su propio `.welcome-header`, que la pasada anterior había descartado a favor de la Cinta compartida.
5. **Nueve iconos** ya estaban integrados desde la pasada anterior (`compass`, `folderOpen`, `upload`, `cpu`, `cube3d`, `restore`, `pencil`, `folderClock`, `triangleShape`, `commitH`, `sparkles`); esta pasada añade **`sun`, `moon` y `menu`** (mismo origen: `node_modules/lucide-react/dist/esm/icons/{sun,moon,menu}.mjs`, redibujados a `stroke-width:1.8`) para la cabecera nueva.

## Qué se reorganizó

- **Jerarquía de acciones de arriba a abajo:** hero (identidad + 3D) → spotlight (la acción más probable) → trío secundario (empezar algo distinto) → más proyectos + recuperación → vitrina de plantillas. Antes todo tenía el mismo peso visual y el orden no comunicaba prioridad.
- **Highlights** (Rigidez directa / Verificado / PDF) pasaron de pills con sombra (peso de botón) a texto plano con separadores — son prueba de confianza terciaria, no acciones, y ahora se leen como tal.
- **«Archivos y ejemplos» → «Plantillas y ejemplos»**, más preciso: la sección ya no incluye nada que no sea plantilla o import.
- **«Tus proyectos» → «Más proyectos»**: el nombre ahora es literal — es lo que NO está en el spotlight, no todos los proyectos.

## Cómo mejoró mobile

El diagnóstico de la pasada anterior (medido, no supuesto): a 390px la Cinta completa forzaba el nombre del documento a truncarse (`st…`) y las filas de «Más proyectos» cortaban el título a mitad de palabra. Esta pasada:

- Cabecera de dos botones (tema + menú) más la marca — nada se trunca.
- El pórtico va primero (impacto inmediato), copy después.
- El spotlight se reorganiza a dos filas (miniatura+texto, luego el botón «Continuar» a ancho completo) en vez de comprimir un botón a la derecha.
- El trío secundario se apila a una columna con el mismo padding que desktop — nunca se encoge.
- Se midió la altura real de contenido con Playwright antes de fijar el alto de la lámina (2560px) — la pasada anterior había fijado 2000px con el contenido real en 2515px, cortando ~500px de vitrina sin que se notara a simple vista. Esta vez la Completa mobile se ve completa, hasta el pie.

## Cómo se corrigió Noche

Diagnóstico exacto: `.launcher`, `.recientes`, `.tplcard`, etc. usaban `--sc-color-surface-1` — el MISMO token que `.ws__frame`, la hoja que las contiene. En Día eso se disimula porque la sombra clay es visible sobre un fondo casi blanco; en Noche, `--sc-color-surface-1` (`#15232b`) contra sí mismo es, en la práctica, invisible — de ahí «botones demasiado negros». Corrección, sin tocar ningún token de `tokens.css` ni abrir la paleta:

- Toda superficie interactiva sube a `--sc-color-surface-elevated` (`#1e313b` en Noche — un escalón real por encima de `#15232b`).
- El canto pasa de sutil a `1.5px solid var(--sc-color-border-strong)` **en reposo**, no sólo en `:hover` — antes sólo se veía el canto fuerte al pasar el cursor.
- Los chips de icono ganan un anillo de color de dominio (`color-mix(lc 40%, border-strong)`) en vez del canto neutro genérico, así el icono no se funde con su propio chip.
- El pórtico 3D se benefició indirectamente: al vivir ahora en `.stage` con fondo `--sc-color-bg-canvas` (más oscuro que `--sc-color-surface-1`), las columnas de marfil (`--sc-color-clay-ivory`, más claras que el canvas) contrastan mejor que cuando flotaban directamente sobre `--sc-color-bg-app`.

Ninguno de estos cambios toca `tokens.css` — son elecciones de qué token existente usar en Welcome, dentro de la paleta ya cerrada.

## Cómo mejoró el 3D

- **Tamaño:** de 420px a 480px de ancho máximo.
- **Encuadre:** vive dentro de `.stage`, un panel propio con la superficie del lienzo real — deja de ser una ilustración flotando junto al texto y pasa a ser un objeto expuesto en una vitrina.
- **Marcas de esquina técnicas** (estilo visor/plano), en `--sc-color-border-strong` — refuerzan «instrumento de precisión» sin usar ningún brillo ni degradado nuevo.
- **Leyenda tipo placa** (`PÓRTICO · 2 CRUJÍAS · IPE-240 · A992`, en mono) — un pórtico 3D sin ninguna etiqueta se lee como arte; con la leyenda se lee como una pieza técnica con especificación real.
- **Sigue siendo la misma geometría** que `isometricPortal.ts` (sin cambios de esta pasada) — lo que cambió es la puesta en escena, no el álgebra.

## Cómo mejoró el copy

| Antes | Ahora | Por qué |
|---|---|---|
| «Análisis estructural 2D · Aula y Completo» | «Análisis estructural 2D · Aula y Profesional» | «Completo» colisionaba con el propio selector Esencial/Completa — confundía dos cosas distintas |
| «Modela, aplica cargas y resuelve — todo local, con la procedencia de cada número a la vista.» | «Modela, carga y resuelve — local, verificable, sin cuenta.» | Más corto, tres promesas concretas (local / verificable / sin fricción de cuenta) en vez de una frase larga |
| Highlights en pills con icono grande | Highlights en línea, separados por «·» | Ya no compiten visualmente con los CTA reales |
| «Proyecto completo» (lanzador) | «Proyecto nuevo» | «Completo» quedaba ambiguo junto al toggle Completa/Esencial |
| «Nuevo ejercicio» | «Modo Aula» | Lidera con el nombre de la capacidad, no con el verbo genérico — mismo patrón que ya usan «Continuar» y «Explorar en 3D» |
| «Tus proyectos» | «Más proyectos» | Ya no es la lista completa — el más reciente vive en el spotlight |
| «Archivos y ejemplos» | «Plantillas y ejemplos» | Nombra lo que de verdad contiene la sección |
| «Herramienta educativa: verifica datos, unidades y resultados antes de tomar decisiones.» | «Herramienta educativa — verifica datos, unidades y resultados antes de decidir.» | Un poco más corto, mismo mensaje |

## Qué NO cambió (deliberado)

- La geometría del pórtico 3D (`portico3d.js`) — sigue siendo el puerto exacto de `isometricPortal.ts`, sin tocar.
- La paleta — ningún HEX, ningún token de `tokens.css` modificado. Los cambios de contraste en Noche son elección de QUÉ token usar, no un token nuevo.
- La hipótesis Esencial/Completa — sigue siendo hipótesis, sigue siendo la misma app y los mismos componentes en ambos modos.
- Las seis plantillas reales, verificadas contra `defaultProject.ts` en la pasada anterior — no se tocaron.
- «La mesa y el instrumento» — reforzada, no reabierta: el pórtico ahora vive literalmente sobre el mismo token de superficie que la mesa de dibujo real.

---

## Láminas

**4 laminas de Welcome regeneradas** (gate de desbordamiento en verde, sin errores de página ni consola):

| Lámina | Viewport | Nota |
|---|---|---|
| `01-welcome` | 1440×1790, Día, Completa | Altura medida con Playwright antes de fijarse — sin recorte |
| `01b-welcome-esencial` | 1440×970, Día, Esencial | La lámina más corta de las dos pasadas: hero + spotlight + trío, nada más |
| `01d-welcome-compact` | 390×2560, Compact, Completa | Altura corregida (la pasada anterior recortaba ~500px de vitrina sin que se notara) |
| `01-welcome--noche` | 1440×1790, Noche, Completa | Registrada a mano (no con `nightOf()`) para que el icono de tema muestre sol, no luna, estando ya en Noche |

Las otras 34 láminas se regeneraron en la misma pasada del script, sin cambio de contenido.

## Validación

```
✓ La Cinta no desborda en ninguna de las 5 láminas Compact.
38 láminas escritas en reports/evidence/2026-08-15-cri-10-ux-system/shots/
```
`canvas-budget-cri10.mjs`: mismas dos advertencias preexistentes de siempre (chrome flotante + minimapa en 390×844/844×390), no relacionadas con Welcome, documentadas desde la especificación §14.

## Confirmación de alcance

```
$ git diff --name-only origin/main -- . | grep -v '^reports/'
(sin salida)
```

**Todo quedó dentro de `reports/**`.** Ningún archivo de `src/**` se tocó ni se leyó de nuevo en esta pasada (ya se había leído en la anterior); los cambios de contraste en Noche son reasignación de tokens EXISTENTES dentro del concepto, no ediciones a `tokens.css`.

Archivos modificados:
```
reports/2026-08-15-2100-cri-10-welcome-reestructura.md   (este informe)
reports/evidence/2026-08-15-cri-10-ux-system/
  concepts/concepts.css   Welcome reescrita de nuevo: .wh, .hero3, .stage, .spotlight,
                           .secondary/.launcher, .recientes, .recovery, .showcase2 —
                           superficies subidas a surface-elevated + border-strong en reposo
  concepts/frames.js      welcome() reestructurada; 01-welcome--noche registrada a mano
                           (ya no con nightOf()) para el icono de tema correcto
  concepts/parts.js       +3 iconos (sun, moon, menu)
  shots/*.png              38 láminas (4 de Welcome con cambio real de contenido)
```

## Pendiente real

1. El mismo pendiente de la pasada anterior sobre `src/styles.css:2161` vs `:3677` (`.canvas-layer-switch`) sigue sin tocar — no era parte de este encargo.
2. Esta pasada no midió el nuevo layout contra usuarios reales — sigue siendo una propuesta de diseño, no un resultado validado. La reestructura del spotlight en particular (sacar «Continuar» del grid) es la apuesta más fuerte de este informe y la más valiosa de probar primero en CRI-11.
