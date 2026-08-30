---
name: change-report
description: Use after making any meaningful change to the structureCo project (code, config, design, docs) — local files or GitHub. Generates a short report describing what changed and why, and commits/pushes it so the other agent working on this repo (Codex, in VS Code) can see it via GitHub. Trigger whenever a change is about to be considered "done", before ending a work session, or when the user says things like "reporta esto", "genera el reporte", "termina el cambio".
---

# Change Report

Este proyecto (`structureco`, repo GitHub `klkmoraa/structureco`) es trabajado por **dos agentes distintos**: Claude Code y Codex (VS Code). Ninguno de los dos tiene visibilidad de la conversación del otro — el único puente entre ambos es el repositorio git. Por eso, **todo cambio relevante debe terminar con un reporte commiteado y pusheado**, para que el otro agente pueda leerlo con un `git pull` y entender qué pasó sin tener que releer código o adivinar intención.

Esta regla es **simétrica**: aplica igual sea cual sea el agente que esté trabajando. Está espejada en `AGENTS.md` (que Codex lee por convención) para que ambos agentes la sigan de la misma forma — quien haga el cambio genera el reporte para que el otro lo vea, sin importar cuál de los dos actuó primero.

## Cuándo usar esta skill

- Después de terminar cualquier cambio de código, configuración, contenido o diseño en la carpeta nativa del proyecto.
- Después de cualquier operación de git relevante (merge, rebase, resolución de conflictos, cambio de rama).
- Antes de cerrar una sesión de trabajo, especialmente si se anticipa que el usuario continuará en Codex.
- Cuando el usuario lo pida explícitamente ("genera el reporte", "deja constancia de esto", "que Codex lo vea").

No es necesaria para exploraciones de solo lectura, preguntas, o cambios triviales sin impacto (typos, ajustes de formato) que no cambian comportamiento.

## Pasos

1. **Verificar estado del repo** antes de reportar:
   ```bash
   git status
   git diff --stat
   ```

2. **Generar el archivo de reporte** en `reports/` (crear la carpeta si no existe), con nombre:
   `reports/YYYY-MM-DD-HHmm-slug-corto.md`

   Usar este template:

   ```markdown
   # <Título corto del cambio>

   **Fecha:** YYYY-MM-DD HH:mm
   **Agente:** <Claude Code | Codex>
   **Rama:** <branch>

   ## Qué cambió
   <Resumen de 2-5 líneas, en lenguaje llano, de qué se modificó>

   ## Por qué
   <Motivación / contexto que llevó a este cambio — decisión del usuario, bug, feature, etc.>

   ## Archivos tocados
   - `path/to/file.ext` — <qué se le hizo>
   - ...

   ## Cómo verificar
   <Comandos, URL de preview, o pasos concretos para confirmar que el cambio funciona>

   ## Pendiente / siguiente paso
   <Qué falta, qué decisión está abierta, o "Nada pendiente" si el cambio está cerrado>
   ```

3. **Commitear el cambio junto con su reporte** en el mismo commit (o uno inmediatamente después):
   ```bash
   git add <archivos del cambio> reports/<archivo-de-reporte>.md
   git commit -m "<tipo>: <resumen corto>

   Reporte: reports/<archivo-de-reporte>.md"
   ```
   Seguir el estilo de mensajes ya usado en este repo (`fix:`, `feat:`, `refactor:`, `docs:`, `chore:` — ver `git log --oneline` para el patrón exacto).

4. **Pedir confirmación antes de pushear.** `.claude/settings.json` en este proyecto tiene `autoPush: false` a propósito — nunca hacer `git push` sin que el usuario lo confirme explícitamente en el chat. Una vez confirmado:
   ```bash
   git push origin <branch>
   ```
   Sin el push, Codex no puede ver el cambio — avisar claramente al usuario si el reporte quedó commiteado pero sin pushear.

5. **Confirmar al usuario** con una frase corta: qué se reportó, en qué archivo, y si ya quedó visible en GitHub o si falta el push.

## Reglas

- El reporte va siempre en español si la conversación fue en español, salvo que el usuario pida lo contrario.
- No crear un reporte por cada micro-edición — agrupar el trabajo de una tarea/sesión en un solo reporte coherente.
- Si el cambio es puramente de GitHub (PR, merge, resolución de conflicto) sin tocar archivos del proyecto, el reporte igual aplica — documentar la operación de git realizada.
- Nunca incluir credenciales, tokens o datos sensibles dentro de un reporte.
