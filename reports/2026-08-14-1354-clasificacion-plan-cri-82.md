# Reparar el gate documental: clasificación ausente en el plan de CRI-82

**Fecha:** 2026-08-14 13:54
**Agente:** Claude Code
**Rama:** `main`

## Qué cambió

`docs/superpowers/plans/2026-08-14-datasheet-editor-cri-82.md` no declaraba
clasificación documental, así que `npm run verify:docs` —y con él
`npm run verify` completo— fallaba en `main` para cualquiera que lo ejecutara.

Se añadió la línea `**Clasificación:** \`HISTORICAL\`` bajo el H1, más el aviso
`> **HISTORICAL** — …` que `scripts/check-docs.mjs` exige a todo documento con esa
clasificación dentro de sus primeras 12 líneas. El texto sigue el patrón de sus
hermanos (`2026-08-12-advanced-2d-structural-editing.md` y el diseño de CRI-82) y
apunta al contrato vigente, el [Datasheet estructural](../docs/architecture/structureco-datasheet.md).

`HISTORICAL` es la clasificación correcta: es un plan de ejecución, conserva el
método y la evidencia de su entrega, y no certifica el estado actual del producto.

## Por qué

Regresión documental introducida con el trabajo de CRI-82 (commits `dc9b7c6` /
`9720954`). No es un problema de contenido —el plan está completo— sino del
metadato que el gate exige a todo archivo bajo `docs/**`. Mientras faltara,
`npm run verify` no podía pasar en verde para nadie, lo que oculta cualquier
fallo real que ese gate detecte después.

Detectado al ejecutar los gates durante CRI-42; se repara aparte para no mezclar
un arreglo de `main` con una rama de funcionalidad.

## Archivos tocados

- `docs/superpowers/plans/2026-08-14-datasheet-editor-cri-82.md` — añadida la
  línea de clasificación `HISTORICAL` y su aviso de apertura.

**`docs/README.md` no necesitó cambios:** el plan ya estaba indexado en
«Documentos históricos» (línea 56), igual que el diseño de CRI-82, apuntando al
Datasheet estructural como sustitución vigente. Se verificó antes de tocar nada.

## Cómo verificar

```bash
npm run verify:docs
```

Antes: `Verificación documental: 1 problema(s). - docs/superpowers/plans/2026-08-14-datasheet-editor-cri-82.md: falta la línea de clasificación documental.` (salida 1).

Después: `Verificación documental: 26 documento(s) bajo docs/** clasificados; archivos obligatorios y enlaces relativos válidos.` (salida 0), con los 2 tests de `scripts/check-docs.test.mjs` en verde.

## Pendiente / siguiente paso

- **Commiteado en `main` local, sin pushear** — falta la confirmación del usuario.
  Hasta entonces Codex no lo verá con `git pull`.
- No toca código, configuración ni el resto de gates.
