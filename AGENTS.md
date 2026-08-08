# structureCo — reglas persistentes

- Este proyecto es trabajado por dos agentes distintos sobre el mismo repo: Claude Code y Codex. Ninguno ve la conversación del otro — git/GitHub (`github.com/klkmoraa/structureco`, rama `main`) es el único puente entre ambos.
- **USO OBLIGATORIO DE SUPERPOWERS Y PLUGINS**: Tanto Claude Code como Codex DEBEN activar y seguir el flujo de trabajo de Superpowers (`using-superpowers`, `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `verification-before-completion`, `systematic-debugging`) y aplicar los plugins configurados (`frontend-design`, `ui-theme-designer`, `code-simplifier`, `typescript-lsp`, `security-guidance`) en toda tarea de desarrollo, refactor, resolución de bugs o diseño.
- Git y GitHub SÍ están permitidos (init, ramas, commits, push, PRs) — nunca hacer push sin confirmación explícita del usuario en el chat de esa sesión.
- Después de cualquier cambio relevante (código, config, diseño, docs), generar un reporte en `reports/YYYY-MM-DD-HHmm-slug.md` (qué cambió, por qué, archivos tocados, cómo verificar, pendientes) y commitearlo junto con el cambio, para que el otro agente pueda verlo con `git pull`. Ver `.claude/skills/change-report/SKILL.md` para el template exacto.
- Antes de modificar, usar structureco-project-guardian: respaldo local, hashes, versión de package.json y alcance.
- Informar toda discrepancia de versión; una especificación, roadmap o T09 no prueba implementación.
- Activar structureco-engine-safety al tocar rutas críticas; no tocar solver en tareas visuales.
- Activar structureco-ux-responsive en UI, structureco-classroom-mode en Aula, structureco-documentation-handoff en contexto y structureco-release-certification antes de cerrar versión.
- No ampliar teoría física ni actualizar dependencias sin autorización explícita.
- Mantener unidades, signos, IDs, snapshots, topología, persistencia, undo/redo y resultados.
- No revelar secretos. Ejecutar pruebas relacionadas y no declarar éxito sin evidencia.
