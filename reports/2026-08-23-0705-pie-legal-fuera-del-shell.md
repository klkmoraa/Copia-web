# Fase 5 del rediseño total · el pie legal fuera del shell

**Fecha:** 2026-08-23 07:05
**Agente:** Claude Code
**Rama:** `claude/redeseno-total-mejoras-gimaf7`

## Qué cambió

El aviso profesional deja de ser una banda fija de la Mesa. Ocupaba **22 px de alto en
cada pantalla y en las tres composiciones, siempre**, y a cambio nadie lo lee después de
la primera vez. Ahora vive donde de verdad se lee —la entrada del producto, la memoria de
cálculo PDF— y en el menú de utilidades, alcanzable en un gesto.

**Medido, mismo encuadre y mismo modelo:** el lienzo pasa de **876 a 898 px** de alto.

## Y lo que eso mueve, que no es cosmético

`CHROME.footerWide` pasa de 22 a 0, y `wideStageHeight` lo resta del escenario: **la
frontera calculada X2↔M1 se mueve**.

| Alto | Frontera antes | Frontera ahora |
|---|---|---|
| 720 | 1130 | **1081** |
| 768 | 1117 | **1073** |
| 800 | 1109 | **1068** |
| 900 | 1089 | **1055** |
| 1080 | 1065 | **1038** |
| 1366 | 1042 | **1024** |

Ésa es la ganancia real: un portátil de 1100 px de ancho a 768 de alto **se quedaba en
Medium** —riel de iconos, detalle superpuesto— y ahora entra en **Expanded**, con su riel
etiquetado y su panel acoplado. La tabla está **recalculada contra CB-1..CB-4**, no
ajustada a mano: sigue sin haber un solo número escrito en el resolutor.

## Archivos tocados

- `src/features/workspace/WorkspaceShell.tsx` — se retira la prop `footer`.
  `AppShellLayout` la conserva para quien la necesite; la Mesa deja de pasarla.
- `src/features/topbar/TopBar.tsx` — el aviso entra al pie del menú de utilidades.
- `src/features/workspace/shellComposition.ts` — `CHROME.footerWide: 22 → 0`, con el
  porqué escrito donde está el número.
- `src/features/workspace/shellComposition.test.ts` — **el gate no se relaja: se
  recalcula.** La tabla de fronteras y el barrido de histéresis (1085 subiendo contra
  1060 bajando, los mismos 24 px de banda alrededor de 1073) llevan los números nuevos y
  la explicación de por qué bajaron.
- `src/features/workspace/shellRecomposition.test.tsx` — el ancho testigo de Medium baja
  de 1100 a 1040, porque 1100 a 768 de alto **ya es X2**. Lo que ese gate fija no es el
  número: es que la recomposición cruce las dos fronteras sin perder selección, borrador
  ni foco.
- `src/styles.css` — `.professional-note` (5 reglas, 4 selectores en reglas mixtas) sale
  con `postcss`; entra `.menu-professional-note`.

## Cómo verificar

```bash
npm run verify
PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium npm run qa
```

Los dos ejecutados y leídos:

- `npm run verify` — **232 archivos / 2278 pruebas** (8 saltadas), lint limpio,
  `verify:protected` = «Frontera protegida intacta: 38 archivos» **sin refrescar la línea
  base**. Carga inicial 869 727 → 869 376 bytes.
- `npm run qa` — **148 checks**, `exit=0`, ninguno en `false`, cero consola.

Evidencia visual en `reports/evidence/2026-08-23-pie-legal-fuera-del-shell/`, con la
medición del alto del lienzo antes y después.

## Pendiente / siguiente paso

Siguiente y última fase del plan: **partir `src/styles.css`**, hoy en 5 042 líneas tras
las limpiezas de las fases anteriores.

Sigue abierto, preexistente, el solape de la barra superior a 390 px de la Fase 1.
`npm run qa:webkit` no se ejecutó: WebKit no está instalado en este entorno.
