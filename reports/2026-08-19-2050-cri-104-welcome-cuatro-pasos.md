# CRI-104 — Welcome: cuatro pasos, marca presente y proyectos primero, con portal clay acotado

**Fecha:** 2026-08-19 20:50
**Agente:** Claude Code
**Rama:** `claude/cri-104-welcome-redesign-xecvp3`
**Baseline:** `origin/main` = `b824ba0c36939124622466dfb95b8e7a916d3e8f`
**Evidencia:** `reports/evidence/2026-08-19-cri-104/` (32 capturas + `qa-cri-104.json` + `capture.mjs`)

## Baseline

El contrato de Linear declara `origin/main` = `7fb927fb…`. El baseline real al
ejecutar es `b824ba0c`, que es `7fb927fb` **más CRI-103** (registro único de
comandos, commits `c2e0136` y `b824ba0`). Es un avance legítimo posterior a la
redacción del issue y no toca ninguna superficie de la bienvenida: la lectura
del punto "Baseline a revalidar" se confirmó archivo por archivo sobre
`b824ba0c` y las seis observaciones del issue seguían siendo exactas
(`WelcomeScreen` no es `lazy`; `Phase2ProjectHub` sí; `ProjectHub` respaldado
por IndexedDB dentro de Welcome; `StructuralPortalHero` ya respeta
`hover:hover`/`prefers-reduced-motion`; los seis selectores `welcome-*` en el
grupo `floating` de `material.css`).

Los registros de dirección que el issue cita (`03-visual-direction-record.md`
V-11, `02-ux-direction-record.md` §2) **no existen** ni en el repositorio ni
como documento de Linear. Se buscó por nombre y por contenido en ambos sitios.
El contrato aplicado es, por tanto, el propio cuerpo de CRI-104 más el
Brandbook vigente (`brand/brandbook-clay.html`, intacto) y `AGENTS.md`.

## Qué cambió

### 1. Los cuatro pasos

`WelcomeScreen` pasa de una landing de scroll único a un recorrido con carril
de cuatro pasos:

1. **Bienvenida** — el trabajo propio: continuar, nuevo proyecto y el hub real
   (recientes + recuperación).
2. **Cómo trabajas** — Proyecto completo o Modo Aula, más el ciclo
   Modela → Carga → Analiza y los tres chips de método.
3. **Por dónde** — las cinco puertas de arranque (lienzo en blanco, nuevo
   ejercicio, importación portátil, DXF, Space 3D experimental) y la vitrina de
   ejemplos con sus filtros.
4. **Mesa** — no es un panel de esta pantalla, es la siguiente. El cuarto botón
   del carril abre el espacio de trabajo con el proyecto actual.

El paso activo se marca con `aria-current="step"`, y no sólo por color: cambia
también el relleno del índice y el peso del texto. Elegir modo en la etapa 2
avanza a la 3 y preselecciona el filtro de la vitrina; **no retira ninguna
puerta** — las cinco se pintan siempre, en los dos modos, y sólo cambian de
orden.

### 2. Marca presente, no dominante

Arriba quedan **el wordmark** (ahora el `h1` de la página: `structureCo`, que no
se traduce) y **una sola línea** de marca (`welcome.brandLine`). Desaparecen el
titular editorial a dos líneas (`welcome.title` + `welcome.subtitle`), la
pastilla de badge y la figura a media pantalla. Los tres chips de método
(`welcome.highlight*`) no se tiran: se mudan a la etapa 2, que es donde de
verdad describen cómo trabaja la herramienta. Se mantiene IBM Plex; no entra
ninguna serif; la escala mayor de la pantalla está acotada (`clamp` con techo
1.9rem en los títulos de panel, 1.75rem en el nombre del proyecto).

También desaparece el enlace "Continuar" de la cabecera: con la tarjeta de
continuar en la etapa 1 y el paso "Mesa" en el carril, ese enlace era una
tercera llamada compitiendo por lo mismo.

### 3. Salto directo a la Mesa para quien regresa

`src/features/welcome/welcomeEntry.ts` (nuevo) lee el repositorio IndexedDB
**existente** —`listProjects()` y `listRecoveries()`, las dos lecturas que
`ProjectHub` ya hacía— y deriva `new` | `returning`. Ninguna escritura, ninguna
preferencia nueva, ni `localStorage` ni IndexedDB. El módulo del repositorio
entra por `import()` dinámico para no subir al chunk de entrada.

El salto se ofrece cuando se cumplen **las dos** condiciones:

- hay al menos un proyecto guardado, y
- **no** hay ninguna copia de recuperación pendiente.

La segunda es una decisión de seguridad de datos y está documentada en el
código: `RecoveryRecord` protege trabajo, y saltarse la pantalla donde vive la
recuperación la dejaría fuera de la vista. Un repositorio que falla se lee como
`new`: nunca se salta por un error de lectura.

`App.tsx` ofrece el salto **una vez por sesión** (`directResumeAvailable`, en
estado de React, sin persistir). Volver a Inicio desde la Mesa tiene que llevar
de verdad a Inicio; si el salto se repitiera, el botón de Inicio dejaría de dar
acceso a ejemplos, Aula, importación y recuperación — justo el "no ocultar
capacidades reales" del contrato. Verificado con captura
(`x2-dia-es-recurrente-vuelve-a-inicio.png`).

### 4. El portal clay, acotado

`StructuralPortalHero` conserva su geometría y su sombreado por cara, y estrena
**un** filtro SVG (`#sc-portal-clay`) con grano (`feTurbulence` recortado a la
silueta) y luz de borde (contorno erosionado con `feMorphology`, teñido por
`feFlood` desde un token vía `.portal-hero__rim`). La oclusión ya existía: las
dos elipses de contacto por pie.

El filtro se engancha **desde CSS** (`.portal-hero__body { filter: url(...) }`),
no con el atributo `filter` del marcado, y ése es todo el mecanismo de
degradación:

- `prefers-reduced-motion` o `prefers-reduced-transparency` → una media query
  pone `filter: none`;
- navegador sin filtros SVG vía CSS → la declaración es inválida y se descarta;
- `forced-colors: active` → también plano.

En los tres casos queda el relleno plano por cara con **la misma caja, la misma
geometría y las mismas 36 caras** (medido: `widthRatio` y `faces` idénticos con
y sin filtro). Ninguna superficie de interfaz recibe este filtro ni ningún otro.
No hay motor 3D. El mark (`BrandMark`) no se toca: sin clay, sin volumen, sin
animación, sin recoloreado.

La pieza ocupa **1.7 % del viewport en X2** (14.4 % de ancho), 2.4 % en K0
retrato, 2.8 % en K0 apaisado y 1.8 % en M1. Es una esquina.

### 5. Materia

| Superficie | Antes | Ahora | Por qué |
|---|---|---|---|
| `.welcome-header` | `floating` | **RAISED** | Es una barra de aplicación, igual que `.topbar`; `floating` es la elevación de lo que se despega del plano. Se le recorta el canto a `0 0 1px` (en `material.css`, que gana la cascada). |
| `.welcome-filter-tabs` | `floating` | **INSET** | Bandeja de un control segmentado: las pastillas se apoyan dentro. |
| `.welcome-workflow` | `floating` | **BASE** | Información dentro del marco RAISED; no una tarjeta sobre una tarjeta. |
| `.welcome-highlight-item` | `floating` | **BASE** | Chips de texto, no siete piezas flotando. |
| `.welcome-footer` | `floating` | **BASE** | Una nota, no una superficie. |
| `.welcome-badge-pill` | `floating` | — | Eliminado con el hero editorial. |
| `.project-hub` | tarjeta con sombra | **BASE** | Vive dentro de `.welcome-frame`, que ya es RAISED. Sus filas conservan relieve: son controles. |

`.welcome-frame` sigue siendo la única superficie RAISED de la pantalla
(`Surface level="raised"`), sin cambios en su radio ni en su materia. Cero
tokens/HEX de Brandbook tocados; `brand/**` intacto.

### 6. Recuperación

`ProjectHub` conserva arquitectura, almacenamiento, registros y comportamiento
de apertura. Los dos únicos cambios son de visibilidad, y los dos suben:

- el `<details>` de copias recuperables se renderiza **`open`** cuando hay algo
  que recuperar (sin copias sigue sin renderizarse, igual que antes);
- lleva canto y fondo de aviso propios, con el recuento en el resumen — no
  depende sólo del color.

Antes era una línea gris colapsada al pie del hub. Ahora el botón "Recuperar…"
se ve sin ninguna interacción (`recoveryVisibleWithoutInteraction: true`,
captura `x2-dia-es-recuperacion-visible.png`).

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/features/welcome/WelcomeScreen.tsx` | Reescrito: carril de cuatro pasos, tres paneles, marca de dos líneas, salto directo. |
| `src/features/welcome/welcomeEntry.ts` | **Nuevo.** Lectura del repositorio y regla del salto. |
| `src/features/welcome/StructuralPortalHero.tsx` | `<defs>` con el filtro clay; caras dentro de `.portal-hero__body`. |
| `src/features/project-hub/ProjectHub.tsx` | `<details open>` en recuperación. Nada más. |
| `src/features/project-hub/projectHub.css` | Hub a BASE; aviso de recuperación. |
| `src/design-system/material.css` | Reasignación de los seis selectores `welcome-*` a su nivel correcto. |
| `src/styles.css` | Retirada del hero editorial (−3 KB) + capa final CRI-104. |
| `src/i18n/catalogs.ts` | 17 claves nuevas × ES/EN. |
| `src/App.tsx` | `allowDirectResume` / `onDirectResume` (estado, sin persistencia). |
| `qa.mjs` | Navegación por pasos + biblioteca vacía como punto de partida (ver abajo). |
| `src/features/welcome/welcomeFlow.test.tsx` | **Nuevo.** 14 pruebas: pasos, puertas, `welcomeEntry`, salto. |
| `WelcomeScreen.test.tsx`, `WelcomeHeader.test.tsx`, `StructuralPortalHero.test.tsx` | Adaptadas al nuevo contrato + 4 pruebas nuevas del portal. |
| `reports/evidence/2026-08-19-cri-104/` | **Nuevo.** Script de captura, 32 PNG y `qa-cri-104.json`. |

`src/i18n/phase2Catalogs.ts` se revisó y **no necesitó cambios**: las claves
`hub.*` que la bienvenida consume ya estaban completas y paritarias en ES/EN.
Ninguna cadena dura nueva; los dos catálogos pasan la paridad de
`catalogs.test.ts` (estructura, resolución y marcadores de interpolación).

## Gates focales

| Gate | Resultado |
|---|---|
| `npx vitest run src/features/welcome src/features/project-hub src/graphics` | ✅ **8 archivos / 69 pruebas** |
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ (4 avisos preexistentes de `only-export-components`, 0 errores) |
| `npm run build` | ✅ |
| `npm run verify:perf` | ✅ **852 136 B / 221 510 gzip** |

### Rendimiento

Medido con el mismo comando sobre el baseline limpio y sobre el cambio:

| | bytes | gzip |
|---|---|---|
| `b824ba0c` (baseline) | 841 432 | 219 361 |
| CRI-104 | 852 136 | 221 510 |
| Δ | **+10 704 (+1.27 %)** | **+2 149 (+0.98 %)** |

Desglose: `index.css` +4.5 KB crudos (la capa CRI-104 menos los ~3 KB del hero
editorial retirado), el resto son las 34 cadenas nuevas de catálogo y el
`WelcomeScreen` reescrito. `WelcomeScreen` sigue **sin ser `lazy`**, y lo que se
podía dejar fuera del arranque se dejó fuera: `ProjectHub`, `Phase2DxfAction`,
`PortableImportCenter` y ahora también `storage/projectRepository` (por
`import()` dinámico dentro de `welcomeEntry`). No entra ninguna dependencia
nueva; `package.json` no se toca. Menos de un 1 % de gzip no es un aumento
significativo del bundle de entrada (criterio 8).

## QA ejecutado

Todo lo de abajo sale de `reports/evidence/2026-08-19-cri-104/qa-cri-104.json`,
producido por `capture.mjs` sobre Chromium real contra `dist/` servido con
`vite preview`. **29 checks, 29 en verde.**

### Composición

| Clase | Viewport | Sin overflow horizontal | Portal (área del viewport) |
|---|---|---|---|
| X2 Expanded | 1440×900 | ✅ | 1.7 % |
| M1 Medium | 1060×800 | ✅ (3 pasos) | 1.8 % |
| K0 Compact retrato | 390×844 | ✅ (3 pasos × Día/Noche) | 2.4 % |
| K0 Compact apaisado | 844×390 | ✅ (3 pasos) | 2.8 % |

No se añadió ningún `matchMedia` paralelo. La clase de composición la resuelven
los mismos puentes de CSS que `shellComposition.ts` documenta (1023 px y
700 px), más `orientation:landscape and max-height:600px` para el apaisado
corto. El ancho es toda la información que la bienvenida necesita.

### Temas e idiomas

Día y Noche capturados en X2 y en K0, los tres pasos en cada combinación
(12 capturas). ES y EN en X2 (`englishBrandLine` verificada:
"2D structural analysis and Classroom Mode, local to this device.").

### Usuarios

- **Nuevo** (repositorio vacío): ve la bienvenida completa, no salta.
  `x2-dia-es-paso-welcome.png`.
- **Recurrente** (proyecto en IndexedDB, escrito por el autoguardado real de la
  app — no se inyecta nada): al recargar entra **directo a la Mesa**
  (`returningUserLandsInWorkspace: true`, `x2-dia-es-recurrente-directo-a-mesa.png`).
  Volver a Inicio lleva a Inicio, con el proyecto listado en recientes
  (`recentProjectsListed: true`).
- **Con recuperación pendiente**: **no** salta, y la recuperación se ve abierta
  con su botón de restaurar (`x2-dia-es-recuperacion-visible.png`).

### Preferencias

| | `filter` de `.portal-hero__body` | caja | caras |
|---|---|---|---|
| normal | `url("#sc-portal-clay")` | 14.44 % | 36 |
| `prefers-reduced-motion: reduce` | `none` | 14.44 % | 36 |
| `prefers-reduced-transparency: reduce` | `none` | 14.44 % | 36 |

Capturas: `portal-normal.png`, `portal-reduced-motion.png`,
`portal-reduced-transparency.png`, más las dos de pantalla completa. La
transparencia reducida se emula por CDP (`Emulation.setEmulatedMedia`):
Playwright no la expone en `emulateMedia`.

### Entrada

- **Teclado**: orden de Tab = selector de idioma → tema → paso 1 → 2 → 3 →
  Mesa → **Continuar** → Nuevo proyecto → avanzar. Coincide con la jerarquía
  visual. Anillo de foco `solid 3px` visible en los nueve.
- **Táctil** (Compact con puntero grueso): 15 objetivos medidos, **mínimo
  44 px**.
- **Sin overflow horizontal** en las 12 combinaciones medidas.

### Las puertas, una por una

| Puerta | Dónde está ahora | Verificado |
|---|---|---|
| Continuar proyecto | Etapa 1, pieza de mayor peso | ✅ prueba + captura |
| Nuevo proyecto | Etapa 1, junto a continuar | ✅ prueba + captura |
| Recientes | Etapa 1, `ProjectHub` real | ✅ `recentProjectsListed` |
| Recuperación | Etapa 1, `ProjectHub`, **abierta** | ✅ `recoveryVisibleWithoutInteraction` |
| Importación portátil | Etapa 3 | ✅ prueba + captura |
| DXF | Etapa 3 | ✅ `k0DxfGateVisible` + captura |
| Ejemplos | Etapa 3, con sus tres filtros | ✅ prueba + captura |
| Aula (nuevo ejercicio) | Etapas 2 y 3 | ✅ prueba + captura |
| Space 3D **experimental** | Etapa 3, con su etiqueta | ✅ prueba + captura |
| Idioma / tema / menú | Cabecera y drawer | ✅ pruebas existentes |

## Gates no focales

`npm run qa` **no es un gate focal de CRI-104** y no se declara verde. Se
actualizó igualmente para que siga siendo coherente con el recorrido nuevo
(`openWelcomeStep`, `.welcome-resume-card` como "continuar", `.project-hub` como
ancla de alcance al final del scroll) y para que **parta de una biblioteca
vacía**: sus páginas comparten el contexto del navegador, así que el
autoguardado de una comprobación anterior convertía a la siguiente en usuario
recurrente y la bienvenida ya no se pintaba.

Con esos arreglos, `qa.mjs` recorre toda la bienvenida y falla más adelante, ya
dentro del espacio de trabajo, esperando la pestaña "Reacciones" tras pulsar
Analizar. **Ese mismo punto falla idéntico sobre el baseline limpio**
(`b824ba0c`, misma función, mismo `locator.waitFor` agotado): es un límite de
este entorno headless, no del cambio. No se tocó ningún umbral ni ninguna
configuración para forzar un verde.

## Riesgos y decisiones abiertas

1. **El salto automático es una decisión de producto con dos lecturas.** El
   contrato dice "quien regresa entra directo a la Mesa" y, por contraste, que
   quien no tiene nada guardado "no debe saltarse automáticamente la
   bienvenida". Se implementó el salto automático, acotado por las dos vallas
   descritas (sin recuperación pendiente; una vez por sesión). Si se prefiere
   que el salto sea explícito —un clic en "Ir a la Mesa" en vez de automático—
   el cambio es una línea: quitar el efecto de `WelcomeScreen`. La tarjeta de
   continuar ya está donde tendría que estar en ese caso.
2. **Coste del filtro SVG.** Es uno solo, con región acotada al dibujo, sobre un
   elemento de ≤208 px. Ampliarlo a superficies de interfaz rompería el
   equilibrio; la prueba `confines the clay finish to one filter inside its own
   svg` falla si aparece un segundo `<filter>`.
3. **Los registros de dirección citados por el issue no existen.** V-11 y
   `02-ux-direction-record.md` §2 no están ni en el repo ni en Linear. Si
   aparecen y contradicen alguna decisión de vestido, hay que revisarlo contra
   ellos.
4. **`WelcomeScreen` sigue en el chunk de entrada.** Cualquier trabajo futuro
   sobre esta pantalla paga arranque para todos. La regla práctica: lo que no
   se ve en la etapa 1 debería llegar `lazy`, como ya hacen el hub, el DXF y la
   importación portátil.
5. **El carril en K0 retrato ocupa tres filas.** Es legible y todos los
   objetivos cumplen 44 px, pero empuja "Continuar" hasta ~380 px. Sigue dentro
   del primer viewport de 844 px; en pantallas más cortas conviene revisarlo.

## Rollback

Revertir el commit. Cero migración: no se escribe nada nuevo en IndexedDB ni en
`localStorage`, y el repositorio se lee exactamente con los mismos dos métodos
que ya usaba `ProjectHub`.

## Fuera de alcance (confirmado)

No se tocó solver, `model`, `schema`, `src/data/**` ni `brand/**`. No se
implementó 3D. No se añadió ninguna dependencia. No se inició CRI-93, CRI-105
ni ninguna otra issue.
