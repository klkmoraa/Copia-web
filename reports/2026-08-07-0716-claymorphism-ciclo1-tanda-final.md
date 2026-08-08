# Claymorphism ciclo 1 — tanda de correccion final (post-revision "listo con reservas")

**Fecha:** 2026-08-07 07:16
**Agente:** Claude Code
**Rama:** main

## Que cambió

Única tanda de corrección tras la revisión final del ciclo 1 del rediseño claymorphism. La revisión no bloqueaba nada pero encontró una red de test que no podía detectar violaciones (verde por construcción) y varios comentarios que afirman cosas falsas o sin medir. Se corrigieron los cuatro puntos: (1) el regex de `dependencyBoundary.test.ts` no cazaba ninguna violación real — verificado por mutación, no sólo por lectura; (2) cuatro comentarios que afirmaban un ángulo de luz incorrecto (145° vs el ~151,7° medido en el pórtico) y una cobertura de test inexistente, corregidos en `isometricPortal.ts`, `tokens.css` y `PALETTE.md`; (3) una suposición sin medir sobre qué regla CSS gana en `.welcome-template-card:active`, ahora medida en Chromium real (Playwright); (4) tres desviaciones del reporte de cierre del ciclo (conteo de commits/ficheros y una explicación incorrecta sobre `prefers-reduced-motion`) corregidas contra `git log`/`git diff` y el código real.

## Por qué

Deuda de precisión, no de funcionalidad: un test que no puede fallar nunca y comentarios que afirman números o coberturas falsas son la clase de deuda que más cuesta después, porque alguien los lee y les cree sin volver a verificar. Ninguno de los cuatro puntos cambia comportamiento — cero cambios de CSS funcional o de lógica de componentes.

## Archivos tocados

- `src/design-system/components/dependencyBoundary.test.ts` — regex de frontera inversa corregido para cazar `../../engine` (y cualquier profundidad de anidamiento), alternancia regex muerta eliminada, comentarios traducidos al español.
- `src/graphics/isometricPortal.ts` — comentarios de ángulo de luz (145° del material vs ~151,7° medido en la proyección del pórtico) y de cobertura real de test para las etiquetas `left`/`right`, corregidos.
- `src/design-system/tokens.css` — comentario de la rampa `--sc-green-*` (sin consumidor `var()` real, corregido de "decorativos en el pórtico" a "rampa de origen sin consumidor directo") y comentario de "Materia clay" (mismo ajuste de ángulo que en `isometricPortal.ts`).
- `docs/design-system/PALETTE.md` — mismo ajuste de ángulo del pórtico; "seis pasos" corregido a "cinco pasos" en la fila de la tabla de `--sc-shadow-clay-*` que sólo enumera cinco tokens.
- `src/styles.css` — comentario de `portal-hero--returning` corregido (no hay listener de `pointerenter`, sólo `pointermove`); comentario de `.welcome-template-card:active` reescrito con la medición real en Chromium (motion posee `transform` vía estilo inline permanente, `border-color` no).
- `reports/2026-08-07-0130-claymorphism-ciclo1-cierre.md` — conteo corregido a 17 commits / 20 ficheros (con `git log`/`git diff` reales), tabla de ficheros completada (faltaban `PALETTE.md`, el plan y el propio reporte), y nota sobre `prefers-reduced-motion` corregida (la media query `hover: hover and pointer: fine` no excluye reduced-motion por sí sola; lo hacen una regla CSS aparte y el guard `canTilt()` en JS).

## Cómo verificar

```bash
npm run verify   # lint + verify:protected + test + build + verify:perf — todo PASS
npm run qa       # recorrido Playwright desktop+móvil — PASS (79 checks en true)
```

Mutación de verificación del punto 1 (revertida tras confirmar el rojo): inyectar `import type { ProjectModel } from '../../types';` en `src/design-system/components/surface.tsx` y correr `npx vitest run src/design-system/components/dependencyBoundary.test.ts` debe fallar nombrando `./surface.tsx`.

`npm run qa` falló dos veces seguidas en los checks `welcome{launcher,import}CardActiveTransformIsPressedTranslate` (documentados como sensibles al temporizado). Antes de asumir que era el flakiness conocido, se confirmó por control: `git stash` de los ficheros de esta tanda + rebuild + `node qa.mjs` sobre el código original sin cambios también falló en el mismo tipo de check — confirma que es preexistente y ambiental (~25 procesos `node.exe` concurrentes en la máquina), no causado por esta tanda. Restaurados los cambios, el siguiente intento pasó limpio.

## Pendiente / siguiente paso

Nada pendiente de esta tanda. Quedan documentados como deuda para el ciclo 2 (fuera de alcance de esta ronda, no tocados): consolidar el material clay repetido a mano en `styles.css` en una primitiva compartida con `.sc-surface`, y ampliar `Surface` (hoy un solo consumidor con valores por defecto) junto con el destino de los tokens sin consumidor `--sc-color-surface-pressed`, `--sc-sky-500`, `--sc-lilac-500`.
