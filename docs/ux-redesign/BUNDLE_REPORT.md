# Bundle report

Fase 13 - comparación reproducible contra `49090f5`.

## Método

- Entorno de baseline: Node `24.18.0`, npm `11.16.0`, Vite `8.1.4`.
- El baseline se auditó desde un `git archive` limpio del commit de Fase 12; sus hashes coincidieron con el build del worktree aceptado.
- La medición actual suma bytes raw y gzip nivel 9 de los assets realmente precargados por `dist/index.html`.
- El costo temprano del workspace considera el preload idle/700 ms que ya existía en `App.tsx`; no incluye PDF, Import Center, workers ni vistas avanzadas que permanecen bajo demanda.
- `npm.cmd run qa:phase13` reconstruye y mide el árbol actual contra las constantes auditadas de `49090f5`; no reconstruye automáticamente el commit histórico. Para reauditar esas constantes se debe extraer `git archive 49090f5`, instalar con el lockfile y ejecutar el mismo build/medidor en un directorio temporal.

## Resultado

| Grupo de red | Baseline raw | Fase 13 raw | Delta | Baseline gzip | Fase 13 gzip | Delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Entrada síncrona | 535,518 B | 536,233 B | +715 B (+0.13%) | 141,782 B | 143,669 B | +1,887 B (+1.33%) |
| Workspace temprano incremental | 402,008 B | 370,096 B | -31,912 B (-7.94%) | 107,661 B | 99,025 B | -8,636 B (-8.02%) |
| Costo temprano combinado | 937,526 B | 906,329 B | -31,197 B (-3.33%) | 249,443 B | 242,694 B | -6,749 B (-2.71%) |

La entrada total queda materialmente estable. La extracción de módulos compartidos reduce el archivo `index` por sí solo, pero ese número no se presenta como ahorro porque los chunks compartidos siguen siendo precargados por HTML. La mejora real medida está en el costo incremental del workspace.

## Carga diferida nueva

| Chunk | Raw | Gzip | Condición |
| --- | ---: | ---: | --- |
| `InfluenceLineView` | 32,850 B | 10,096 B | Sólo después de foco/hover o activación de la pestaña Influencia. |

El gate de navegador confirmó:

- el chunk no se solicita en Welcome;
- tampoco se solicita al abrir y analizar el workspace mientras Influencia no se active;
- se solicita y renderiza correctamente al abrir la pestaña;
- consola y `pageErrors` permanecen vacíos.

## Limpieza de repositorio

Los cinco archivos retirados sumaban 30,952 bytes versionados, pero 0 bytes del bundle porque no tenían imports. Se registra como higiene y reducción de deuda, no como mejora de carga.

## Módulos pesados conservados bajo demanda

| Área | Raw aproximado | Decisión |
| --- | ---: | --- |
| PDF worker | 2,366,081 B | Mantener on-demand; no forma parte del arranque. |
| PDF.js | 479,842 B | Mantener on-demand. |
| pdf-lib/locale asociado | 428,290 B | Mantener on-demand. |
| Import Center portable | 25,360 B más dependencias | Mantener como frontera lazy. |
| Workers de análisis/escenarios/influencia | 81-91 KB cada uno | Mantener; se cargan por sus flujos y no se modificaron. |

## Riesgos y límites

- El gzip síncrono sube 1.33% por partición de chunks, dentro del umbral reproducible de 2%; no se oculta en el total combinado.
- No se dividió `styles.css`: la cascada y sus media queries tienen mayor riesgo visual que el ahorro potencial sin cobertura adicional.
- No se optimizó `portableFile -> portableBundle -> calculationPdf` porque tocaría contratos protegidos de import/export.
- No se modificaron solver, workers, persistencia, schema, unidades, IDs ni geometría.

## Evidencia

- `docs/ux-redesign/evidence/phase-13/after/phase13-metrics.json`
- `docs/ux-redesign/evidence/phase-13/after/phase13-lazy-influence-1366x768.png`
- `docs/ux-redesign/evidence/phase-13/after/phase13-shared-modal-focus-1366x768.png`
