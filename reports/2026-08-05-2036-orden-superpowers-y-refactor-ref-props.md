# Orden de propuestas Antigravity, regla de Superpowers y migración forwardRef → ref-as-prop

**Fecha:** 2026-08-05 20:36
**Agente:** Claude Code
**Rama:** main

## Qué cambió

1. **AGENTS.md**: se agregó una regla explícita de uso obligatorio de Superpowers (`using-superpowers`, `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `verification-before-completion`, `systematic-debugging`) y de los plugins de diseño/calidad (`frontend-design`, `ui-theme-designer`, `code-simplifier`, `typescript-lsp`, `security-guidance`) para ambos agentes. Se replicó en `CLAUDE.md` (nuevo archivo en la raíz del repo, guía para Claude Code con arquitectura, comandos y frontera matemática protegida).
2. **`Antigravity-propuestas/`** se reorganizó en subcarpetas por estado (`propuestas/`, `implementadas/`, `descartadas/`, `revisiones/`, `recursos/`), moviendo fichas individuales que antes vivían solo como filas en `backlog.md`/`roadmap.md`. `backlog.md` y `roadmap.md` se actualizaron para reflejar: AG-009 (presets de materiales/perfiles AISC-Eurocódigo) como **Implementada**, y AG-010 (exportación DXF) movida a **Descartada** por decisión del usuario (foco en app web y memorias PDF, no en interoperabilidad CAD).
3. **Migración `forwardRef` → `ref` como prop de React 19** en la librería de componentes (`src/design-system/components/controls.tsx`: `Button`, `IconButton`, `Field`, `Select`; `src/design-system/components/editor.tsx`: `ToolButton`, `UnitField`; `src/features/workspace/AppShellLayout.tsx`: `AppShellLayout`). Sin cambio de comportamiento — solo la forma de declarar el componente, aprovechando que React 19 permite pasar `ref` como prop normal sin `forwardRef`.

## Por qué

- La regla de Superpowers estaba documentada como práctica pero no era obligatoria explícitamente para ambos agentes; se formalizó tras confirmar que el flujo (brainstorming → plan → TDD → verificación) es el estándar esperado en este repo.
- El backlog de propuestas Antigravity había crecido lo suficiente como para que mantener todo en dos tablas markdown planas dificultara el seguimiento; se separó en carpetas por estado del ciclo de vida de cada propuesta.
- AG-010 se descartó por alcance: el usuario prefiere seguir invirtiendo en la app web y en las memorias de cálculo PDF antes que en exportación CAD.
- La migración de `forwardRef` es una limpieza de estilo habilitada por React 19 (ya en uso en el proyecto), sin impacto funcional.

## Archivos tocados

- `AGENTS.md` — regla de uso obligatorio de Superpowers/plugins.
- `CLAUDE.md` (nuevo) — guía de arquitectura para Claude Code en la raíz del repo.
- `Antigravity-propuestas/backlog.md`, `Antigravity-propuestas/roadmap.md` — AG-009 implementada, AG-010 descartada.
- `Antigravity-propuestas/propuestas/`, `Antigravity-propuestas/implementadas/`, `Antigravity-propuestas/descartadas/`, `Antigravity-propuestas/revisiones/`, `Antigravity-propuestas/recursos/` (nuevos) — fichas individuales reorganizadas por estado.
- `src/design-system/components/controls.tsx`, `src/design-system/components/editor.tsx`, `src/features/workspace/AppShellLayout.tsx` — `forwardRef` → `ref` como prop (React 19).

## Cómo verificar

```bash
npm run typecheck
npm run lint
npm test
```

No se ejecutó `npm run verify` completo en esta sesión porque el pedido del usuario fue exclusivamente sincronizar el repo con GitHub; se recomienda correrlo antes del próximo cambio funcional.

## Pendiente / siguiente paso

Nada pendiente de este cambio en particular. Junto con este commit se suben también 11 commits locales previos (AG-001, AG-002, AG-003, AG-004, AG-005, AG-009, AG-011, AG-013 y fixes de QA/canvas/PDF) que ya tenían sus propios reportes en `reports/` pero no habían sido pusheados a `origin/main`.
