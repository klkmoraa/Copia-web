# Fix: selector obsoleto `.welcome-steps` en qa-webkit.mjs y qa.mjs

**Fecha:** 2026-08-05 12:30
**Agente:** Claude Code
**Rama:** main

## Qué cambió

`qa-webkit.mjs` y `qa.mjs` fallaban de forma consistente en el check `welcomeStepsReachable` (iPhone 13, 390×844, 430×932) desde antes de cualquier cambio de AG-004 — confirmado reproducible con `git stash` limpio. Investigado y corregido: no era una regresión de layout, era un selector CSS obsoleto en los propios scripts de QA.

## Por qué

El commit `31bd254` (`feat(welcome): rediseñar la pantalla de inicio con motion`) renombró la sección `<section className="welcome-steps">` de `WelcomeScreen.tsx` a `<section className="welcome-workflow">`, pero nunca actualizó `qa-webkit.mjs`/`qa.mjs`, que seguían buscando `.welcome-steps` (introducido en `85f671d`, el commit baseline). `element.querySelector('.welcome-steps')` devolvía `null` siempre, por lo que `stepsReachable` era `false` sin importar el layout real. El check de `.welcome-footer` (que sí seguía existiendo) pasaba correctamente, lo cual apuntaba a un selector desalineado y no a un problema de scroll/overflow real.

## Archivos tocados

- `qa-webkit.mjs` — `verifyWelcomeScroll`: `.welcome-steps` → `.welcome-workflow`.
- `qa.mjs` — `verifyWelcomeMobileScroll`: mismo cambio.

## Cómo verificar

```bash
npm run qa:webkit
npm run qa
```

Ambos quedan en verde. `qa-webkit.mjs` reporta `welcomeStepsReachable: true` en iPhone 13; `qa.mjs` reporta `welcome390x844StepsReachable: true` y `welcome430x932StepsReachable: true`. `npm run lint` también sigue en verde tras el cambio.

## Pendiente / siguiente paso

Nada pendiente. Nota aparte: durante esta sesión aparecieron cambios no generados por mí en `Antigravity-propuestas/backlog.md` y `Antigravity-propuestas/roadmap.md` (marcando AG-004/AG-005 como implementadas) — probablemente de otro proceso/sesión trabajando el mismo repo. Se dejaron sin commitear para que quien los generó los revise y confirme antes de integrarlos.
