# structureCo — reglas persistentes

Este archivo describe **este** repositorio (`github.com/klkmoraa/Copia-web`), no el
original del que salió. Las reglas que quedan son las que tienen un gate que las
respalde o una razón que se pueda comprobar; las que sólo eran costumbre se
retiraron. Una regla que nadie puede verificar no es una regla, es un deseo.

## Qué manda, y en qué orden

1. El código, las pruebas y los gates ejecutables.
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

Cinco gates lo sostienen y ninguno se relaja para dejar pasar un cambio: si un
contrato deja de valer, se reescribe el gate explicando por qué.

| Gate | Qué vigila |
|---|---|
| `tokens.test.ts` | Contraste de cada rol contra los dos fondos de su apariencia. |
| `surfaceGeometry.test.ts` | Radios por rol, elevación monótona, filete de medio píxel. |
| `material.test.ts` | Los seis niveles, el material translúcido y su respaldo opaco. |
| `typography.test.ts` | Cara del sistema primero, escala de escritorio. |
| `npm run qa` | Lo mismo, compuesto por el navegador de verdad. |

## Flujo de trabajo

- Rama de trabajo, commit y `git push -u origin <rama>`. Este repositorio usa
  ramas; `main` no es la rama de trabajo ordinaria.
- No se hace push sin que el usuario lo pida en esa sesión.
- No se abre Pull Request salvo petición explícita.
- Antes de cerrar: `npm run verify` (lint · documentación · frontera protegida ·
  pruebas · build · presupuesto). No se declara éxito sin haberlo ejecutado y
  leído. Si algo falla, se dice qué falla y se pega la salida.
- Tras un cambio relevante, generar el reporte en `reports/YYYY-MM-DD-HHmm-slug.md`
  y commitearlo con el cambio (ver `.claude/skills/change-report/SKILL.md`). Ese
  reporte es el puente con el otro agente que trabaja el repo: ninguno de los dos
  ve la conversación del otro.

## Documentación

Mantener la clasificación `CANONICAL`, `REFERENCE`, `HISTORICAL` o
`AUDIT/TEMPORARY` en toda documentación nueva o reclasificada, y no crear fuentes
de verdad paralelas. `npm run verify:docs` lo comprueba.
