# Slice 2.7 - QA integral y evidencia

Fecha: 2026-07-17  
Estado: gate técnico aprobado.

## Comandos finales

| Comando | Resultado |
| --- | --- |
| `npm.cmd run verify` | 41 archivos, 233 pruebas, lint y build PASS |
| `npm.cmd run qa:phase2` | 117 checks PASS; 14 filas de matriz; consola/página limpias |
| `npm.cmd run qa` | 63 checks Chromium PASS; consola/página limpias |
| `npm.cmd run qa:webkit` | iPhone 13 e iPad Pro 11 PASS; 0 errores |

## Cobertura específica

- Nueve viewports de 390 x 844 a 1536 x 960.
- ES/EN y nombre de proyecto largo.
- Light/Dark, Completo/Aula.
- Listo, calculando, resuelto, desactualizado y error reales; warning cubierto por prueba unitaria y contraste renderizado.
- Focus ring, Escape y restauración de foco.
- Targets touch, texto crítico y overflow horizontal.
- `prefers-reduced-motion: reduce`.
- Zoom 200 % mediante viewport CSS efectivo: 683 x 384 y 417 x 597.
- Navegación de error a Avisos con expansión móvil.
- Captura de loading real con entrega de mensaje del worker retrasada 1200 ms sólo dentro del proceso QA.

## Hallazgos corregidos durante QA

1. Contraste de warning/error en Light: roles de foreground AA.
2. Layout shift del botón en inglés: anchos fijos por composición.
3. Un píxel fuera del header a 200 %/landscape: padding vertical de documento eliminado.
4. QA heredado de idioma/tema: actualizado a la nueva ruta por overflow.

## Frontera protegida

El diff desde `85f671d` no contiene archivos bajo `src/engine/**`, `src/workers/**`, `src/data/**`, contratos portables, `src/types.ts` o fixtures. El delay de loading existe únicamente en `qa-phase2.mjs` y no forma parte del bundle productivo.
