# S05–S08 — Auditoría de canvas, inspector, resultados y Aula

- **Agente:** Claude Code (agente principal)
- **Modelo:** empezó con Opus 5, continuado con Sonnet 5 tras cambio de modelo del usuario
- **Fecha:** 2 de agosto de 2026
- **Estado de GitHub:** NO UTILIZADO

## Objetivo

Auditar canvas (S05), inspector (S06), resultados (S07) y Aula (S08) contra la especificación,
y corregir defectos reales. A diferencia de los slices anteriores, **esta auditoría no
encontró defectos que justificaran un cambio de código** más allá de lo ya corregido en S04
(bus de comandos tipado, que es precisamente la columna vertebral que conecta estas cuatro
superficies).

## Método

Verificación funcional en la aplicación real (`http://localhost:5173`), invocando los
manejadores de React directamente cuando el evento nativo del navegador resultó no fiable
(ver limitación metodológica abajo), más lectura del código fuente de los módulos centrales:
`labelLayout.ts`, `InspectorNumericField.tsx`, `modalFocus.ts`, `ClassroomGuide.tsx`,
`ResultsPanel.tsx`.

## Limitación metodológica descubierta y su diagnóstico

Al probar el campo numérico del Inspector con un valor vacío, la primera medición pareció
mostrar un defecto grave: el campo quedaba vacío tras perder el foco, sin mensaje de error ni
`aria-invalid`, violando directamente §13 y §15. Antes de reportarlo, seguí investigando:

1. Confirmé que `blur()` programático sí cambiaba `document.activeElement` (el foco se movía).
2. Añadí listeners directos de `blur`/`focusout`/`focus` sobre el input: **ninguno se disparó**,
   pese a que `input` sí lo hacía.
3. Comprobé `document.hasFocus()` y `document.visibilityState`: `false` y `"hidden"`.

**Causa real: la pestaña del navegador está en segundo plano en esta sesión.** Los navegadores
suprimen los eventos nativos `focus`/`blur` cuando el documento no tiene foco del sistema
operativo, aunque `document.activeElement` se siga actualizando. No es un defecto del producto,
es un artefacto del entorno de automatización.

Para confirmarlo con certeza, invoqué el manejador `onBlur` de React directamente
(`input[reactPropsKey].onBlur(...)`), evitando por completo la dependencia del evento nativo:

```
campo vacío + onBlur real  → aria-invalid="true", "Este campo no puede quedar vacío."
```

**El componente funciona correctamente.** Quedó documentado el método porque cualquier prueba
futura en este entorno debe invocar los manejadores de React directamente para las
aserciones que dependen de foco/blur, no `.focus()`/`.blur()` nativos.

## Hallazgos por superficie

### S05 — Canvas

- `labelLayout.ts` ya implementa colocación determinista con evasión de colisión, hasta 8
  radios de búsqueda y una regla explícita de qué prioridad puede omitirse. Coincide con lo
  que pide §12.
- Verificado en la aplicación real: el estado «Modelo incompleto» con cero nodos muestra tres
  avisos priorizados (nodos, miembros, cargas), cada uno con título, explicación, corrección
  sugerida y un botón «Corregir en el modelo». **El botón funciona**: cambia la herramienta
  activa a Nodo, comprobado leyendo `aria-pressed` antes y después.
- 13 botones de solo-icono visibles en el flujo probado; **0 sin nombre accesible**.
- SVG/PNG (S12/S13) y política numérica (S11) ya resueltos en slices anteriores.

### S06 — Inspector

- `InspectorNumericField.tsx` ya separa las cinco capas que exige §13: cadena de edición
  (`text`), valor parseado (`parseInspectorNumber`), valor válido (`validate`), valor
  almacenado (`onCommit`) y valor mostrado (`formatInspectorNumber`).
- Verificado mediante el manejador de React real:
  - campo vacío → error «Este campo no puede quedar vacío.», `aria-invalid=true`;
  - texto inválido (`abc`) → error «Ingresa un número válido.»;
  - `Escape` → restaura el valor original y limpia el error;
  - notación científica (`2e5`) → se acepta y se formatea.
- El campo `A` de un miembro no lleva `validate` en `InspectorProperties.tsx`; acepta un valor
  negativo sin error inline. **No es un defecto**: el `hint` del propio campo dice
  explícitamente «El dominio valida A > 0 al analizar», es decir, la validación se difiere a
  tiempo de análisis por diseño, no por omisión.

### S07 — Resultados

- El estado de avisos ya prioriza correctamente: bloqueante primero, con corrección accionable.
- `downloadResultsCsv` está enlazado desde `ResultSummary.tsx`; usa el formateador de S11.
- El bus de comandos tipado de S04 es lo que conecta «Corregir en el modelo» (resultados →
  canvas) y «Enfocar»/exportar (TopBar → canvas), y ya quedó verificado en S04.

### S08 — Aula

- El recorrido de Aula muestra las seis etapas que pide §16: Construye, Define, Predice,
  Analiza, Compara, Concluye, con progreso «0 de 6» y estado por etapa (actual/pendiente).
- `ClassroomGuide.tsx` usa el mismo bus tipado (`emitWorkspaceCommand('expand-mobile-results')`)
  migrado en S04.

## Decisión

**No se realizó ningún cambio de código en este slice.** La auditoría es la entrega: confirma
que S05–S08 ya cumplen la especificación, con evidencia funcional real, y documenta un método
de prueba que evita un falso positivo en cualquier verificación futura de foco/blur en este
entorno.

## Archivos tocados

Ninguno. Árbol de trabajo limpio salvo los archivos sin trackear preexistentes documentados
en `STATUS.md`.

## Pruebas ejecutadas

No aplica ejecución de suite (sin cambios de código). El estado de la suite es el mismo que al
cierre del commit anterior: 78 archivos, 528 pruebas en verde.

## Riesgos

- La limitación de foco/blur en pestaña de fondo también afectará cualquier prueba futura de
  Playwright que dependa de eventos nativos si se ejecuta sin la pestaña al frente. Documentado
  para S17.

## Limitaciones

- Sin capturas de pantalla: el panel del navegador no compone frames en esta sesión.
- No se probó el flujo completo de Aula (predicción → revelar → comparar) de extremo a
  extremo; se verificó la estructura de etapas, no cada interacción.

## Siguiente paso

S10 — Experiencia de importación.

## Commit local

Ninguno (sin cambios de código que commitear).
