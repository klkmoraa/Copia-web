# Reporte: Mejoras de Interfaz (UI/UX) — Inspector, Lienzo y Verificación de Equilibrio en Resultados

**Fecha:** 2026-08-27 03:45 UTC  
**Clasificación:** `AUDIT/TEMPORARY`  
**Rama:** `feature/ui-ux-enhancements` / actual  

---

## 1. Resumen Ejecutivo

A petición del usuario para proponer e implementar mejoras directas de interfaz (UI/UX), se implementaron 3 optimizaciones clave sin alterar la frontera matemática protegida ni comprometer los contratos del sistema de diseño:

1. **Verificación de Equilibrio Global en Tabla de Reacciones (`ReactionsView.tsx`):**
   - Agregada fila resumen `<tfoot>` con el cálculo de sumatoria global de reacciones ($\sum R_x, \sum R_y, \sum M_z$) formateadas en el sistema de unidades activo.
   - Diseñado con fondo `--sc-color-fill-quaternary`, borde de separación y alineación exacta con las columnas numéricas.

2. **Acciones Rápidas y Selector Táctil de Apoyos en el Inspector (`InspectorProperties.tsx`):**
   - **Barra de Acciones Rápidas para Miembros:** Botones de un clic para *Subdividir a la mitad* (split al 50%), *Invertir sentido* (intercambio orden $i \leftrightarrow j$) y *Articular extremos* (liberación de momentos $iMoment, jMoment$). Todo mediado por comandos nativos del proyecto (`member.split`, `member.update`) garantizando undo/redo y preservación de topología.
   - **Control Segmentado para Apoyos en Nodos:** Selector interactivo directo (`SegmentedControl`) para alternar entre *Libre*, *Articulado*, *Rodillo*, *Empotrado* y *Personalizado*, manteniendo sincronización con el selector accesible.

3. **Controles Rápidos del Diagrama en el HUD del Lienzo (`StructuralCanvas.tsx` & `25-canvas.css`):**
   - Incorporación de botones de acción rápida dentro de la leyenda de resultados (`canvas-result-legend`) para conmutar el lado del trazado ($+y \leftrightarrow -y$) y la escala del diagrama ($1:1$ individual $\leftrightarrow \sum$ común).
   - Estilizado de botones con estados `:hover` y `:active` (`--sc-press-transform`), contraste y respeto a reglas de elevación.

---

## 2. Archivos Modificados

| Archivo | Naturaleza del Cambio |
|---|---|
| `src/features/results/ReactionsView.tsx` | Cálculo de totales de reacción y renderizado de `<tfoot>` con clase `.results-table-total`. |
| `src/styles/07-results.css` | Reglas de estilo para el pie de tabla de reacciones (`tfoot th`, `tfoot td`). |
| `src/design-system/material.css` | Exención de radio y sombras para celdas `tfoot` en `[data-level='raised']`. |
| `src/features/inspector/InspectorProperties.tsx` | Botones de acciones rápidas de miembro, control segmentado de apoyos de nodo y sus respectivos manejadores de comando. |
| `src/styles/23-inspector.css` | Estilos de chips de acción rápida (`.inspector-quick-actions`, `.inspector-action-chip`) y espaciado de apoyos. |
| `src/features/canvas/StructuralCanvas.tsx` | Acciones interactivas para escala y convención de lado en `.canvas-result-legend`. |
| `src/styles/25-canvas.css` | Estilos para `.canvas-result-legend-actions` y `.canvas-legend-btn`. |
| `src/i18n/es/inspector.ts` y `src/i18n/en/inspector.ts` | Claves de traducción simétricas para las acciones rápidas del inspector. |

---

## 3. Verificación y Gates Ejecutados

1. **Frontera Protegida:**
   - Comando: `npm run verify:protected`
   - Resultado: **49 archivos verificados, 0 diferencias byte a byte con la línea base.**
2. **Sistema Documental:**
   - Comando: `npm run verify:docs`
   - Resultado: **31 documentos clasificados y sin enlaces rotos.**
3. **Pruebas de Diseño y Geometría de Superficies:**
   - `surfaceGeometry.test.ts`: **17/17 PASSED** (sin transform de elevación ilegal en hover, radios acordes a tokens).
   - `material.test.ts`: **9/9 PASSED** (niveles de materia y soporte opaco verificados).
   - `tokens.test.ts`: **19/19 PASSED** (contrastes de color aprobados).
4. **Pruebas de Catálogo i18n:**
   - `catalogs.test.ts`: **9/9 PASSED** (paridad idéntica entre español e inglés).
5. **Pruebas de Funcionalidad e Inspector:**
   - `Inspector.test.tsx`: **39/39 PASSED**.
   - `App.test.tsx`: Leyenda de resultados y localización probados con éxito.
6. **Compilación y Empaquetado:**
   - `npm run build`: **Exitoso (código 0, sin errores TypeScript ni de Vite).**
