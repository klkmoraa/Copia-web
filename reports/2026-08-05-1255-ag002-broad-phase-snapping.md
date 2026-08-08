# AG-002 — Broad-phase espacial y snapping sin asignaciones

**Fecha:** 2026-08-05 12:55
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Se implementó la propuesta AG-002 sobre `src/utils/snapping.ts`, sin tocar la firma pública ni los
tipos (`SnapCandidate`, `SnapKind`, `SnapSegment`, `SnapOptions`, `SnapResult`) y sin dependencias
nuevas:

1. **Cuadrícula espacial de broad-phase** en `buildIntersectionSnapCandidates`: se indexan las cajas
   envolventes de los miembros en cubetas (máx. 64×64 celdas, eje ≈ `√M`) y solo los pares que comparten
   celda llegan a la prueba exacta de producto cruzado, con un rechazo AABB extra antes de la geometría.
2. **Hash espacial de puntos** para colapsar coincidencias, en lugar del `candidates.find(...)` lineal
   que hacía el deduplicado cuadrático. Se usa tanto en intersecciones como en perpendiculares.
3. **Barrido sin asignaciones en `resolveSnap`**: se eliminó la cadena
   `concat → filter → map → filter → sort` (4 arreglos + un objeto por candidato en cada `pointermove`)
   a favor de un solo recorrido con rechazo por eje X que solo conserva el mejor candidato.
4. **Perpendiculares memoizadas** en `StructuralCanvas`: `buildPerpendicularSnapCandidates` depende solo
   del origen de dibujo y de la geometría, nunca del puntero, pero se reconstruía en cada `pointermove`.
   Ahora vive en un `useMemo`, y `snapPoint` reutiliza los arreglos memoizados sin copiarlos cuando no hay
   nada que fusionar ni excluir.

**Paridad exacta:** el orden de emisión de candidatos y de `sourceIds`, el desempate del snap
(rango → distancia → orden de aparición) y el criterio de duplicados se conservan bit a bit respecto de
los algoritmos anteriores. Está cubierto por una prueba que compara contra una implementación de
referencia exhaustiva sobre un modelo denso de 150 miembros.

### Mediciones (banco determinista, celosía aleatoria densa)

| Escenario | Antes | Después |
|---|---|---|
| Intersecciones, M=150 (2 841 cruces) | 38,0 ms | 19,7 ms |
| Intersecciones, M=500 (29 272 cruces) | 10 298 ms | 393 ms |
| `resolveSnap` sobre 3 141 candidatos | 0,264 ms | 0,024 ms |
| **Coste total por `pointermove`, M=150** | **0,412 ms** | **0,018 ms** |

## Por qué

AG-002 estaba aprobada en `Antigravity-propuestas/aprobadas/` y desbloqueada por AG-001. El diagnóstico
original decía que `buildIntersectionSnapCandidates` corría en cada `pointermove`; al validar contra el
código real resultó que ya estaba memoizada por revisión del modelo y acotada a `≤ 500` segmentos. El
coste por frame real estaba en `resolveSnap` (asignaciones + `sort` sobre todos los candidatos) y en las
perpendiculares, que sí se reconstruían en cada evento del puntero. El trabajo se concentró ahí, y la
cuadrícula espacial se aplicó donde la propuesta la pedía.

## Archivos tocados

- `src/utils/snapping.ts` — cuadrícula espacial de segmentos, índice de puntos para duplicados y barrido
  sin asignaciones en `resolveSnap`. Sin cambios de API.
- `src/features/canvas/StructuralCanvas.tsx` — `drawingOrigin` y `perpendicularSnapCandidates` memoizados;
  `snapPoint` deja de copiar la lista completa de candidatos en cada evento del puntero.
- `src/utils/snapping.test.ts` — pruebas de paridad contra un barrido exhaustivo de referencia (modelo
  denso de 150 miembros y retícula 13×13), casos borde (verticales, miembros coincidentes, longitud cero)
  y presupuesto de `< 2 ms` por resolución de snap.
- `Antigravity-propuestas/implementadas/AG-002-optimizacion-canvas-rendering-y-snapping.md` — movida desde
  `aprobadas/`, estado a **Implementada** y nota de implementación con mediciones.
- `Antigravity-propuestas/backlog.md`, `Antigravity-propuestas/roadmap.md` — AG-002 marcada como
  implementada.

## Cómo verificar

```bash
npm run verify
```

```bash
npm run qa
```

`npm run verify` quedó verde (oxlint, frontera protegida 26/26, 653 pruebas, build, presupuesto de bundle
630 240 B / 169 312 gzip). `npm run qa` quedó verde: ningún check en `false`, `console: []`,
`pageErrors: []`.

Para verlo a mano: abrir un modelo con muchos miembros, activar el snapping de intersecciones y
perpendiculares, y dibujar un miembro — el indicador magnético debe comportarse exactamente igual que
antes, sin retardo del cursor.

## Pendiente / siguiente paso

- **El reporte y los cambios NO están commiteados.** El árbol de trabajo trae además cambios de
  documentación de AG-001 sin commitear de otra sesión (`Antigravity-propuestas/backlog.md` y
  `roadmap.md` fueron reescritos en buena parte fuera de este cambio, más `implementadas/AG-001-*.md`,
  `revisiones/` y `CLAUDE.md` sin seguimiento). Como el commit `77c8931` revirtió justamente la inclusión
  accidental de ese material, se dejó el commit en manos del usuario para no volver a mezclarlo.
- Mejora no aplicada por requerir decisión de arquitectura: acotar las perpendiculares a los miembros
  cercanos al puntero exigiría pasar la posición del puntero (o un radio) a
  `buildPerpendicularSnapCandidates`, cambiando su firma pública y su semántica. Con la memoización el
  coste por frame ya es despreciable, así que no se justifica hoy.
