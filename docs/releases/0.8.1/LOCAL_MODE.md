# Modo de trabajo local para structureCo 0.8.1

**Vigencia:** desde el 2 de agosto de 2026 hasta que el usuario autorice explícitamente lo contrario.

## Decisión del usuario

> La carpeta local es la fuente de verdad y el espacio compartido entre Claude Code y Codex.
> GitHub se utilizará solamente al terminar, después de certificar la versión 0.8.1 y recibir
> autorización explícita.

Esta decisión **reemplaza** para esta fase lo indicado en `AGENTS.md` líneas 3–4, que declara a
git/GitHub como puente entre agentes.

## Prohibido durante 0.8.1

Ningún agente (Claude Code, Codex, subagentes) puede ejecutar:

- `git fetch`, `git pull`, `git push`
- consultas a `origin` o a cualquier remoto
- conectores de GitHub, `gh`, MCP de GitHub/GitKraken con acceso remoto
- creación de issues, pull requests, ramas remotas, tags o releases
- deploy, publicación o cambios de visibilidad del repositorio

## Permitido

- `git status`, `git diff`, `git diff --stat`, `git log`, `git branch --show-current`
- crear ramas locales y commits locales pequeños
- comparar antes/después con el historial local

## Prohibido siempre (destructivo)

`git reset --hard`, `git clean -fd`, `git checkout -- .`, rebase destructivo, force push,
o cualquier comando que descarte cambios locales sin revisión expresa.

## Estado del working tree al iniciar

Rama `main`, commit base `3564505`. Archivos sin trackear preexistentes que **no deben
descartarse ni sobrescribirse**:

- `.claude/launch.json`
- `structureCo-contexto-total-autocontenido-0.8.0.zip.manifest.json`
- `structureCo-design-exploration-final-critical-20260801.json`
- `structureCo-design-exploration-initial-critical-20260801-151246.json`

## Cierre

Al terminar la certificación local se presentará el informe completo y se preguntará al usuario
si autoriza comparar el estado local con el remoto. Ninguna acción remota ocurre antes de una
respuesta afirmativa explícita, y cada acción remota posterior se autoriza por separado.
