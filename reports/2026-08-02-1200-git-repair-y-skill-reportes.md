# Reparación de git + skill de reportes entre agentes

**Fecha:** 2026-08-02
**Agente:** Claude Code
**Rama:** main

## Qué cambió

1. Se reparó el repositorio local, que tenía `.git` corrupto (error `fatal: not a git repository`, exit 128). Se reinicializó y se reconectó a `origin` (`https://github.com/klkmoraa/structureco.git`), recuperando el historial remoto de `main`.
2. Se amplió `.gitignore` para excluir backups y paquetes temporales locales (`structureCo-backup-*`, `structureCo-contexto-*`, zips partidos, carpetas de worktrees, etc.) que no deben subirse a GitHub.
3. Se creó `.claude/settings.json` con `autoPush: false` / `autoCommit: false`, para que ninguna herramienta empuje o commitee sin confirmación explícita del usuario.
4. Se creó la skill `.claude/skills/change-report/SKILL.md`: exige generar un reporte (como este) después de cada cambio relevante, y commitearlo/pushearlo para que el otro agente que trabaja sobre este mismo repo pueda verlo con `git pull`. La regla es simétrica (aplica a Claude Code y a Codex por igual).
5. Se descubrió que `AGENTS.md` (reglas persistentes que Codex lee por convención) prohibía explícitamente usar git/GitHub en este proyecto — contradecía el trabajo recién hecho. Con confirmación del usuario, se actualizó `AGENTS.md`: ahora permite git/GitHub (con push solo bajo confirmación explícita) y documenta la misma regla de reportes, para que ambos agentes queden alineados.

## Por qué

El usuario trabaja el mismo proyecto con dos agentes (Claude Code y Codex en VS Code) y quiere poder cambiar de uno a otro (p. ej. al acabarse los créditos) sin perder contexto del trabajo en curso. Como ninguno de los dos agentes comparte memoria entre sí, el repositorio git/GitHub es el único puente confiable — de ahí la necesidad de reportes explícitos commiteados junto a cada cambio.

## Archivos tocados

- `.gitignore` — ampliado con exclusiones de backups/temporales
- `.claude/settings.json` — nuevo, controla auto-push/auto-commit
- `.claude/skills/change-report/SKILL.md` — nueva skill de reportes
- `reports/2026-08-02-1200-git-repair-y-skill-reportes.md` — este reporte

## Cómo verificar

```bash
git status
git log --oneline -5
cat .claude/skills/change-report/SKILL.md
```

## Pendiente / siguiente paso

- Usuario confirmó commitear. Falta confirmar el push a `origin/main`.
- A futuro, cada nueva tarea (de cualquiera de los dos agentes) debería seguir el flujo de `change-report` / `AGENTS.md` antes de darse por terminada.
