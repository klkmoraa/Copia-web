# CRI-10 — Entrada: rediseño total (flujo de hojas, pórtico clay material, copy nuevo)

**Fecha:** 2026-08-15 23:30
**Agente:** Claude Code
**Rama:** `research/cri-10-ux-system`
**Evoluciona:** `4039c5c` (Welcome reestructurada, segunda pasada)
**Clasificación:** `SPEC/DESIGN` — rediseño de la entrada dentro de CRI-10. No toca `src/**`.

> **Qué se pidió y qué se hizo.** Tres cosas: 3D mucho más real y con textura clay; titular nuevo (fuera «Analiza estructuras con claridad»); y la pantalla de inicio convertida en una app iOS con varios pasos e interfaces que se despliegan. Las tres están hechas, y la entrada dejó de ser una pantalla para pasar a ser un **flujo**.

---

## 1. El 3D: de polígonos planos a material

### Por qué NO se trajo un motor 3D

Se evaluó three.js / regl / babylon y se descartó con razones, no por comodidad:

1. `StructuralPortalHero.tsx` **ya documenta la decisión en producción**: la escena es estática (cámara ortográfica fija, sin órbita, materiales mate sin reflejos). Un motor costaría ~200 KB gzip y una segunda implementación del mismo dibujo para producir el mismo fotograma.
2. **El color tiene que salir de `tokens.css`.** Un motor WebGL no lee variables CSS: habría que duplicar la paleta en JS, rompiendo la regla de paleta única que gobierna todo CRI-10.
3. El pipeline de estas láminas es una **captura estática headless**, que es justo donde WebGL se vuelve menos reproducible.

Lo que sí es un pipeline de sombreado real, corre en el compositor del navegador y lee tokens: **los filtros SVG**. Ahí se construyó el material.

### El stack de material, capa por capa

| Capa | Técnica | Qué aporta |
|---|---|---|
| Grano de superficie | `feTurbulence` (fractalNoise, semilla fija 17) → `feDiffuseLighting` con `feDistantLight` → mezclado en `overlay` y recortado al alfa | Relieve mate real. **Sin `feSpecularLighting` a propósito**: un especular convierte la arcilla en plástico |
| Volumen interno | Gradiente de caída por cara, distinto según orientación (top / left / right), en `soft-light` | Cada cara deja de ser un polígono de color plano |
| Canto redondeado | `stroke` del propio color + `stroke-linejoin: round` | La arcilla no tiene aristas vivas — es la diferencia entre una caja de cartón y una pieza modelada |
| Oclusión ambiental | Elipse oscura en la junta columna–zapata, **inyectada en el flujo de pintura** | Las piezas se apoyan de verdad, no están pegadas |
| Luz de canto | Línea de 1.5px sobre la arista superior del dintel | Filo iluminado. Vive EN el canto, no alrededor de la pieza |
| Contacto con el suelo | Elipse difusa por zapata, color de borde (nunca de marca) | Ancla el objeto a la mesa |

### Dos errores reales encontrados y corregidos durante esta pasada

1. **Grano demasiado grueso.** La primera versión (`baseFrequency 0.62`, `numOctaves 4`, opacidad 0.16) daba estuco rugoso, no arcilla. Corregido a `1.5 / 3 / 0.07` — grano fino y sutil. Además el gradiente de caída empezaba en blanco al 0.30 y lavaba el marfil; ahora domina el negro y la pieza gana forma en vez de perderla.
2. **La oclusión ambiental se pintaba encima de todo** y dejaba un manchón gris a media altura de cada columna (visible en el primer render). La sombra de una columna sobre su zapata tiene que pintarse **después de la zapata y antes de la columna**: ahora se inyecta en el flujo de pintura justo antes de la primera cara de cada columna, así la mitad que cae sobre la zapata se ve y la mitad que caería sobre el fuste queda tapada por el propio fuste — que es como se comporta una oclusión de contacto real.

**La geometría no cambió.** Misma proyección isométrica, misma luz, mismas proporciones de `DEFAULT_PORTAL`. Los tres shades siguen siendo exactamente `0.8345 / 0.7027 / 0.5840`, verificados con Node contra el valor documentado en `styles.css`. Lo que cambió es el render, no el álgebra.

También se resolvió una colisión que habría aparecido con varias láminas en la misma página: cada `<svg>` genera sus `<defs>` con **sufijo único de instancia**, así el filtro de una lámina no puede aplicarse a otra.

---

## 2. La entrada: de una pantalla a un flujo de hojas

### Estructura nueva

```
Paso 1 · Bienvenida     → identidad + pórtico clay material
Paso 2 · Cómo trabajas  → aterriza Esencial/Completa como ELECCIÓN del usuario
Paso 3 · Por dónde      → lista agrupada con los cinco arranques reales
La Mesa                 → el destino, y la entrada directa de quien ya volvió
```

Quien ya tiene proyectos **no repite el onboarding**: entra directo a la Mesa («Ya tengo proyectos aquí» en el paso 1, y «Saltar» en la cabecera de cada hoja).

### Lenguaje iOS traducido a arcilla, nunca a vidrio

| Patrón iOS | Cómo se resolvió en clay |
|---|---|
| Asa de arrastre de hoja | Cavidad hundida en la propia superficie (`--sc-shadow-clay-pressed`), no una barra flotante |
| Pila de hojas | Dos hojas fantasma asoman por arriba — el flujo **se ve antes de leerse** |
| Título grande | Alineado a la izquierda, 30px, peso 750, tracking cerrado |
| Puntos de paso | El activo se alarga a 22px, relleno de marca |
| Botón de acción de ancho completo | `.cta` con el mismo gradiente clay del Resolver del resto de la app |
| Lista agrupada con inserción (Ajustes) | El grupo es una **cavidad** y cada fila una superficie dentro de ella, separadas por filete |
| Navegación de hoja | volver · paso · saltar — nunca deja sin salida ni sin contexto |
| Hoja anclada abajo en móvil | Pierde el radio inferior, como una hoja modal nativa |

**Cero `backdrop-filter`, cero desenfoque decorativo, cero glass.** Seleccionado = HUNDIDO (Brandbook §08) en las tarjetas de elección del paso 2.

---

## 3. Copy nuevo

El titular anterior se retira por una razón concreta: **«Analiza estructuras con claridad» describe la categoría, no el producto** — podría firmarlo cualquier competidor.

| Antes | Ahora | Por qué |
|---|---|---|
| «Analiza estructuras con claridad» | **«Tu mesa de cálculo»** | Nombra la dirección de producto ya cerrada («la mesa y el instrumento») y habla de posesión, no de promesa genérica |
| «Modela, aplica cargas y resuelve — todo local, con la procedencia de cada número a la vista.» | «Modela, resuelve y comprueba de dónde sale cada número. Todo ocurre en tu equipo — sin cuenta y sin subir nada.» | «Comprueba de dónde sale cada número» es el diferenciador real (procedencia); «sin cuenta y sin subir nada» es concreto donde «local» era abstracto |
| — (no existía) | «¿Cómo trabajas hoy?» + «Es la misma aplicación y el mismo motor de cálculo. Sólo cambia cuánto se muestra a la vez.» | Convierte una hipótesis interna en una pregunta que el usuario entiende |
| — (no existía) | «¿Por dónde empiezas?» + «Nada de esto se cierra: todo sigue disponible después, desde tu mesa.» | Quita la ansiedad de elegir |
| «Tus proyectos» / «Más proyectos» | «Tu mesa» (saludo) + «Más proyectos» | El saludo es de app, no titular de landing |
| «1 recuperación disponible» | «Quedó trabajo sin guardar» | Habla del hecho, no del mecanismo |
| «Completo» (perfil) | «Profesional» | «Completo» colisionaba con el selector Completa/Esencial |

---

## 4. Un fallo real que esta pasada encontró — y el gate que lo dejó pasar

La Mesa en Compact salía **51px de contenido fuera del marco de 390px**, recortado e invisible. Causa: `.ws__pad` es un `display:grid` con la columna implícita `auto`, que se dimensiona al **max-content** del hijo más ancho — la cabecera ensanchaba la columna entera y arrastraba todo el contenido.

Lo grave no es el bug: es que **el gate estaba en verde**. La comprobación existente sólo medía `.cinta`, y la Mesa nueva ya no tiene Cinta.

Se corrigió lo uno y lo otro:

- `minmax(0, 1fr)` explícito en `.ws__pad` y `.ws__frame`; en Compact la cabecera suelta el wordmark y el sello «LOCAL-FIRST».
- **`render-concepts.mjs` gana una comprobación nueva**: mide cada elemento contra el borde derecho de su propio marco y falla si algo sobresale. Detecta desbordamientos que **no producen scroll** (el marco recorta con `overflow:hidden`, así que `scrollWidth` no los delata). Reporta sólo el ancestro más externo de cada cadena. El SVG queda excluido a propósito: en este cuaderno un dibujo más grande que su marco es lo normal y correcto — `.lienzo` y las miniaturas son mirillas sobre un plano mayor. Lo que persigue es el desbordamiento de **caja**, que siempre es un fallo.

Verificado: el gate nuevo falla con el bug puesto y pasa con el bug quitado.

---

## 5. Láminas

**10 nuevas** (las 4 anteriores de Welcome se eliminaron: la pantalla que documentaban ya no existe).

| Lámina | Viewport | Qué demuestra |
|---|---|---|
| `01a-entrada-paso1` | 1440×900 | Bienvenida + pórtico clay material + pila de hojas |
| `01b-entrada-paso2` | 1440×900 | Elección de modo; seleccionado hundido |
| `01c-entrada-paso3` | 1440×900 | Lista agrupada con los cinco arranques |
| `01-mesa` | 1440×1510 | La Mesa, Completa |
| `01e-mesa-esencial` | 1440×725 | La Mesa, Esencial |
| `01f-entrada-paso1-compact` | 390×844 | Paso 1 en móvil, hoja anclada abajo, sin scroll |
| `01g-entrada-paso3-compact` | 390×844 | Lista agrupada en móvil — mismo componente, no una versión recortada |
| `01h-mesa-compact` | 390×2200 | La Mesa en móvil, ya sin el desbordamiento de §4 |
| `01a-entrada-paso1--noche` | 1440×900 | Pórtico en Noche: AO y contacto suben, luz de canto baja |
| `01-mesa--noche` | 1440×1510 | Cada superficie en `surface-elevated` con canto `border-strong` en reposo |

Todas las alturas se **midieron contra el DOM** antes de fijarse. El paso 1 se ajustó para caber en un 1440×900 real (la hoja medía 954px y no entraba; el pórtico dentro de la hoja se acotó a 340px).

---

## 6. Validación

```
✓ La Cinta no desborda en ninguna de las 5 láminas Compact.
✓ Ningún elemento se sale de su marco en las 44 láminas.
44 láminas escritas
```
`canvas-budget-cri10.mjs`: CB-1..CB-6 en verde en los 11 viewports, 9 clases resueltas. Sin errores de página ni de consola.

## 7. Confirmación de alcance

```
$ git diff --name-only origin/main -- . | grep -v '^reports/'
(sin salida)
```

**Todo quedó dentro de `reports/**`.** Ningún archivo de `src/**` tocado. La paleta no se abrió: cero HEX nuevos, cero tokens modificados — el contraste de Noche se resuelve eligiendo qué token existente usar.

```
reports/2026-08-15-2330-cri-10-entrada-rediseno-total.md   (este informe)
reports/evidence/2026-08-15-cri-10-ux-system/
  concepts/portico3d.js   material clay completo (grano, relieve, caída, canto
                           redondeado, AO intercalada, luz de canto, ids únicos)
  concepts/concepts.css   entrada reescrita: .flow/.sheet2/.pick/.rows/.cta/.dots
                           + .mesa/.resume/.trio; minmax(0,1fr) en los contenedores
  concepts/frames.js      flujo de 3 pasos + Mesa; 10 láminas
  concepts/parts.js       (sin cambios en esta pasada)
  render-concepts.mjs     +gate de desbordamiento de caja por marco
  shots/*.png             44 láminas (10 nuevas, 4 eliminadas)
```

## 8. Pendiente real

1. **El flujo es estático en las láminas.** Las transiciones entre hojas (empuje lateral, la hoja saliente que se encoge al fondo de la pila) están descritas pero no animadas — es lo primero que hay que prototipar en CRI-11, porque la sensación de app nativa depende tanto del movimiento como de la forma.
2. **La elección del paso 2 no está conectada** a la preferencia persistente de Esencial/Completa. Sigue siendo la misma hipótesis, ahora con una puerta de entrada; validarla sigue pendiente.
3. `src/styles.css:2161` vs `:3677` (`.canvas-layer-switch` sin cavidad en una de las dos variantes) — heredado, sin tocar.
4. El pórtico usa `IPE-240 · A992` en la placa de especificación: es el material real del `Pórtico de ejemplo` de `defaultProject.ts`, pero la figura 3D es ilustrativa y no está ligada a ese modelo. Si en implementación la placa pasa a leer datos reales, tiene que leerlos de verdad o no ponerlos.
