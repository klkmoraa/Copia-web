# Edición múltiple de apoyos (CRI-37, fase 3)

**Fecha:** 2026-08-13 12:30
**Agente:** Claude Code
**Rama:** `claude/cri-37-foundations` sobre `origin/main` = `dc7a597`

## Qué cambió

La edición múltiple ya escribe apoyos. El comando de miembros se generalizó a la
selección completa —`selection.bulk.apply` con `entries` (miembros) y
`nodeEntries` (nudos)— para que una confirmación sobre una selección mixta siga
siendo **una** entrada de historial. La arquitectura y las pruebas de la fase 2
se conservan intactas: sólo cambió el nombre del `kind` y se añadió un campo.

Propiedades de nudo soportadas: tipo de apoyo, normal del rodillo, restricciones
Ux/Uy/Rz y articulación interna. Son las que el modelo guarda de verdad.

## Por qué

Cambiar `support.type` escribiendo sólo ese campo deja basura física: las
banderas de un apoyo personalizado anterior, la normal de un rodillo que ya no
existe, y —lo más grave— movimiento impuesto que el apoyo nuevo no restringe.
El solver valida esa correspondencia, así que el modelo quedaría inanalizable.

`rebuildSupport` reconstruye la `SupportDefinition` entera, igual que hace el
Inspector al editar de uno en uno: conserva los muelles (independientes del
tipo), da al rodillo su normal, da al personalizado sus tres banderas explícitas
y descarta el resto. Después, `applyNodeBulkChanges` retira del apoyo el
`prescribed` que el tipo resultante no puede restringir, y el comando retira del
proyecto los `prescribedDisplacements` por caso que quedarían colgando.

## Archivos tocados

- `src/commands/projectCommand.ts` — `NodeBulkChanges`/`NodeBulkEntry`,
  `rebuildSupport`, `prescribedComponentsFor`, `applyNodeBulkChanges`, y la rama
  del comando renombrada a `selection.bulk.apply` con limpieza de asientos.
- `src/features/bulk-edit/bulkEditCommand.ts` — `prepareBulkEdit` agrupa también
  nudos por el conjunto exacto de cambios; `isSelected` se comparte.
- `src/features/bulk-edit/BulkEditInspectorPanel.tsx` — considera ambas familias.
- `src/features/bulk-edit/bulkEditSupports.test.ts` (nuevo) — 12 pruebas.

## Cómo verificar

```bash
npx vitest run src/features/bulk-edit src/features/inspector src/commands
```

`typecheck`, `lint`, `verify:protected` (30 archivos, frontera intacta) en verde.
116 pruebas en el área de bulk-edit, 87 en inspector/commands/i18n.

## Pendiente / siguiente paso

- **Fase 4 — loads**: sin empezar. La agregación sólo conoce miembros y nudos;
  las cargas necesitan descriptores por familia (`nodal`, y `member` dividido en
  `distributed`/`point`/`moment`), porque los campos de una familia no existen en
  las otras.
- **Fase 5 — UX final**: filtro de alcance por tipo, pantalla «Revisar cambios».
- Límites heredados aún abiertos: agregación por valor almacenado y no efectivo;
  habilitar y configurar exige dos pasadas.

Sin push. Sin merge a `main`.
