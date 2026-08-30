# CRI-10 — Welcome: recuperación y mejora (pórtico 3D, tarjetas, dos velocidades)

**Fecha:** 2026-08-15 19:00
**Agente:** Claude Code
**Rama:** `research/cri-10-ux-system`
**Evoluciona:** `9775872` (reconciliación visual/material Clay)
**Clasificación:** `SPEC/DESIGN` — reconstrucción de una pantalla dentro de CRI-10. No toca `src/**`, no reabre la arquitectura general.

> **Diagnóstico antes de diseñar.** La Welcome de CRI-10 no perdió el pórtico 3D porque alguien lo quitara del producto: el producto real (`src/features/welcome/WelcomeScreen.tsx` + `StructuralPortalHero.tsx`) siempre lo tuvo, junto con cuatro lanzadores, un hub de recientes/recuperación, una vitrina de plantillas con filtros y tres pasos. Lo que pasó es que el **concepto** de CRI-10 (`reports/evidence/.../concepts/frames.js`) nunca lo incorporó — se escribió una versión minimalista propia, en paralelo, sin verificar contra el árbol real. Esta pasada corrige eso: reconstruye la lámina de Welcome verificando cada pieza contra el código de producción, línea a línea, como ya exige la disciplina del resto de CRI-10.

---

## Qué se recuperó

Todo verificado contra `WelcomeScreen.tsx` y `src/styles.css` antes de dibujarse, no inventado:

1. **El pórtico 3D real.** Puerto directo de `src/graphics/isometricPortal.ts` (proyección isométrica 2:1, misma luz, mismas proporciones de `DEFAULT_PORTAL`, mismo criterio de sombreado Lambert) a `concepts/portico3d.js` — pipeline vanilla, sin React. Los tres shades de cara calibrados dan **0.8345 / 0.7027 / 0.5840**, verificado con Node contra el valor documentado en `styles.css`: coincide al cuarto decimal. No es una aproximación visual — es la misma aritmética.
2. **Los cuatro lanzadores** con el mismo peso visual que en producción: Proyecto completo (lienzo libre), Nuevo ejercicio (Modo Aula), Continuar proyecto (con el objeto real) y Explorar en 3D (Space3D, marcado Experimental) — cada uno con su acento de dominio (marca / Aula / azul de continuidad / cian técnico), nunca por tamaño.
3. **El hub de proyectos** (recientes + recuperación), que la Welcome de CRI-10 no tenía en absoluto — verificado contra `ProjectHub.tsx`: fila por proyecto (nombre, revisión, abrir/renombrar/duplicar) y un `<details>` de recuperación para snapshots de crash, exactamente el mismo patrón que expone `recoveries` en `projectRepository`.
4. **La vitrina de plantillas** con filtros (Todos/Académicos/Modelos), tarjeta de importar y seis plantillas reales — los mismos nombres exactos de `src/data/defaultProject.ts` (Pórtico de ejemplo, Viga simplemente apoyada, Armadura triangular, y las tres prácticas Hibbeler), con la misma categoría y el mismo icono que `EXAMPLE_META` les asigna en producción. Ninguna plantilla es inventada.
5. **Los tres pasos** (Modela → Carga → Analiza), ausentes del concepto anterior.

## Qué se mejoró sobre el propio producto

No es sólo una copia — se corrigieron dos cosas que la propia Welcome de producción tiene resueltas de forma implícita y aquí se hacen explícitas y auditables:

- **El acento del título es tinta plana, no degradado.** `src/styles.css` declara `.welcome-title-accent` DOS veces: una con `background:var(--sc-gradient-display)` + `background-clip:text` (la versión original), y otra, más abajo, en la sección «IDENTIDAD OFICIAL CLAY», con `background:none;color:var(--accent)` — que gana la cascada por ser la última con la misma especificidad. El concepto anterior de CRI-10 tenía la versión ANTIGUA (`.wel h1 em { background:var(--sc-gradient-display); ...}` — un texto con degradado). Esta pasada usa la versión que de verdad se ve en pantalla hoy: `.title2 em { color:var(--sc-color-action-ink); }`, sin clip de texto.
- **Sin el halo detrás del pórtico.** `.welcome-hero-figure::before` en producción es un `radial-gradient` + `filter:blur(26px)` teñido de marca — y la misma sección «IDENTIDAD OFICIAL CLAY» lo apaga con `display:none`, exactamente el patrón «halo de neón» que el Brandbook (§03 del cookbook) advierte que ensucia un objeto de color. El concepto nuevo no lo reintroduce: el pórtico se apoya sólo en su sombra de contacto (neutra, muy localizada bajo cada zapata — física, no luz).

Estas dos correcciones están documentadas con cita de línea en los comentarios de `concepts.css`, para que quien lea el concepto entienda que no es preferencia estética: es lo que el propio producto ya decidió y el concepto anterior no había heredado.

## Cómo volvió el pórtico 3D

Como **pieza de la mitad derecha del hero**, junto al copy — la misma composición que ya usa el producto, no una sección nueva ni una escena aparte. Es lo que la pasada anterior de CRI-10 llamaba «objeto físico, no lámpara»: sombreado por `brightness()` calibrado (no color-mix ni glow), canto real en cada cara, sombra de contacto corta bajo cada zapata. **Explorar en 3D** es un lanzador aparte (con su propio icono, cian técnico, marcado Experimental) porque es una capacidad distinta de Space3D — el pórtico del hero es identidad, el lanzador es la puerta al producto real.

## Cómo se resolvieron las dos velocidades

`welcome({ speed })` acepta `'completa'` o `'esencial'` y usa el mismo `densityToggle()` que ya expone CRI-10 en otras láminas — mismos componentes, mismos tokens, misma app:

- **Esencial**: hero + pórtico + los cuatro lanzadores + hub de recientes (sin el `<details>` de recuperación). Es la pantalla completa: no hay nada más abajo que cruzar para llegar a trabajar.
- **Completa**: añade la vitrina de plantillas con filtros y los tres pasos, y el hub muestra también la recuperación disponible.

Ninguna sección se duplica ni cambia de componente entre modos — sólo cambia cuánto se pliega, exactamente como el resto de la hipótesis Esencial/Completa de CRI-10 (sigue siendo hipótesis para CRI-11, no decisión de producción).

## SVG / iconos

Nueve glifos nuevos en `parts.js`, trazados exactamente con la geometría real de `lucide-react` (ya `node_modules`, única dependencia de iconos del proyecto) — `d` copiado directamente de `node_modules/lucide-react/dist/esm/icons/{compass,folder-open,upload,cpu,move-3d,rotate-ccw,pencil,folder-clock,triangle,git-commit-horizontal,sparkles}.mjs`, redibujado a `stroke-width:1.8` para casar con el resto de la hoja (Brandbook §11). Documentado en un comentario en el propio `ICON`. No se añadió ninguna librería nueva y no se usó ningún emoji.

## Láminas

**4 nuevas/reconstruidas** (`render-concepts.mjs`, gate de desbordamiento en verde, sin errores de página ni consola):

| Lámina | Viewport | Qué demuestra |
|---|---|---|
| `01-welcome` | 1440×2115, Día | Completa: hero+pórtico, 4 lanzadores, hub con recuperación, vitrina de 6 plantillas, 3 pasos |
| `01b-welcome-esencial` | 1440×1300, Día | Esencial: mismo hero y lanzadores, hub corto, sin vitrina ni pasos |
| `01d-welcome-compact` | 390×2000, Día, táctil | Una columna, pórtico primero, lanzadores a ancho completo |
| `01-welcome--noche` | 1440×2115, Noche | Mismo pórtico (la lima del relleno no cambia de tema), sin bloom en ningún lanzador ni tarjeta |

Las otras 34 láminas se regeneraron junto con éstas (mismo pipeline, una sola pasada) sin cambio de contenido.

## Confirmación de alcance

```
$ git diff --name-only origin/main -- . | grep -v '^reports/'
(sin salida)
```

**Todo el trabajo quedó dentro de `reports/**`.** Ningún archivo de `src/**` se tocó ni se leyó para copiar-pegar código ejecutable — `isometricPortal.ts` y los iconos de `lucide-react` se **releyeron** para portar su aritmética/geometría al pipeline vanilla de los conceptos, que no ejecuta TypeScript ni React.

Archivos modificados/creados:
```
reports/2026-08-15-1900-cri-10-welcome-reconstruccion.md   (este informe)
reports/evidence/2026-08-15-cri-10-ux-system/
  concepts/portico3d.js      nuevo — puerto de isometricPortal.ts
  concepts/parts.js          +9 iconos (compass, folderOpen, upload, cpu, cube3d,
                              restore, pencil, folderClock, triangleShape, commitH, sparkles)
  concepts/concepts.css      Welcome reescrita (.ws/.hero2/.launcher/.hub/.showcase2/.tplcard/.wf);
                              .rec/.rec__t/.rec__c restaurados (los seguía usando `21-recuperacion-conflicto`)
  concepts/frames.js         welcome() reconstruida + 3 láminas nuevas + 1 variante noche
  render-concepts.mjs        server local responde 204 a /favicon.ico (evita un falso
                              positivo no determinista del detector de errores de consola)
  shots/*.png                 38 láminas (35 anteriores + 3 nuevas de Welcome)
```

## Pendiente real

1. **Contraste del pórtico en Noche.** Las columnas (`--sc-color-clay-ivory` en tema oscuro = `#1e313b`) quedan con poco contraste local contra el fondo también oscuro — es fiel al token real, no un error del concepto, pero vale medirlo cuando esto pase a `src/**`: puede que el pórtico necesite un tono de columna un escalón más claro sólo en Noche.
2. **Descripciones de plantillas** en la vitrina son nuevas (no existe un campo `description` público reusado 1:1 de `defaultProject.ts` para las seis) — los *nombres* y la *categoría/icono* sí son exactos; el texto descriptivo de una línea es redacción de esta pasada y debería revisarse contra copy real antes de implementar.
3. Todo lo que ya estaba pendiente en el informe anterior (`2026-08-15-1600-...`) sigue igual — esta pasada no lo tocó.

## Validación

```
✓ La Cinta no desborda en ninguna de las 6 láminas Compact.
38 láminas escritas en reports/evidence/2026-08-15-cri-10-ux-system/shots/
```
`canvas-budget-cri10.mjs` sin cambios respecto a la pasada anterior (script de investigación, no depende de Welcome).
