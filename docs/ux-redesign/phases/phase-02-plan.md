# Plan de ejecución - Fase 2

Fecha: 2026-07-17  
Estado: opción A aprobada; baseline Git creado y ejecución por slices en curso.

## Preguntas de Fase 2

### 1. Resuelta - trazabilidad Git

**Respuesta del propietario:** sí, opción A autorizada; Codex ejecutará la fase completa de extremo a extremo.

- Contexto observado: `git rev-parse` falla; no existe `structureCo/.git`; el `.git` del directorio padre está vacío y no contiene metadata utilizable.
- Opción A - recomendada: inicializar Git, commit baseline y rama dedicada. Permite diff, rollback, commits por slice y reporte inicial/final.
- Opción B: no inicializar Git y continuar con manifiestos SHA-256 y lista explícita de archivos. Conserva trazabilidad parcial, pero no ofrece rollback ni revisión por commits.
- Ejecución: commit baseline `85f671d968426502d9d41425b86ca6abde1fd2bf`; rama `phase/2-ui-foundations`.

## Supuestos explícitos no bloqueantes

1. Las referencias aprobadas son las páginas 27-31 del PDF rector de Fase 2; no se generará un diseño alternativo.
2. Se conservará una pila tipográfica local/sistema. No se descargarán ni bundlearán Manrope o Inter.
3. No se añadirán dependencias. React, CSS, lucide y Playwright existentes bastan.
4. La migración será incremental sobre la TopBar actual, sin duplicar DOM completo ni feature flag.
5. El indicador de análisis consumirá `analysis`, `isAnalyzing`, validación y estado de proyecto existentes; no creará una segunda fuente matemática.
6. Gmail está configurado y fue comprobado durante la entrega de Fase 1.
7. Si un cambio requiere rediseñar inspector, resultados, canvas o Aula, se limitará a un adapter mínimo o se diferirá.

## Fuente visual y sistema a extraer

| Referencia | Fuente | Uso en Fase 2 |
| --- | --- | --- |
| A | PDF rector, página 27 | TopBar por Documento/Contexto/Acciones e indicador global. |
| B | PDF rector, página 28 | Separación marca, interacción, estado y magnitudes técnicas. |
| C | PDF rector, página 29 | Contraste, foco, targets y estados de controles. |
| D | PDF rector, página 30 | Misma base funcional con composición desktop/tablet. |
| E | PDF rector, página 31 | Header mínimo y targets móviles. |

No se usarán estas imágenes dentro de la UI. Se usarán como especificación de jerarquía y comportamiento.

## Mapa previsto de archivos productivos

| Ruta | Slice | Motivo previsto |
| --- | --- | --- |
| `src/styles.css` | 2.1-2.6 | Tokens, temas, tipografía, targets, shell, TopBar, responsive y consolidación de reglas tocadas. |
| `src/components/WorkspaceShell.tsx` | 2.3 | Regiones/composición responsive sin cambiar canvas, inspector o resultados internos. |
| `src/components/TopBar.tsx` | 2.4-2.5 | Zonas Documento/Contexto/Acciones, overflow y estado global derivado. |
| `src/components/TopBar.test.tsx` | 2.2-2.5 | Acciones conservadas, estados, accesibilidad y estructura responsive. |
| `src/i18n/catalogs.ts` | 2.5 | Copys UI mínimos del indicador de análisis en ES/EN. |
| `qa.mjs` | 2.2-2.7 | Matriz geométrica, overlaps, targets, nombres largos y zoom. |
| `qa-webkit.mjs` | 2.2-2.7 | Targets y composición WebKit en perfiles touch. |

Archivos nuevos sólo si reducen acoplamiento y quedan justificados:

- `src/components/AnalysisStatus.tsx` y su prueba, para aislar presentación derivada sin duplicar estado.
- `src/styles/tokens.css` únicamente si separar tokens de `styles.css` mejora una sola fuente real y la importación queda simple.

## Fronteras que no se tocarán

- `src/engine/**`, `src/workers/**` y formulación matemática.
- `src/data/**`, migraciones y defaults de dominio.
- `src/utils/portable*`, importación/exportación y schema.
- `src/types.ts`, salvo que una necesidad puramente presentacional comprobada lo exija y sea aprobada aparte.
- Semántica de undo/redo, snapping, selección, gestos, invalidación o resultados.
- Arquitectura interna de ToolBar, StructuralCanvas, Inspector, ResultsPanel, ClassroomGuide y WelcomeScreen.

## Slices y gates

### 2.1 - Tokens y fundamentos

- Crear taxonomía primitiva/semántica y aliases temporales.
- Definir light/dark, tipografía, números tabulares, spacing, radius, elevation, controls, layout, motion y z-index.
- Gate: sin valores mágicos nuevos en TopBar/shell; temas y roles separados; `verify` aprobado.

### 2.2 - Tipografía y targets P0

- Elevar texto crítico a 12 px mínimo y cuerpo a 14 px cuando el espacio lo permita.
- Asegurar hitboxes frecuentes de 44x44 px en pointer coarse.
- Gate: bounding boxes medidos, foco visible, sin clipping ES/EN, shortcuts conservados.

### 2.3 - App Shell responsive

- Composición wide, standard, compact/tablet y mobile antes de colisión.
- Conservar selección, análisis y estado al cambiar viewport.
- Gate: 1194x834 sin colisión, 834x1194/390x844 sin overflow y canvas útil.
- Parada: presentar diferencias importantes antes de seguir.

### 2.4 - TopBar por zonas

- Zona A Documento, Zona B Contexto, Zona C Acciones.
- Mover secundarios al overflow sin perder acceso, nombre accesible o foco.
- Gate: cero intersecciones en 390, 430, 834, 1024, 1194, 1280, 1366, 1440 y 1536.

### 2.5 - Estado global de análisis

- Mostrar listo, calculando, resuelto, desactualizado, advertencia y error desde estado existente.
- Gate: texto + icono, `aria-live`, sin layout shift ni payload nuevo.

### 2.6 - Consolidación y temas

- Consolidar únicamente reglas tocadas; light/dark y reduced motion.
- Gate: sin overrides contradictorios ni warnings de React/consola.

### 2.7 - QA y cierre

- Ejecutar lint, tests, build, verify, QA, WebKit, zoom 200 %, teclado, touch y comparación visual.
- Generar PDF final con capturas y enviarlo a `crisdlm302@gmail.com`.
- Gate: tres P0 cerrados, cero tests rojos y motor intacto.

## Definición de terminado

La Fase 2 sólo podrá marcarse lista para revisión cuando todos los gates cuantitativos pasen, las acciones existentes sigan accesibles, no haya cambios matemáticos y el reporte/correo estén confirmados. No se iniciará Fase 3 automáticamente.
