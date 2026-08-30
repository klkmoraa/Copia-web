# ACM · cursor compartido, rótulos de carril y barra como toolbar

**Fecha:** 2026-08-26 19:05
**Agente:** Claude Code
**Rama:** claude/canvas-quick-access-buttons-ezo45i

## Qué cambió
Segunda vuelta sobre el acceso rápido y el ACM, con autorización del usuario para
rehacer diseño e implementación.

1. **Cursor compartido entre los tres carriles.** Recorrer el despliegue con el puntero
   lee N, V y M **en la misma sección** —que es exactamente lo que un apilado permite y
   tres diagramas por turnos no— con una línea que cruza los tres carriles y la estación
   rotulada arriba. La lectura se imanta a la estación notable más cercana (extremos,
   bordes de tramo y saltos, tolerancia 1,2 % de la barra, la misma del cursor del panel),
   así que cazar el Mmáx deja de ser puntería. En un salto se informan los dos límites
   laterales en vez de elegir uno en silencio.
2. **No hay un cursor nuevo.** El despliegue publica en el mismo `resultCursor` que ya
   mueve la marca sobre la barra y la lectura del panel de resultados: un solo cursor para
   el modelo, los carriles y el panel. Una lectura fijada a mano desde Resultados no se
   pisa, y plegar el ACM retira la que dejó.
3. **Rótulo del carril fuera del carril.** El símbolo y la unidad pasan a la izquierda,
   como la fila de un small multiple. Dentro se peleaban con el extremo que casi siempre
   cae en el arranque de la barra (el V máx de una viga vive en x = 0).
4. **Los dos extremos rotulados**, con halo `paint-order` en vez de recuadro, y atenuados
   mientras hay lectura activa: el pico sigue viéndose, pero manda el número que el
   usuario está buscando.
5. **La barra es una `toolbar` de verdad:** un solo alto en el tabulador, flechas/Inicio/Fin
   para recorrer los mandos, foco que entra al selector del ACM y vuelve al botón al
   cerrarlo.
6. **ACM se deshabilita mientras no hay análisis**, diciendo por qué, en vez de encenderse
   sobre un lienzo vacío.
7. **Lienzo estrecho:** por debajo de 720 px los nombres se cambian por su símbolo
   (N · V · M · δ · ACM) y el badge de modo se acota para no colarse bajo la barra. El
   nombre accesible no cambia con el ancho.

## Por qué
El usuario pidió mejorar lo añadido, con mano libre. El apilado sin cursor común era
tres gráficas juntas; con él es lo que justifica apilarlas.

## Archivos tocados
- `src/features/canvas/diagramStack.ts` — geometría del cursor (`laneScreenX/Y`,
  `stationFromScreenX`), estaciones notables, imantado y `stationReadings`, que resuelve
  las tres magnitudes de una sección con una evaluación por lado usando el
  `evaluateDiagramAt` del motor.
- `src/features/canvas/CanvasDiagramStack.tsx` — cursor, lecturas, rótulos de fila,
  extremos rotulados y la superficie sensible.
- `src/features/canvas/CanvasEvidenceBar.tsx` — `role="toolbar"`, foco itinerante, foco del
  selector, estado deshabilitado y etiqueta corta/larga.
- `src/features/canvas/StructuralCanvas.tsx` — publica y limpia `resultCursor`, calcula la
  disponibilidad del ACM.
- `src/features/canvas/phase2.css` — cursor, halos, atenuado, foco visible, recorte a 720 px.
- `src/i18n/{es,en}/canvas.ts` — dos claves nuevas (claro de la barra, ACM no disponible).
- Pruebas: `diagramStack.test.ts` (+6), `CanvasDiagramStack.test.tsx` (+3),
  `CanvasEvidenceBar.test.tsx` (+3).

## Cómo verificar
```bash
npm run verify   # 258 archivos de prueba, 2656 pruebas, frontera protegida intacta
```
Comprobado además en Chromium sobre el build, en claro y en oscuro: la lectura de los tres
carriles coincide con la del panel, la marca sobre la barra sigue al cursor, y sobre el
despliegue **siguen funcionando** la caja de selección y el encuadre — la superficie
escucha el movimiento del puntero pero no captura el `pointerdown`.

## Pendiente / siguiente paso
Nada pendiente. Sigue sin persistirse la elección de carriles entre sesiones: hacerlo
tocaría `types.ts`, que es frontera protegida, y necesita autorización explícita.
