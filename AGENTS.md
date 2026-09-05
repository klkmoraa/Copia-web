# structureCo — reglas persistentes

Este archivo describe **este** repositorio (`github.com/klkmoraa/Copia-web`), no el
original del que salió. Las reglas que quedan son las que tienen un gate que las
respalde o una razón que se pueda comprobar; las que sólo eran costumbre se
retiraron. Una regla que nadie puede verificar no es una regla, es un deseo.

## Qué manda, y en qué orden

1. El código y la evidencia de verificación ejecutada.
2. La documentación canónica (`docs/README.md` es el índice).
3. Las referencias.
4. La documentación histórica y la evidencia de auditoría (`reports/**`).

Ante una discrepancia gana lo de más arriba. Una especificación, un roadmap o un
reporte antiguo **no prueban** que algo esté implementado.

## Fronteras que no se cruzan

- `src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx`
  y `src/types.ts` son la frontera matemática protegida. `npm run verify:protected`
  compara su huella contra `scripts/protected-baseline.sha256`. Una tarea visual,
  de exportación o de documentación tiene que dejarlos byte a byte idénticos.
  Cambiarlos requiere autorización explícita y un refresco deliberado de la línea
  base (`--update`).
- No se amplía teoría física ni se actualizan dependencias sin autorización.
- Se mantienen unidades, signos, IDs, snapshots, topología, persistencia,
  undo/redo y resultados.
- No se revelan secretos.

## Identidad visual

`src/design-system/tokens.css` es la fuente única de color, forma, materia y
tipografía; `material.css` reparte la materia por `data-level`. El resto del CSS
consume roles, nunca literales. `src/design-system/README.md` explica el sistema
y `brand/brandbook.html` lo enseña leyendo los tokens en vivo.

Los gates existentes siguen disponibles como herramientas, pero no se ejecutan todos por rutina. Se usa únicamente el gate relacionado con la superficie modificada.

## Verificación mínima

- No ejecutar `npm run verify`, `npm run qa`, la suite completa ni gates no relacionados por rutina.
- Para UI, estilos, copy y composición: usar build/typecheck y revisión visual puntual cuando aporten señal útil.
- Si una tarea visual debe demostrar que la frontera matemática quedó intacta, ejecutar únicamente `npm run verify:protected` en lugar de toda la suite.
- Para cambios autorizados en solver, matemáticas, unidades, cargas, análisis o resultados: ejecutar sólo las pruebas focalizadas de la zona tocada y un caso pequeño de referencia si cambia el comportamiento numérico.
- Para persistencia, migraciones, import/export o undo/redo: validar sólo el flujo tocado y comprobar conservación de datos.
- Ejecutar `npm run verify` completo únicamente si el usuario lo pide expresamente, si se prepara una release importante o si un cambio transversal no puede aislarse de manera razonable.
- No crear pruebas nuevas para cambios puramente visuales salvo que exista una regresión concreta que convenga fijar.
- Indicar brevemente qué se verificó y qué no; no presentar como validado aquello que no se ejecutó.

## Flujo de trabajo

- Rama de trabajo, commit y `git push -u origin <rama>`. Este repositorio usa
  ramas; `main` no es la rama de trabajo ordinaria.
- No se hace push sin que el usuario lo pida en esa sesión.
- No se abre Pull Request salvo petición explícita.
- Antes de cerrar, aplicar únicamente la verificación mínima correspondiente al cambio según la sección anterior.
- Tras un cambio relevante, generar el reporte en `reports/YYYY-MM-DD-HHmm-slug.md`
  y commitearlo con el cambio (ver `.claude/skills/change-report/SKILL.md`). Ese
  reporte es el puente con el otro agente que trabaja el repo: ninguno de los dos
  ve la conversación del otro.

## Documentación

Mantener la clasificación `CANONICAL`, `REFERENCE`, `HISTORICAL` o
`AUDIT/TEMPORARY` en toda documentación nueva o reclasificada, y no crear fuentes
de verdad paralelas. `npm run verify:docs` queda disponible cuando el cambio realmente toque documentación canónica o su clasificación.
