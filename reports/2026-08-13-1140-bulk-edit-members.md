# Edición múltiple real de miembros (CRI-37, fase 2)

**Fecha:** 2026-08-13 11:40
**Agente:** Claude Code
**Rama:** `claude/cri-37-foundations` (worktree `../Structure-cri37`), rebaseada sobre `origin/main` = `dc7a597072af84bd6be8ddf35bba5664fbf1a1cd`

## Qué cambió

La multiselección deja de ser de sólo lectura **para miembros**. El panel de edición múltiple está integrado en el Inspector real y aplica cambios sobre el proyecto mediante un comando nuevo, `member.bulk.apply`.

Se corrigió además la deuda que las foundations dejaron anotada: las ~106 claves de `bulkEditCopy.ts` se migraron al catálogo global con prefijo `bulk.`, y ese módulo quedó reducido a un traductor que sólo antepone el prefijo. Ya no hay un segundo catálogo ni un segundo motor de interpolación.

Supports y loads **no** están implementados en esta entrega.

## Por qué

El riesgo de esta funcionalidad no es escribir muchas entidades, es escribir las que el usuario no tocó. El borrador guarda sólo lo editado y la ausencia significa «sin tocar», así que un valor mixto no puede convertirse en escritura. El segundo riesgo es la identidad: una sección de catálogo llega con sus números desde el catálogo, y escribir A o I por separado degrada el origen a `custom`, igual que hace `member.update`.

## Arquitectura

`executeProjectCommand` ya despacha cualquier `ProjectCommand` con **un** `compileProjectCommand` → **un** `applyProjectPatch` → **un** `commitReversibleProjectChange`. Ese es el único punto donde se registra historial y se invalida el análisis, así que un comando nuevo hereda atomicidad, un solo undo y la invalidación correcta sin tocar `ProjectContext`.

Por eso la frontera protegida quedó intacta: `src/commands/**` y `src/features/**` no están hasheados, y no hizo falta modificar `ProjectContext.tsx`, `types.ts`, `src/data/**` ni `src/engine/**`.

```
selección + borrador explícito
  → prepareBulkMemberEdit()        (features/bulk-edit, puro)
  → member.bulk.apply + sourceSnapshot
  → compileProjectCommand()        (rechaza si el modelo se movió)
  → applyProjectPatch()            (precondición por entidad + frontera)
  → commitReversibleProjectChange  (1 historial, 1 invalidación)
```

## Archivos tocados

- `src/commands/projectCommand.ts` — tipo `MemberBulkChanges`/`MemberBulkEntry`, comando `member.bulk.apply` y `applyMemberBulkChanges`, que concentra tres reglas: identidad de catálogo con sus números, degradación a `custom` al escribir E/G/densidad o A/I, y limpieza de lo que el nuevo tipo de miembro no puede sostener.
- `src/features/bulk-edit/bulkEditCommand.ts` (nuevo) — prepara el comando agrupando los miembros por el conjunto exacto de cambios que reciben.
- `src/features/bulk-edit/BulkEditInspectorPanel.tsx` (nuevo) — única pieza que conoce el store.
- `src/features/bulk-edit/BulkEditPanel.tsx` — `onApply` entrega `{intent, draft, aggregate}`; props `error` y `note`.
- `src/features/inspector/InspectorProperties.tsx` — la multiselección muestra el panel en vez del estado bloqueado.
- `src/i18n/catalogs.ts` — 110 claves `bulk.*` en ambos idiomas.
- `src/features/bulk-edit/bulkEditCopy.ts` — reducido a traductor sobre el catálogo global.
- `src/features/inspector/Inspector.test.tsx` — la prueba que afirmaba «edición masiva bloqueada» ahora afirma el contrato nuevo.

## Cómo verificar

```bash
npx vitest run src/features/bulk-edit src/features/inspector src/commands
```

## Pendiente / siguiente paso

- **Fase 3 — supports**: la agregación y la UI ya cubren apoyos (tipo, ángulo, restricciones, articulación interna); falta el comando que los aplique. Ojo al hallazgo del análisis: cambiar `support.type` debe reconstruir la `SupportDefinition` completa, como hace el Inspector, o quedan `angleDeg`/`restrain*` obsoletos y `prescribed` huérfano.
- **Fase 4 — loads**: sin empezar. Requiere tratar cada familia de `MemberLoad` por separado; los campos de una familia no existen en las otras.
- Límites conocidos que siguen abiertos: la agregación compara valores almacenados y no efectivos, así que dos rodillos equivalentes (uno con `angleDeg` implícito) se leen «Varios»; y no se puede habilitar y configurar en una sola pasada.

Sin push. Sin merge a `main`.
