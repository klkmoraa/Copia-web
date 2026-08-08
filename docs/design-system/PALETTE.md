# Paleta — Sistema de diseño structureCo

> Fuente de verdad: `src/design-system/tokens.css` (paleta v4 — "clay", 2026-08-06/07, ciclo 1 del rediseño claymorphism). Contrastes recalculados en esta revisión (ver `reports/` para el detalle de las migraciones v1 → v2 → v3 → v4).
> Dirección visual: **"Clay"** — superficies moldeadas, sombra de contacto y una sola fuente de luz a 145°. La capa 2 (roles semánticos) apenas cambia; lo nuevo vive sobre todo en primitivas decorativas y en una capa de materia dedicada (§11).

## v4 — clay (este ciclo)

- **`--sc-color-action-primary` sube de `--sc-green-500` a `--sc-green-600`.** La ramp esmeralda entera se recalibra (ver §1); el valor de acción pasa de `#0b9270` (el verde de la imagen de referencia) a `#08795e`. Motivo: contraste, no estética — ver "Por qué `#08795e` y no `#0b9270`" más abajo.
- **`--sc-green-500` (`#0b9270`) y `--sc-green-400` (`#27ad83`) quedan decorativos.** Viven en el pórtico del hero, halos y superficies suaves; el contrato de `tokens.test.ts` los excluye a propósito de cualquier par medido contra `action-foreground`.
- **Dos primitivas nuevas puramente decorativas**: `--sc-sky-*` (azul claro) y `--sc-lilac-*` (lavanda), tomadas de la imagen de referencia para los contenedores de icono de las tarjetas del inicio. Ninguna de las dos sirve como color de foco, selección o estado — ver la nota de contraste en §2.
- **Cuatro tokens de material del pórtico** (`--sc-color-clay-ivory(-deep)`, `--sc-color-clay-mint(-deep)`): roles de ilustración, no de interfaz. Ningún texto se apoya en ellos.
- **Materia clay** (nueva subsección en §11): seis niveles de sombra de cuatro capas (`--sc-shadow-clay-xs` → `-pressed`), un canto de superficie (`--sc-clay-edge`) y un degradado base (`--sc-gradient-clay`). Sustituye, para las superficies vestidas de clay, al sistema de elevación plano existente — no lo reemplaza globalmente.
- Sin cambios: capas 3 (roles técnicos) y 4 (alias). El lienzo estructural no se toca en este ciclo.

> **Alcance de esta revisión.** Esta pasada verifica contra `tokens.css` únicamente lo que el ciclo 1 tocó: la ramp esmeralda, `--sc-color-action-*`, las primitivas decorativas nuevas (`sky`/`lilac`) y la materia clay (§11). El resto del documento (superficies §3, texto §4, técnicos §7, …) no se ha vuelto a verificar valor por valor en esta pasada — si algo no cuadra con `tokens.css` fuera de esas áreas, `tokens.css` manda.

Lo que cambió en v3 (histórico):

- **Suelo de grafito, no de menta.** Los neutros pasan de una familia teñida de verde claro a un gris frío de croma bajo, para que el blanco de una superficie sea un escalón real de elevación y no un matiz.
- **Esmeralda en vez de pino.** `--sc-color-action-primary` pasa de `#007a67` a `#00795f`, alineado con el `theme-color` que `index.html` ya declaraba.
- **Segundo tono de marca.** Se añade el cian de trazo (`--sc-cyan-*`) como `--sc-color-brand-secondary`. Vive en el dibujo técnico y en el gradiente de display; **nunca** en controles.
- **La materia es token** (nueva sección 11): vidrio, anillos, halos y gradientes dejan de ser literales por componente.
- Sin cambios: `--sc-color-bg-canvas`, toda la capa técnica (sección 7) y los pares sólidos de éxito/error. Son la base de medida del release 0.8.0 y mover el lienzo obligaría a re-verificar los ocho roles técnicos.

## Arquitectura de capas

Los colores viven en cuatro capas dentro de `tokens.css`; los componentes **solo** consumen las capas 2–4:

| Capa | Prefijo | Consumo permitido |
| --- | --- | --- |
| 1 · Primitivas (ramps) | `--sc-green-*`, `--sc-blue-*`, etc. | **Nunca directo.** Solo se referencian desde roles. El test `src/ui/dependencyBoundary.test.ts` prohíbe primitivas en `ui.css`. |
| 2 · Roles semánticos | `--sc-color-*` | Componentes UI. |
| 3 · Roles técnicos del dominio | `--sc-color-technical-*`, `--sc-color-structure-*`, `--sc-color-tool-*` | Canvas, diagramas, rail de herramientas, métricas de resultados. |
| 4 · Alias de compatibilidad | `--app-bg`, `--accent`, `--axial`, … | CSS heredado en migración; no usar en código nuevo. |

El tema Noche (`:root[data-theme='dark']`) **no es una inversión** del Día: cada rol se reasigna a mano. Está prohibido fabricar el modo oscuro con filtros de inversión, `brightness()` global u opacidad.

## 1 · Primitivas

No se consumen directamente. Se listan como referencia de las ramps.

| Token | Valor | Notas |
| --- | --- | --- |
| `--sc-white` / `--sc-black` | `#ffffff` / `#000000` | El Noche nunca usa negro puro como fondo. |
| `--sc-green-50…900` | `#eff9f5`, `#ddf4ec`, `#b6e5d4`, `#57c7a4`, `#27ad83`, `#0b9270`, `#08795e`, `#06614b`, `#054c3b`, `#033a2d` | **Recalibrada en v4 (clay).** Reemplaza la ramp esmeralda de v3 entera, no solo un paso: valores más saturados y un salto de luminosidad más marcado entre el 400 y el 600 para que el 400/500 lean como "clay" decorativo (hero, halos) y el 600 en adelante lea como acción. `--sc-color-action-primary` ahora resuelve a `--sc-green-600` (`#08795e`), no a `--sc-green-500` — ver la nota de contraste en §2. |
| `--sc-sky-100/500` | `#e2f2fd`, `#5caee9` | **Nuevo en v4.** Acento decorativo tomado de la referencia clay para el contenedor de icono de la tarjeta "Continuar proyecto". Sólo fondo/icono suave — `#5caee9` sobre superficie mide 2,32:1, por debajo del suelo de 3:1 para foco/UI esencial, así que nunca es color de foco, selección ni estado. |
| `--sc-lilac-100/500` | `#eee8fc`, `#9677db` | **Nuevo en v4.** Igual que `--sc-sky-*` pero para la tarjeta "Modo Aula": sólo contenedor de icono y fondo suave, nunca foco ni estado. |
| `--sc-cyan-300/600` | `#8ccfe9`, `#0e6b8f` | **Nuevo en v3.** Cian de trazo: segunda dimensión de marca. Sólo alimenta `--sc-color-brand-secondary` (600 en Día, 300 en Noche). Los escalones intermedios de la familia (`#dcf0fa`, `#3fa9cf`, `#1a86ae`, `#0a536f`) están documentados aquí pero **no se declaran**: una rampa sin consumidor viaja en el chunk de entrada sin pagar su sitio. |
| Familia grafito | `#fafcfb`, `#f4f8f6`, `#eaf0ed`, `#dde5e1`, `#c8d4ce`, `#a3b2ab`, `#7c8b85`, `#5b6b64`, `#41504a`, `#2a3833`, `#16211d`, `#0b1310` | **Nuevo en v3.** Gris frío de croma bajo que sustituye a los neutros mentolados. Por la misma razón que el cian, no se declara como rampa: sólo los escalones con consumidor viven en `tokens.css`, escritos directamente sobre el rol semántico. |
| `--sc-blue-100/300/500/600/700` | `#e8effd`, `#9dbdf6`, `#345fd6`, `#294db7`, `#1847ab` | Azul de interacción: selección / foco / información. `500`/`600` se movieron a un azul más editorial (antes `#2867e8` / `#1e56cc`). |
| `--sc-violet-500` | `#7357d8` | Acento Aula (sin cambios: se mantiene distinto a propósito del resto de la paleta). |
| `--sc-coral-500` | `#c85a45` | **Renombrado** desde `--sc-orange-500` (`#e25d32`). Carga puntual — salmón-coral, ya no naranja. |
| `--sc-red-500` / `--sc-red-700` | `#c73e4d` / `#a92f2f` | Error / foreground de error. `500` se movió a un rojo más rosado (antes `#d44848`). |
| `--sc-amber-500` | `#d88408` | Warning / punto crítico (sin cambios). |
| `--sc-plum-500` | `#7c4db2` | Compresión axial (antes `#8a4da8`). |

## 2 · Identidad y acción

| Token | Día | Noche | Uso previsto | Uso prohibido | Contraste |
| --- | --- | --- | --- | --- | --- |
| `--sc-color-action-primary` | `#08795e` (green-600) | `#45c69a` | Botón primario, CTA, activo de marca, línea de influencia, snap/hover del canvas | Estados de éxito de formularios (usar `state-success`), foco de teclado (usar azul) | 5,37:1 Día / contra `action-foreground` blanco (Noche usa `action-foreground` `#06140f` sobre `#45c69a`) |
| `--sc-color-brand-secondary` | `#0e6b8f` (cyan-600) | `#8ccfe9` (cyan-300) | Segundo tono de marca: dibujo técnico de la bienvenida y `--sc-gradient-display` | Controles, estados, cualquier cosa accionable (ese trabajo es del esmeralda) | 5.97:1 Día / 10.67:1 Noche sobre `surface-1` |
| `--sc-color-action-hover` | `#06614b` (green-700) | `#6ed7b2` | Hover del primario | Texto suelto | Recalibrado junto al nuevo `green-600` (v4) |
| `--sc-color-action-pressed` | `#054c3b` (green-800) | `#35b088` | Pressed del primario | — | Recalibrado junto al nuevo `green-600` (v4) |
| `--sc-color-action-foreground` | `#ffffff` | `#06140f` | Texto/icono sobre fondos de acción | Sobre superficies claras | Par de `action-primary` |
| `--sc-color-action-subtle` | `#eff9f5` (green-50) | `#163027` | Fondos suaves de acción (chips, hovers tenues) | Como color de texto | Fondo, no requiere 4.5:1 propio |
| `--sc-color-aula` | `#7357d8` (violet-500) | `#9a83f0` | Identidad del modo Aula (guía, insignias) | Estados de error/warning | Sin cambios en v2 |
| `--sc-color-aula-foreground` | `#ffffff` | `#171121` | Texto sobre fondo Aula | — | Par de `aula` |

### Por qué la acción primaria es `#08795e` y no el `#0b9270` de la referencia

La imagen de referencia del rediseño clay usa un verde `#0b9270` para sus botones y superficies de acción. structureCo **no lo usa como `--sc-color-action-primary`**, y esto no es una preferencia estética: es una medición.

- `#0b9270` con texto blanco encima mide **3,92:1**.
- El contrato ejecutable `src/design-system/tokens.test.ts` exige **4,5:1** para el par `('--sc-color-action-foreground', '--sc-color-action-primary')` — es la misma verificación que protege cualquier otro par de texto/fondo de la interfaz, no una regla ad hoc para este ciclo.
- `#0b9270` se queda **1,84 puntos de ratio por debajo** del suelo. No es un margen que un ajuste menor de luminosidad cierre sin cambiar el matiz perceptible del verde.
- `--sc-green-600` (`#08795e`) sí lo cumple: **5,37:1** con blanco encima, con margen suficiente para no volver a fallar si el texto o el fondo se ajustan ligeramente en un ciclo futuro.

**`#0b9270` (`--sc-green-500`) y `#27ad83` (`--sc-green-400`) no se descartan: quedan como decorativos.** Ambos viven en el pórtico del hero (`StructuralPortalHero.tsx`, vía `--sc-color-clay-mint`/`-deep`, que no son directamente estos tokens pero comparten familia), en halos y en superficies suaves — lugares donde ningún texto se apoya encima de ellos y donde 3,92:1 nunca es una preocupación de accesibilidad. Lo que no está permitido es promoverlos de vuelta a `--sc-color-action-primary`: eso es exactamente el error que este apartado documenta para que no se repita dentro de unos meses cuando alguien compare la app contra la imagen de referencia y quiera "corregir" el verde para que coincida.

**Los azules y lavandas claros de la referencia tampoco sirven como color de foco.** `--sc-sky-500` (`#5caee9`) contra una superficie mide **2,32:1**, por debajo del suelo de **3:1** que exige un elemento de foco/UI esencial (WCAG 1.4.11). `--sc-color-focus` sigue siendo el azul de interacción (`--sc-blue-500`, §5), no estos acentos decorativos. `--sc-sky-*` y `--sc-lilac-*` se limitan a contenedores de icono y fondos suaves en las tarjetas del inicio (ver §1).

## 3 · Superficies

| Token | Día | Noche | Uso previsto | Uso prohibido |
| --- | --- | --- | --- | --- |
| `--sc-color-bg-app` | `#eaf0ed` | `#070d0b` | Fondo global de la aplicación | Fondos de tarjetas (usar surface-1/2) |
| `--sc-color-bg-canvas` | `#fafcfb` | `#060b09` | Fondo del lienzo estructural; base de validación de la paleta técnica | Paneles de UI |
| `--sc-color-surface-1` | `#ffffff` | `#0f1614` | Superficie base de paneles y tarjetas | — |
| `--sc-color-surface-2` | `#e1e9e5` | `#16201d` | Superficie secundaria: fondos de segmented, hovers, iconos contenedores | Texto |
| `--sc-color-surface-elevated` | `#ffffff` | `#1d2825` | Popovers, diálogos, drawers (elevación real: en Noche es más clara que surface-1) | Fondos planos extensos |
| `--sc-color-surface-inset` | `#dbe4df` | `#0a100e` | Superficies hundidas (wells, áreas rebajadas) | — |
| `--sc-color-surface-toolbar` | `#f8fbfa` | `#111a17` | Rail de herramientas y topbar | — |
| `--sc-color-surface-input` | `#ffffff` | `#111a17` | Fondo de campos de entrada | — |

### Bordes y divisores

| Token | Día | Noche | Uso previsto |
| --- | --- | --- | --- |
| `--sc-color-border` | `#c8d4ce` | `#26312d` | Borde estándar de controles y paneles |
| `--sc-color-border-soft` | `#e3eae6` | `#1c2522` | Bordes de baja jerarquía (headers de modal, filas) |
| `--sc-color-border-strong` | `#93a49c` | `#43594f` | Bordes enfatizados, scrollbars |
| `--sc-color-divider` | `#dfe7e3` | `#1a2320` | Líneas divisorias puras |

## 4 · Texto

| Token | Día | Noche | Uso previsto | Uso prohibido | Contraste |
| --- | --- | --- | --- | --- | --- |
| `--sc-color-text-primary` | `#0c1a15` | `#f3f8f6` | Texto principal, títulos, valores decisivos | — | 17.88:1 / 17.09:1 |
| `--sc-color-text-secondary` | `#3a4f47` | `#b6c6bf` | Párrafos secundarios, descripciones, instrucciones | — | 8.79:1 / 10.32:1 |
| `--sc-color-text-muted` | `#5b6f66` | `#8ea099` | **Solo** metadatos auxiliares de tamaño suficiente | Párrafos, instrucciones o valores que afecten una decisión (usar secondary/primary) | Regla explícita en COLOR_ACCESSIBILITY.md |
| `--sc-color-text-disabled` | `#93a09a` | `#66716d` | Controles deshabilitados | Nunca comunica información indispensable por sí solo | Exento de AA por estado |
| `--sc-color-text-inverse` | `#ffffff` | `#0b1310` | Texto sobre fondos oscuros/claros invertidos (tooltips) | — | — |
| `--sc-color-text-link` | `#294db7` (blue-600) | `#8db4ff` | Enlaces | Botones primarios | 7.40:1 Día (verificado en el PDF de paleta v2) |
| `--sc-color-text-technical` | `#445450` | `#bfcac5` | Texto técnico de apoyo (etiquetas de magnitudes) | — | — |
| `--sc-color-text-unit` | `#78857f` | `#929d98` | Unidades junto a valores numéricos | Valores en sí | — |

## 5 · Interacción, foco y selección

| Token | Día | Noche | Uso previsto | Uso prohibido | Contraste |
| --- | --- | --- | --- | --- | --- |
| `--sc-color-focus` | `#345fd6` (blue-500) | `#86a8ff` | Focus ring universal (outline 3px) | Color activo genérico de herramientas | 5.59:1 / 7.73:1 contra `surface-1` |
| `--sc-color-selection` | `#dce9ff` | `#18385e` | Relleno de selección (fila, área) | Texto | Fondo |
| `--sc-color-selection-stroke` | `#345fd6` | `#78a8ff` | Contorno de selección en canvas y UI | — | Noche difiere ahora de `technical-reaction` (`#9baaff`); ya no coinciden por accidente |
| `--sc-color-info` | `#345fd6` | `#86a8ff` | Información neutral | — | = focus |

**Regla:** selección/foco = azul, siempre. El azul de interacción no se usa como color activo de herramientas; las reacciones (azul técnico) conservan su rol solo dentro de la representación estructural.

## 6 · Estados

| Token | Día | Noche | Uso previsto | Uso prohibido | Contraste |
| --- | --- | --- | --- | --- | --- |
| `--sc-color-state-success` | `#2b7a3d` | `#7ad96b` | Confirmaciones, validación positiva | Marca (usar action-primary) | Separado del verde de marca a propósito (v2) |
| `--sc-color-state-warning` | `#d88408` (amber-500) | `#f0aa3c` | Advertencias, resultados obsoletos | Texto pequeño en Día (usar `warning-foreground`) | Sin cambios |
| `--sc-color-state-warning-foreground` | `#8a4f00` | = warning (`#f0aa3c`) | Texto de warning legible | — | 6.56:1 / 8.98:1 |
| `--sc-color-state-error` | `#c73e4d` (red-500) | `#ff7586` | Errores, acciones destructivas, geometría inválida | Texto pequeño en Día (usar `error-foreground`) | Más rosado que la v1, se separa del naranja/coral de carga |
| `--sc-color-state-error-foreground` | `#a92f2f` (red-700) | = error (`#ff7586`) | Texto de error legible | — | 6.70:1 / 6.95:1 |
| `--sc-color-state-critical` | `#b3261e` | `#ff8a80` | Severidad crítica (escalón sobre error) | — | Sin cambios en v2; medir antes de usarlo como texto pequeño |
| `--sc-color-state-info` / `-loading` | `#345fd6` | `#86a8ff` | Información / progreso | — | = focus |
| `--sc-color-state-stale` | = warning | = warning | Resultados desactualizados | — | Alias |
| `--sc-color-state-pending` | `#5f736a` | `#8d9895` | Estados pendientes/neutros | — | = text-muted |

`--sc-color-state-valid` y `--sc-color-state-invalid` se eliminaron el
2026-08-03. La migración v2 los había dejado con los valores de la v1 y este
documento pedía revisar si debían converger con `state-success`/`state-error`;
al revisarlo se comprobó que **ningún archivo del proyecto los consumía**. La
validación de formularios usa `--sc-color-state-error-foreground`
(`.sc-field__error` en `ui.css`), no estos alias. Se quitaron en vez de
recalibrarlos: eran tokens muertos que solo podían volver a desincronizarse.

## 7 · Técnicos / estructurales (canvas y diagramas)

Paleta v2: familias más separadas entre sí para reducir confusión visual. La carga puntual dejó de ser naranja (`#e25d32` / `#ff825c`) y ahora es un salmón-coral (`#c85a45` / `#ff7d66`); el resto de roles técnicos conserva su familia de matiz pero con tonos recalibrados. Contrastes recalculados contra `bg-canvas` en esta revisión.

| Token | Día | Contraste | Noche | Contraste | Magnitud |
| --- | --- | ---: | --- | ---: | --- |
| `--sc-color-technical-load` | `#c85a45` | 4.07:1 | `#ff7d66` | 7.91:1 | Carga puntual (salmón-coral, ya no naranja) |
| `--sc-color-technical-axial` | `#006b9a` | 5.71:1 | `#6bcbf1` | 10.79:1 | Axial N (se mantiene azul, sin cambio de familia) |
| `--sc-color-technical-shear` | `#2f7d46` | 4.92:1 | `#78dc94` | 11.76:1 | Cortante V / carga distribuida |
| `--sc-color-technical-moment` | `#b23b6f` | 5.44:1 | `#ff79ac` | 8.10:1 | Momento M |
| `--sc-color-technical-deformed` | `#007d8a` | 4.74:1 | `#5bdae2` | 11.86:1 | Deformada |
| `--sc-color-technical-reaction` | `#4a5fd1` | 5.30:1 | `#9baaff` | 9.05:1 | Reacciones (ya no comparte el primitivo con `focus`) |
| `--sc-color-technical-dimension` | `#8a6800` | 5.02:1 | `#ffd56a` | 14.14:1 | Cotas |
| `--sc-color-technical-axis` | `#8b4d2f` | 6.37:1 | `#e6a57a` | 9.46:1 | Ejes / cortes |

**Uso prohibido transversal:** los colores técnicos no son tokens de estado. Un resultado correcto no se pinta con `technical-shear`, ni un error con `technical-moment`, aunque los tonos sean cercanos.

### Roles estructurales formalizados (Sección 12 del sistema)

Mapean sobre los técnicos verificados. Los marcados **reservado** documentan intención sin alterar la codificación actual del canvas.

| Token | Resuelve a (Día / Noche) | Estado |
| --- | --- | --- |
| `--sc-color-structure-member` / `-node` / `-support` | `canvas-member` (`#16211c` / `#f1f5f4`) | Heredado |
| `--sc-color-structure-member-selected` / `-node-selected` / `--sc-color-selection-outline` | `selection-stroke` | Heredado |
| `--sc-color-structure-spring` / `-hinge` / `-release` | `technical-axis` | Heredado |
| `--sc-color-load-point` | `technical-load` | Heredado |
| `--sc-color-load-distributed` | `technical-shear` | Heredado |
| `--sc-color-load-moment` | `technical-moment` | Heredado |
| `--sc-color-reaction` | `technical-reaction` | Heredado |
| `--sc-color-axial-tension` | `technical-axial` | Heredado |
| `--sc-color-axial-compression` | `#7c4db2` (plum-500) / `#d9a7f5` | **Reservado** — el canvas codifica el signo por lado/etiqueta, no por color |
| `--sc-color-shear-positive` / `-negative` | ambos = `technical-shear` | Heredado (signo por geometría) |
| `--sc-color-moment-positive` / `-negative` | ambos = `technical-moment` | Heredado (signo por geometría) |
| `--sc-color-deformation` | `technical-deformed` | Heredado |
| `--sc-color-influence-line` | `action-primary` | Heredado del rol de acción |
| `--sc-color-envelope` | `#624fc7` / `#b8aaff` | Recalibrado en v2 (antes `#5b54c8` / `#a29bf0`) |
| `--sc-color-critical-point` | `#d88408` (amber-500) / `#e7bd55` | Heredado (ámbar / cota Noche) |
| `--sc-color-geometry-error` | `state-error` | Alias |
| `--sc-color-stale-result` | `state-warning` | Alias |
| `--sc-color-snap-target` / `--sc-color-hover-target` | `action-primary` | Heredado |

### Lienzo y documento

Explícitos por tema, **nunca producidos por inversión**.

| Token | Día | Noche | Uso |
| --- | --- | --- | --- |
| `--sc-color-canvas-grid` | `#e7ece9` | `#202a2b` | Cuadrícula fina (siempre por debajo del miembro y de resultados) |
| `--sc-color-canvas-grid-strong` | `#d8dfdb` | `#2c3539` | Cuadrícula mayor |
| `--sc-color-canvas-member` | `#16211c` | `#f1f5f4` | Trazo de miembros y apoyos |
| `--sc-color-canvas-node-fill` | `#fafcfb` | `#060b09` | Relleno de nodos (= `bg-canvas` en ambos temas; el contorno lo aporta `canvas-member`) |

`--sc-color-canvas-node-fill` Noche se resincronizó con `--sc-color-bg-canvas` (`#060b09`) el 2026-08-03, cerrando la deuda que había dejado la migración v2: ahora el relleno de nodo iguala el fondo del canvas en ambos temas, igual que ya ocurría en Día. La exportación SVG (`src/utils/svgExport.ts`) usa ese mismo valor.

## 8 · Herramientas (rail)

La identificación de herramienta refleja la codificación del canvas. El color propio del icono se conserva en hover, active y focus; el active puede sumar fondo/borde suave pero no reemplaza la identidad del icono.

| Token | Resuelve a | Herramientas (clase `sc-tool-button--*`) |
| --- | --- | --- |
| `--sc-color-tool-navigation` | `text-secondary` | select, pan |
| `--sc-color-tool-structure` | `text-primary` | node, member, support, split |
| `--sc-color-tool-point-load` | `technical-load` | pointLoad |
| `--sc-color-tool-distributed-load` | `technical-shear` | distributedLoad |
| `--sc-color-tool-moment` | `technical-moment` | moment |
| `--sc-color-tool-dimension` | `technical-dimension` | dimension |
| `--sc-color-tool-cut` | `technical-axis` | cut |
| `--sc-color-tool-destructive` | `state-error` | delete |

## 9 · Overlays

Tres niveles fijos; nunca se usa un negro arbitrario en el componente. Sin cambios en v2.

| Token | Día | Noche | Uso |
| --- | --- | --- | --- |
| `--sc-color-overlay-soft` | `rgba(4, 11, 7, 0.28)` | `rgba(0, 0, 0, 0.34)` | Velos suaves (backdrops secundarios) |
| `--sc-color-overlay-sheet` | `rgba(2, 10, 6, 0.34)` | `rgba(0, 0, 0, 0.46)` | Sheets / paneles móviles |
| `--sc-color-overlay-strong` | `rgba(5, 18, 11, 0.58)` | `rgba(0, 0, 0, 0.68)` | Modales (`.sc-overlay`) |

## 10 · Alias de compatibilidad (capa 4)

Para CSS existente en migración por rol: `--app-bg`, `--surface`, `--surface-2`, `--surface-3` (derivado con `color-mix`), `--canvas-bg`, `--text`, `--muted`, `--muted-strong`, `--subtle`, `--border`, `--border-soft`, `--shadow`, `--accent(-hover/-pressed/-soft/-foreground)`, `--focus`, `--selection(-soft)`, `--axial`, `--shear`, `--moment`, `--force`, `--dimension`, `--axis`, `--deformed`, `--reaction`, `--warning`, `--error`, `--danger`, `--success`, `--grid(-strong)`, `--member`, `--node-fill`, `--radius-*`, `--topbar-h`, `--toolbar-w`, `--inspector-w`, `--motion-*`, `--ease-*`. Todos resuelven a tokens `--sc-*`; el objetivo es retirarlos conforme cada superficie migra. Todos siguen apuntando a los mismos roles semánticos tras la migración v2 — ningún alias cambió de destino, solo el valor final que resuelven.

## 11 · Materia (nuevo en v3)

Vidrio, anillos, halos y gradientes son tokens, no literales por componente: cada uno se mide distinto en Día y en Noche, y dejarlos sueltos garantiza que el tema oscuro herede una decisión tomada para porcelana.

| Token | Día | Noche | Uso previsto | Uso prohibido |
| --- | --- | --- | --- | --- |
| `--sc-surface-glass` | `surface-1` al 72% | `surface-1` al 76% | Barras y paneles translúcidos sobre contenido | Superficies con texto largo encima |
| `--sc-surface-glass-strong` | `surface-1` al 88% | `surface-1` al 92% | Topbar y pie: cristal que sí soporta texto | — |
| `--sc-surface-glass-border` | blanco al 66% | `border-strong` al 52% | Canto de una superficie de vidrio | — |
| `--sc-blur-glass` / `--sc-blur-chrome` | `blur(20px) saturate(1.6)` / `blur(14px) saturate(1.3)` | idénticos | Desenfoque de cristal. **La saturación no es opcional**: sin ella el desenfoque deja el lienzo lechoso justo donde el ojo compara colores de diagrama | — |
| `--sc-ring-inset` | luz blanca al 72% | acento al 14% | 1px de canto interior superior en todo lo que se eleva | Elementos planos |
| `--sc-glow-accent` / `--sc-glow-aula` | acento/violeta al 24% | al 20% / 22% | Halo de marca **sólo en hover o estado activo** | Reposo |
| `--sc-ring-focus` | foco al 30% | hereda | Halo de foco tokenizado | Sustituir el `outline` de foco |
| `--sc-gradient-brand-soft` | esmeralda 10% → surface | hereda | Relleno de la tarjeta de acción primaria | Fondos extensos |
| `--sc-gradient-display` | esmeralda → cian | hereda | **Un único uso**: la palabra acentuada del titular de bienvenida | Cualquier segundo sitio: repetido deja de leerse como acento |
| `--sc-gradient-sheen` | blanco 64% → transparente | acento 10% → transparente | Brillo superior de tarjetas y botón primario | — |

Elevación: `--sc-shadow-raised` → `--sc-shadow-lifted` (nuevo en v3, para hover de tarjeta) → `--sc-shadow-floating` → `--sc-shadow-popover` → `--sc-shadow-modal`. En Día la tinta de sombra es grafito verdoso (`rgba(11, 31, 24, …)`), no negro puro: sobre porcelana el negro ensucia.

### Materia clay (nuevo en v4)

Sistema de elevación aparte, para las superficies vestidas de clay del inicio (`Surface`, tarjetas del launcher, tarjetas de importación/plantilla). No sustituye a la escala `--sc-shadow-raised…modal` de arriba — conviven, cada una en su propia familia de componentes.

Una superficie clay son **cuatro capas y una sola fuente de luz**, a 145° (arriba-izquierda), en este orden: sombra exterior difusa abajo-derecha, luz interior arriba-izquierda, sombra interior abajo-derecha, y un canto de 1px que separa la superficie del fondo. La tinta de sombra es grafito verdoso diluido (`rgba(58, 70, 64, …)`), nunca negro puro — igual que el resto del sistema de elevación.

| Token | Uso previsto |
| --- | --- |
| `--sc-shadow-clay-xs` → `-sm` → `-md` → `-lg` → `-floating` | Escala de reposo → elevación creciente (hover), cinco pasos con las cuatro capas descritas arriba |
| `--sc-shadow-clay-pressed` | Estado `:active`. La luz se invierte: **sólo capas interiores** — cualquier sombra exterior en `:active` devolvería la superficie a parecer que flota en vez de hundirse |
| `--sc-clay-edge` | Canto de 1px de la superficie: blanco al 78% en Día, `border-strong` al 14% en Noche |
| `--sc-gradient-clay` | Degradado base de 145° de una superficie clay, mezclado con `color-mix()` desde `surface-elevated`/`surface-2` — nunca un color plano |

Materiales de ilustración del pórtico del hero (`StructuralPortalHero.tsx`). Son roles de ilustración, no de interfaz: **ningún texto se apoya en ellos**, así que se eligen por lectura de volumen (el sombreado por cara del pórtico modula su luminosidad con `brightness()` en CSS) y no por contraste — no forman parte del contrato de `tokens.test.ts`. El pórtico parte de la misma fuente de luz que la materia clay (arriba-izquierda), pero al proyectarla en isométrico (`src/graphics/isometricPortal.ts`) no conserva el ángulo: medida como `projectIso(LIGHT)` en convención `linear-gradient`, cae a ~151,7° — mismo cuadrante que los 145° de la materia clay, ~6,7° de diferencia. No son el mismo valor.

| Token | Día | Noche | Uso previsto |
| --- | --- | --- | --- |
| `--sc-color-clay-ivory` / `-deep` | `#f0ece2` / `#e3ddcf` | `#b9b5ab` / `#a29e94` | Columnas y capitel del pórtico |
| `--sc-color-clay-mint` / `-deep` | `#6fb99a` / `#4f9e80` | `#57c7a4` / `#3d9c7d` | Vigas y bases del pórtico |

## Regla transversal: no depender solo del color

Estados, herramientas y resultados **nunca** dependen únicamente del color. Señal adicional obligatoria por significado:

| Significado | Señal de color | Señal adicional obligatoria |
| --- | --- | --- |
| Selección | Azul | Halo, contorno, handles o geometría redundante |
| Foco | Azul | Outline visible y posición de teclado |
| Carga puntual | Salmón-coral | Flecha individual |
| Carga distribuida | Verde | Serie de flechas y línea de distribución |
| Momento | Magenta/rosa | Flecha circular |
| Cota | Ocre | Extensiones, línea y puntas de cota |
| Error | Rojo-rosado | Icono, texto y mensaje explicativo |
| Warning | Ámbar | Icono y etiqueta de advertencia |
| Éxito | Verde de estado | Icono de confirmación y texto |

Complementos adicionales: tipos de línea (los diagramas usan líneas base discontinuas, ver glifos de resultados), etiquetas numéricas junto a cada magnitud, y texto técnico dentro del canvas con halo/`paint-order`/fondo cuando el tamaño es pequeño.

## Checklist al agregar un color

1. Definir el rol semántico antes del valor.
2. Proponer valores Día y Noche juntos (nunca derivar uno del otro por filtro).
3. Medir contraste contra todos los fondos donde aparecerá (piso: 4.5:1 texto normal, 3:1 texto grande/gráficos esenciales/focus).
4. Agregar una señal no cromática.
5. Probar normal, hover, active, focus y disabled.
6. Añadir el par al contrato automático de tokens (`src/design-system/tokens.test.ts`) si es texto, foco o dato técnico esencial.
