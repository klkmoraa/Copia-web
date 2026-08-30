# El ACM recuerda sus carriles · y por qué no lleva lectura táctil

**Fecha:** 2026-08-26 21:25
**Agente:** Claude Code
**Rama:** claude/canvas-quick-access-buttons-ezo45i

## Qué cambió
El ACM recuerda entre sesiones qué carriles elegiste. La preferencia vive donde ya viven
las capas del editor —`localStorage`, clave versionada `structureco:diagram-stack:v1`, con
una lectura que tolera basura—, no en `project.settings`.

## Corrección de lo que dije antes
En las dos entregas anteriores dejé esto como «decisión del usuario porque tocaría
`types.ts`, frontera protegida». **Era falso**, y por no mirar: sólo habría tocado la
frontera si la preferencia se guardara en el proyecto. `editorLayers.ts` ya guarda
exactamente este tipo de preferencia en `localStorage` desde antes, con el mismo patrón
—clave versionada, parseo tolerante, `try/catch` porque en modo privado escribir lanza—.
Lo que hice fue seguir ese patrón, no inventar uno.

Además la preferencia **no pertenece** al proyecto: un modelo compartido no debería llegarle
al otro diciéndole qué mirar.

## Lo que no se guarda, a propósito
Si el despliegue está abierto o plegado no se persiste. Eso no es una preferencia, es el
estado de lo que estás haciendo ahora; restaurarlo dejaría el botón encendido sobre un
proyecto todavía sin analizar, que no dibuja nada.

## Decisión: el ACM no lleva lectura táctil
La descarto, y no por coste. Para leer con el dedo, la banda del despliegue tendría que
quedarse el `pointerdown`, que es justo por donde empiezan el arrastre para encuadrar y el
pellizco para acercar: cambiaría dos gestos de base por uno nuevo, en la única zona donde
además compiten. Y la lectura táctil ya existe en el producto: la herramienta **Corte**
da N, V y M en la sección que toques, con el equilibrio detrás. Con los extremos rotulados
en cada carril, el táctil no se queda sin los números que gobiernan.

## Archivos tocados
- `src/features/canvas/diagramStack.ts` — clave, `parseStackQuantities`,
  `readStoredStackQuantities`, `persistStackQuantities`.
- `src/features/canvas/StructuralCanvas.tsx` — arranque desde lo guardado y escritura al
  elegir.
- `src/features/canvas/diagramStack.test.ts` — tres pruebas: ida y vuelta, tolerancia a
  basura (nulo, vacío, no-JSON, objeto, valor desconocido) y orden canónico.

## Cómo verificar
```bash
npm run verify   # 258 archivos de prueba, 2661 pruebas, frontera protegida intacta
```
Comprobado en Chromium sobre el build, recargando la aplicación entre pasos:
por defecto entran los tres carriles; apagar el axial guarda `["shear","moment"]`; tras
recargar vuelve esa elección; con basura guardada (`["torsion"]`) vuelven los tres en vez
de ninguno; y con un solo carril guardado, ese carril queda bloqueado para que el ACM no
pueda quedarse vacío.

## Pendiente / siguiente paso
Nada pendiente. Las dos decisiones que quedaban abiertas están tomadas.
