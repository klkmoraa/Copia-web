# Rediseño claymorphism · Ciclo 1 (fundamentos + inicio + hero)

- **Fecha**: 2026-08-06
- **Estado**: aprobado, pendiente de plan de implementación
- **Alcance**: fases 1, 2 y 3 del encargo. Las fases 4 (mesa de trabajo), 5 (Modo Aula,
  importación, oscuro) y 6 (responsive completo, accesibilidad, limpieza) son ciclos
  posteriores con su propio spec.
- **Referencia visual**: mockup claymorphism del inicio (desktop + móvil) aportado por el
  usuario. Es dirección visual, no plantilla.

---

## 1 · Problema

`structureCo` acaba de recibir en `ac9d821 (AG-015)` un rediseño de dirección *"mesa de
dibujo"*: neutros de grafito frío y bajo croma, esmeralda `#00795F`, superficies planas con
sombra de una sola capa. El encargo pide una dirección distinta —claymorphism moderado:
fondo blanco cálido, superficies con volumen difuso, esquinas amplias, verde más vivo— sin
perder precisión técnica ni densidad en las zonas de trabajo.

No es una capa encima de AG-015. Sustituye su decisión de color y de materia, conservando su
arquitectura de capas de tokens, que es correcta.

## 2 · Decisiones tomadas

Cerradas con el usuario antes de escribir este documento:

| Decisión | Resolución |
| --- | --- |
| Descomposición | Ciclo 1 = fases 1+2+3. Ciclos 2 y 3 después, con la base ya validada. |
| Motor del hero | SVG isométrico procedural. **No** se añaden `three`, `@react-three/fiber` ni `@react-three/drei`. |
| Contenido del hero | Pórtico clay puro, como la referencia. Se retira la lectura técnica del SVG actual. |
| Verde de marca | Se adopta la rampa clay. `theme-color` de `index.html` se actualiza en consecuencia. |
| Sección "Modelar / Cargar / Analizar" | Se conserva, re-vestida en clay. |
| Cabecera del inicio | Continuar + selector de tema + selector de idioma. En móvil, drawer. |
| Presupuesto de rendimiento | Se re-basa el techo tras medir. El gate no se elimina. |

### 2.1 · Por qué no se usa WebGL

El pórtico de la referencia es un objeto estático: cámara ortográfica fija, sin órbita, sin
zoom, materiales mate con `metalness: 0` y sin reflejos, y —según el propio encargo—
`frameloop="demand"` con `ContactShadows frames={1}`. Es un render de un solo fotograma de
algo que nunca se mueve. La única animación pedida es una inclinación de 1–2° con el puntero,
que es un `transform` CSS.

El coste del stack (`three` + `@react-three/fiber` + `@react-three/drei`) ronda 700 KB–1 MB
crudos / 200–250 KB gzip. Aunque viaje en chunk diferido, el hero está *above the fold* y se
descarga siempre. Además obliga a mantener dos implementaciones del mismo dibujo (la 3D y el
fallback SVG que el propio encargo exige) y a mockear WebGL en Vitest, porque jsdom no lo
tiene.

El SVG isométrico procedural cumple todos los criterios visuales de la §11 del encargo
—geometría generada por código, sombras suaves, materiales día/noche, sin imagen externa, sin
iframe, sin captura prerenderizada— a ~4 KB, sin dependencias nuevas y sin fallback que
mantener, porque no hay nada que pueda fallar.

## 3 · Restricciones

### 3.1 · Frontera matemática protegida

No se modifica ningún fichero de `src/engine/**`, `src/workers/**`, `src/data/**`,
`src/store/ProjectContext.tsx` ni `src/types.ts`. `npm run verify:protected` debe seguir
verde sin actualizar el baseline.

Se ha verificado que no hace falta tocarlos: `WorkspaceUIContext.Provider` ya envuelve
`AppShell` desde `ProjectContext.tsx:426`, y `useWorkspaceUI` y `updateProjectView` ya están
re-exportados. La pantalla de inicio puede leer y escribir tema e idioma sin cambiar el
store.

### 3.2 · Contrato de contraste del lienzo

`--sc-color-bg-canvas` (`#fafcfb` día / `#060b09` noche) y toda la familia
`--sc-color-technical-*` de la §3 de `tokens.css` **no se tocan**. Son los valores medidos en
`docs/ux-redesign/COLOR_ACCESSIBILITY.md` y el fondo contra el que se midieron. El
claymorphism se detiene en el borde del lienzo, lo que además coincide con la §12 del
encargo: *"sin sombras decorativas, máximo contraste técnico"*.

### 3.3 · Frontera de dependencias del design system

`src/design-system/components/dependencyBoundary.test.ts` impide que la librería de componentes importe
`engine`, `workers`, `store`, `data` o `types`. La primitiva nueva (`Surface`) y el
`ComponentLab` respetan esa frontera. `StructuralPortalHero` vive en `features/welcome/`, no
en `design-system/`, precisamente para no atarlo a esa restricción sin necesidad.

### 3.4 · El contrato de tokens es ejecutable

`src/design-system/tokens.test.ts` no es documentación: es el arnés que gobierna este ciclo.
Impone, entre otras cosas, que ningún CSS de componente contenga un color opaco literal ni
consuma primitivas de color; que `rgba()` sólo aparezca en sombras, filtros y velos; que toda
referencia `var(--sc-…)` resuelva; que las reglas `.welcome*` no lleven elevación sin
tokenizar; y los suelos de contraste ya citados.

Esto obliga a una disciplina concreta: **toda la materia clay se declara en `tokens.css`**.
Una sombra clay escrita a mano dentro de una regla `.welcome-*` de `styles.css` rompe el test
en dos sitios a la vez. Es exactamente el comportamiento que se busca.

### 3.5 · Sin dependencias nuevas

No se añade ninguna dependencia en este ciclo. El encargo autorizaba `three` y sus
compañeros de forma condicional (*"únicamente si son necesarias"*); la decisión de §2.1
concluye que no lo son.

## 4 · Arquitectura

### 4.1 · Capa de tokens

Se extiende `src/design-system/tokens.css` conservando su estructura de nueve capas. **No se
crea `src/styles/`**: sería un árbol paralelo duplicando un sistema que ya tiene la
organización que el encargo propone, y rompería la frontera que `dependencyBoundary.test.ts`
protege.

Cambios por capa:

**§1 · Primitivas.**
Rampa verde nueva, derivada de la referencia y ajustada por contraste medido:

```
--sc-green-50 : #eff9f5
--sc-green-100: #ddf4ec
--sc-green-200: #b6e5d4
--sc-green-300: #57c7a4
--sc-green-400: #27ad83   /* decorativo: caras claras del pórtico */
--sc-green-500: #0b9270   /* decorativo: caras base del pórtico, halos */
--sc-green-600: #08795e   /* acción primaria — blanco encima = 5.37:1 */
--sc-green-700: #06614b   /* hover — blanco encima = 7.45:1 */
--sc-green-800: #054c3b   /* pressed */
```

**Corrección medida.** La referencia sugiere `#0b9270` como verde de acción, pero con texto
blanco encima da **3.92:1**, por debajo del suelo de 4.5:1 que `tokens.test.ts` impone sobre
la pareja `--sc-color-action-foreground` / `--sc-color-action-primary`. La acción primaria es
por tanto `#08795e` (5.37:1). `#0b9270` y `#27ad83` quedan como **decorativos**: caras del
pórtico, halos y superficies suaves, nunca bajo texto blanco.

La misma medición descarta el azul de la referencia como color de foco: `#5caee9` sobre
superficie da **2.32:1** frente al suelo de 3:1. El foco y la selección conservan los azules
oscuros ya medidos. `#5caee9` / `#e2f2fd` y `#9677db` / `#eee8fc` entran **sólo** como
acentos decorativos en contenedores de icono; el violeta sólido del Modo Aula conserva su
valor actual, que sí está medido contra su primer plano.

Neutros: de grafito frío a cálido (`#f4f3f0` app, `#f8f8f6` workspace, `#fbfaf8` superficie
1, `#ffffff` superficie elevada, `#ecedea` superficie pulsada). Texto primario `#24272b`
(14.4:1), secundario `#666d70` (5.05:1), muted `#6b7274` (4.70:1) — todos medidos sobre
`#fbfaf8`. El verde sigue siendo la identidad.

Ningún valor de texto se fija sin validarlo contra su fondo real. El suelo es 4.5:1 para
cuerpo y 3:1 para texto grande e indicadores.

**§4 · Forma.**
La escala de radios se ensancha en el tramo alto y se congela en el bajo:

```
xs   6px  → 8px     (campos numéricos, filas densas)
sm   8px  → 12px
md  10px  → 14px    (inputs técnicos, botones compactos)
lg  14px  → 22px
xl  20px  → 28px    (tarjetas)
2xl 28px  → 36px    (tarjetas destacadas, modales)
hero      → 40px    (nuevo: marco contenedor del inicio)
pill      999px     (sin cambio)
```

Los radios de `xs` a `md` gobiernan campos numéricos, filas del inspector y tablas de
resultados. No suben: el encargo lo prohíbe explícitamente en su §7.

**§5 · Materia.**
Es el grueso del trabajo. Las sombras actuales (`--sc-shadow-raised`, `-lifted`,
`-floating`) son planas: sólo capas exteriores. Las clay componen cuatro:

1. Sombra exterior difusa, desplazada abajo-derecha.
2. Luz interior suave arriba-izquierda (`inset`).
3. Sombra interior muy leve abajo-derecha (`inset`).
4. Borde semitransparente de 1px que separa la superficie del fondo.

Se declaran como `--sc-shadow-clay-{xs,sm,md,lg,floating,pressed}` más
`--sc-shadow-clay-focus` y `--sc-shadow-clay-modal`. **Fuente de luz única a 145°** para toda
la app: ninguna superficie declara su propia dirección.

Los tonos de sombra son grafito verdoso diluido (`rgba(58,70,64,·)`), nunca negro puro. Las
opacidades se calibran en contexto sobre fondo cálido; los valores del encargo son el punto
de partida, no el resultado.

**§9 · Alias de compatibilidad.**
Los alias existentes (`--app-bg`, `--accent`, `--canvas-bg`…) siguen apuntando a los roles
nuevos. Esto es lo que permite que las 2 763 líneas de `styles.css` no se rompan de golpe y
que la migración sea incremental.

### 4.2 · Componentes

**Los 18 componentes `Clay*` del encargo ya existen con otro nombre.** Inventario de
`src/design-system/components/`:

| Encargo | Existente | Fichero |
| --- | --- | --- |
| ClayButton, ClayIconButton | `Button`, `IconButton` | `controls.tsx` |
| ClayInput, ClaySelect, ClaySegmentedControl | `Field`, `Select`, `SegmentedControl` | `controls.tsx` |
| ClayTabs | `Tabs`, `Accordion` | `disclosure.tsx` |
| ClayBadge, ClayPill, ClayStatus, ClayEmptyState | `Badge`, `StatusStrip`, `EmptyState` | `feedback.tsx` |
| ClayTooltip, ClayPopover, ClayModal, ClayDrawer, ClayBottomSheet | `Tooltip`, `Popover`, `Dialog`, `Drawer` | `overlays.tsx` |
| ClayToolbar, ClayPanelHeader | `ToolGroup`, `PanelHeader` | `editor.tsx` |

Crear una familia `Clay*` paralela produciría dos librerías divergiendo y violaría el
criterio de aceptación *"no existen componentes duplicados innecesariamente"*. **El
claymorphism entra como materia en los tokens y como tratamiento en el CSS de los componentes
existentes, no como componentes nuevos.**

Se añade una única primitiva que hoy no existe:

```tsx
// src/design-system/components/surface.tsx
export type SurfaceLevel = 'flat' | 'raised' | 'floating';

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  level?: SurfaceLevel;   // por defecto 'raised'
  pressed?: boolean;      // invierte la iluminación (data-pressed)
  as?: 'div' | 'section' | 'article' | 'aside';
}
```

`Surface` es el envoltorio de elevación clay. `flat` no aplica volumen —es el nivel de las
zonas técnicas densas—, `raised` es la tarjeta normal, `floating` es la elevación de
popovers y hojas. Es CSS puro tras una API tipada; no gestiona estado.

Cada componente existente gana los estados que el encargo pide (default, hover, active,
pressed, selected, focus-visible, disabled, loading, error, success) **sin depender de la
sombra como único indicador**: el estado se comunica combinando posición, borde, contraste y
color. Los botones descienden 1–2 px al pulsarse.

### 4.3 · Inicio

`WelcomeScreen.tsx` conserva su estructura. Su arquitectura de información ya coincide con la
referencia: badge pill, título con última palabra acentuada, subtítulo, tres highlights con
check, tres launcher cards (proyecto completo / nuevo ejercicio / continuar con nodos y
barras reales), showcase con tabs y tarjeta de importar. **No hay reescritura**; hay
re-vestido y tres añadidos:

1. **Marco contenedor.** El contenido se mete en una superficie de radio `hero` (40 px) sobre
   el fondo `#f4f3f0`, como en la referencia. Hoy el inicio es de ancho completo.
2. **Cabecera.** Marca + pill de versión a la izquierda; a la derecha botón verde
   *Continuar* con flecha, selector de tema y selector de idioma. Bajo 768 px, los dos
   selectores se pliegan en un botón hamburguesa que abre el `Drawer` existente.
3. **Hero.** `WelcomeStructureArt` se sustituye por `StructuralPortalHero`.

Tema e idioma se leen y escriben con `useWorkspaceUI()` y `updateProjectView`, ya
disponibles. No se duplica lógica: el patrón es el mismo que `TopBar.tsx:446-447`.

La sección "Modelar / Cargar / Analizar" se conserva, con los números en círculos clay,
coherente con los pasos del Modo Aula que llegarán en el ciclo 3.

### 4.4 · Hero procedural

Dos unidades con una frontera limpia entre geometría y pintura:

```
src/graphics/isometricPortal.ts               ← proyección y caras. TS puro, sin React.
src/features/welcome/StructuralPortalHero.tsx ← render SVG y materiales.
```

**`isometricPortal.ts`** define el pórtico en coordenadas de mundo —dos columnas, dintel
dividido en cuatro módulos, bases de dos cajas apiladas, capiteles, plano cuadriculado— y lo
proyecta a 2D con una matriz isométrica. Devuelve una lista de caras ordenadas por
profundidad, cada una con sus vértices proyectados y su normal.

El sombreado se deriva de la normal contra el vector de luz —el mismo 145° de los tokens—, no
de valores escritos a mano. Cambiar una dimensión no obliga a redibujar nada. Su interfaz
pública es una función `buildPortal(dims): Face[]`; su única dependencia es la aritmética.
Esto lo hace testeable con asserts numéricos en jsdom, sin render.

**`StructuralPortalHero.tsx`** pinta cada cara como un `<path>` con su gradiente. Materiales
por token: columnas en marfil cálido, dintel y bases en verde menta con las caras superiores
más claras y las inferiores más oscuras. En tema oscuro los mismos tokens dan gris cálido
claro y verde más luminoso, sin lógica condicional en el componente. La sombra de contacto es
una elipse difuminada, no un filtro caro.

Se sitúa en `features/welcome/` y no en `design-system/` porque es una pieza de una pantalla
concreta, no una primitiva reutilizable.

**Accesibilidad**: el SVG es decorativo (`role="presentation"`, `aria-hidden="true"`,
`focusable="false"`). Todo lo que comunica está ya en el texto del hero y en los tres chips.

**Movimiento**: inclinación máxima de 2° siguiendo el puntero, aplicada con `transform` CSS
sobre el `<svg>`. Se anula bajo `prefers-reduced-motion: reduce` y bajo `(hover: none)`, de
modo que en táctil queda completamente estática. No rota de forma continua.

### 4.5 · Motion

El encargo pide hovers y presses sutiles. Hoy las tarjetas del inicio los conducen con `m.*`
de la librería `motion`, que es lo que arrastra el núcleo de animación al chunk de entrada
—la deuda que documenta `check-performance-budget.mjs`.

Este ciclo **porta los hovers de tarjeta a CSS** (transición de `box-shadow` +
`translateY`), que es exactamente la corrección que esa nota señala como pendiente. El
`AnimatePresence` del filtro de plantillas se mantiene por ahora: es un reflow de lista, el
caso que `docs/design-system/MOTION.md` reserva para la librería.

Duraciones según la §17 del encargo, declaradas como tokens: hover 140 ms, press 100 ms,
panel 200 ms, modal 240 ms.

## 5 · Flujo de datos

Sin cambios. El rediseño no toca estado:

- El modelo sigue siendo propiedad de `ProjectContext`.
- El tema sigue en `WorkspaceUIContext`.
- El idioma sigue siendo `project.settings.language`.
- La coordinación entre paneles sigue pasando por `workspaceCommands.ts`.

`StructuralPortalHero` **no lee el modelo**. Es un trazo de referencia con geometría fija,
igual que el `WelcomeStructureArt` al que sustituye. La frontera matemática no se consume
desde una superficie visual.

## 6 · Errores y degradación

No hay modos de fallo nuevos que gestionar, y eso es una consecuencia buscada de §2.1:

- **Sin WebGL**: irrelevante. No se usa.
- **SVG no soportado**: no es un escenario real en los navegadores objetivo.
- **jsdom**: `isometricPortal.ts` es aritmética pura y `StructuralPortalHero` renderiza SVG,
  ambos funcionan en el entorno de test sin mocks.
- **Capacidades de `motion` aún no cargadas**: al portar los hovers a CSS, el inicio deja de
  depender de ellas para su estado de reposo. Es una mejora sobre el comportamiento actual,
  documentado en `WelcomeScreen.tsx:207-211`.

## 7 · Testing

**Nuevos:**

| Test | Qué asegura |
| --- | --- |
| `isometricPortal.test.ts` | Proyección correcta: vértices esperados, orden de profundidad, normales normalizadas, geometría estable ante cambios de dimensión. |
| `surface.test.tsx` | Los tres niveles y `pressed` emiten los atributos correctos; `as` respeta el elemento. |
| `WelcomeScreen.test.tsx` (ampliado) | El selector de tema alterna `data-theme`; el de idioma cambia `project.settings.language`; el drawer móvil abre, cierra y devuelve el foco al disparador. |
| `StructuralPortalHero.test.tsx` | Renderiza sin errores en jsdom; es `aria-hidden`; no aparece en el árbol accesible. |
| Reduced motion | Con `prefers-reduced-motion: reduce`, la inclinación no se aplica. |

**Existentes que deben seguir verdes sin tocar expectativas:** `App.test.tsx`,
`tokens.test.ts`, `numericPolicy.test.ts`, `dependencyBoundary.test.ts`,
`controls.test.tsx`, `overlays.test.tsx`, `feedback.test.tsx`, `disclosure.test.tsx`,
`editor.test.tsx`, `modalFocus.test.tsx`.

No se elimina ni se relaja ninguna prueba para que pase la implementación.

## 8 · Verificación

Gate del ciclo:

```
npm run verify   # lint + verify:protected + test + build + verify:perf
npm run qa       # recorrido Playwright desktop + móvil
```

Más revisión manual de: consola sin errores, navegación completa por teclado, foco visible,
tema claro, tema oscuro, 390×844, 1366×768 y zoom 200 %.

**Presupuesto de rendimiento.** El usuario ha autorizado que el presupuesto no limite este
rediseño. Se re-basa el techo de `check-performance-budget.mjs` sobre la medición real tras
el ciclo, documentando la provenance como hace hoy el propio script. **El gate no se
elimina**: existe porque la carga inicial creció de 148 KB a 195 KB gzip sin que nada se
pusiera en rojo, y borrarlo perdería esa señal para los ciclos 2 y 3. Portar los hovers a CSS
(§4.5) debería devolver margen en lugar de consumirlo.

Al cerrar, reporte en `reports/YYYY-MM-DD-HHmm-slug.md` según la skill `change-report`,
commiteado junto al cambio. Sin `git push` sin confirmación explícita.

## 9 · Fuera de alcance

Explícitamente diferido a ciclos posteriores:

- **Ciclo 2** — mesa de trabajo: `WorkspaceShell`, `TopBar`, toolbars, canvas, inspector,
  panel de resultados, modales y menús.
- **Ciclo 3** — Modo Aula, centro de importación, estados vacíos, mensajes de error,
  feedback, y el barrido final de responsive, accesibilidad y documentación.

El tema oscuro se implementa en el ciclo 1 **sólo para las superficies del inicio y para los
tokens**. Su cobertura completa sobre workspace y Aula llega con los ciclos que introducen
esas superficies.

## 10 · Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La paleta cálida degrada el contraste de algún texto heredado en `styles.css` (2 763 líneas). | Los alias de §9 absorben el cambio; se audita el contraste de las superficies del inicio antes de cerrar y se anotan las del workspace para el ciclo 2. |
| El volumen clay se filtra a zonas técnicas densas. | `Surface level="flat"` es el nivel por defecto de esas zonas; el lienzo queda fuera del sistema por §3.2. |
| El pórtico isométrico no alcanza el acabado de la referencia. | La geometría es paramétrica: dimensiones, chaflán y ángulo de proyección se calibran sin redibujar. Si aun así no convence, la frontera de §4.4 permite sustituir el motor sin tocar `WelcomeScreen`. |
| El re-basado del presupuesto oculta una regresión real. | La provenance queda documentada en el script, y la medición antes/después va en el reporte del ciclo. |
