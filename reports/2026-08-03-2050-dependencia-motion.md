# Dependencia nueva: motion (autorizada explícitamente)

**Fecha:** 2026-08-03 20:50
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Se agregó `motion@^12.43.0` (`motion/react`, sucesora de Framer Motion) a
`dependencies` en `package.json`, y se corrió `npm install`. Es la misma
versión exacta que usa `remix-structureco` en su `package.json`.

Esta es la única dependencia nueva que introduce cualquiera de las 12
carpetas de `google-ai-diffs/` (usada en `004-toast-notification`,
`006-motion-graphics`, `010-topbar-redesign-animations`, y parte de
`003-home-redesign`). Antes de este commit, esas cuatro propuestas quedaron
en espera explícitamente por esta decisión — `CLAUDE.md`/`AGENTS.md` prohíben
actualizar/agregar dependencias sin autorización.

## Por qué

Propuesta 8 del backlog. El usuario, al preguntársele directamente si
prefería agregar `motion` o que reimplementara los mismos efectos con CSS
nativo, autorizó explícitamente agregar la dependencia para lograr un
resultado fiel 1:1 a Remix (física de resortes real, no una aproximación con
`@keyframes`).

## Archivos tocados

- `package.json` — nueva entrada en `dependencies`.
- `package-lock.json` — resuelto por `npm install`.

## Cómo verificar

```bash
npm run typecheck
npm run build     # sin cambios de tamaño todavía: motion aún no se importa en ningún componente
npm ls motion      # motion@12.43.0
npm audit          # 1 alerta "high" preexistente en undici (viene de jsdom, devDependency de test, no de motion)
```

`npm audit` reporta una vulnerabilidad "high" en `undici`, pero
`npm ls undici` confirma que proviene de `jsdom@29.1.1` (devDependency usada
solo en tests), no de `motion` — es preexistente a este cambio, no algo que
`motion` introduzca. No se tocó `jsdom` en este commit; actualizarlo es una
decisión de dependencia aparte que requeriría su propia autorización.

## Pendiente / siguiente paso

`motion` está instalado pero todavía no se usa en ningún componente. Los
próximos commits (toasts, animaciones de topbar/popover, rediseño de inicio)
lo consumirán. Sin push (instrucción explícita del usuario: trabajo solo
local, sin GitHub).
