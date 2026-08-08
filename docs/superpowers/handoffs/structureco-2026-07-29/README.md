# Handoffs del programa de mejora structureCo

Estos documentos son la fuente de verdad para continuar en otro chat sin mezclar tareas. El plan maestro es `../../plans/2026-07-29-structureco-improvement-program.md` y el estado vivo es `STATUS.md`.

## Cómo abrir una tarea en otro chat

Copiar y enviar este texto junto con el archivo de la tarea:

```text
Trabaja exclusivamente la tarea indicada en docs/superpowers/handoffs/structureco-2026-07-29/.
Lee el archivo completo y STATUS.md antes de editar. Usa el checkout structureCo y
crea un worktree/branch desde el predecesor indicado. No avances otra tarea, no
modifiques rutas fuera de alcance y no publiques. Al terminar: ejecuta la matriz
de validación indicada, revisa el diff protegido, crea un commit único, actualiza
STATUS.md y entrega branch, commit, comandos/resultados, archivos tocados,
riesgos y siguiente desbloqueo.
```

## Reglas contra confusión

1. Sólo `STATUS.md` cambia el estado de una tarea.
2. Un estado `COMPLETE` exige commit, evidencia y diff protegido; sin los tres sigue `IN_PROGRESS`.
3. Una tarea bloqueada no se salta: el siguiente chat resuelve el bloqueo o pide dirección.
4. Cada escritor usa worktree independiente; nunca dos escritores editan `ResultsPanel.tsx`, `styles.css`, pruebas portables o documentación de release a la vez.
5. Antes de iniciar T07 o T08, comprobar todos los predecesores directamente en Git, no sólo en textos históricos.

## Índice

- `T01-mobile-focus-hotfix.md`
- `T02-portable-artifact-trust.md`
- `T03-export-provenance.md`
- `T04-analysis-export-parity-investigation.md`
- `T05-mobile-results-contract.md`
- `T06-capacity-performance-baseline.md`
- `T07-release-certification-0.8.1.md`
- `T08-sites-publish.md`
- `T09-architecture-consolidation.md`
