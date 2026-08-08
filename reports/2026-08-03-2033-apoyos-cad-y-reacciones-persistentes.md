# Iconos de apoyo tipo CAD + reacciones persistentes en el canvas

**Fecha:** 2026-08-03 20:33
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Se portaron (reimplementadas, con una corrección deliberada respecto al
código fuente) las ideas de `001-persistent-reactions` y `008-support-icons`
de `remix-structureco/google-ai-diffs/`, aplicadas juntas porque una toca la
geometría que la otra usa para no solaparse:

1. **Símbolos de apoyo rediseñados** (`renderSupport` en `StructuralCanvas.tsx`):
   cada tipo de apoyo (empotrado, articulación/pin, rodillo, apoyo
   elástico/personalizado) pasa de una geometría genérica compartida a un
   dibujo propio tipo CAD: placa base, hachurado de terreno (líneas
   diagonales bajo la placa), relleno de cuerpo con color de superficie, y
   punto de pivote resaltado. El apoyo `custom`/elástico, que antes se
   dibujaba igual que un pin genérico, ahora tiene su propio símbolo: resorte
   helicoidal (si tiene rigidez traslacional configurada) o placa flotante
   con líneas discontinuas (si no), más un arco punteado si tiene rigidez
   rotacional (`kr`). Se agregó feedback de `:hover` y `.selected` a los
   nuevos elementos (antes solo el marco de selección reaccionaba).
2. **Reacciones persistentes**: las flechas Rx/Ry/Mᵣ y sus etiquetas ya no
   dependen de tener la pestaña "Reacciones" activa — se muestran siempre
   que `layers.results` esté activo y el análisis haya resuelto, igual que
   cualquier otra capa del canvas. La comprobación de pestaña que antes hacía
   `if (resultTab === 'reactions') {...} else if (...)` para las etiquetas
   pasó a ser dos condiciones independientes, para que las etiquetas de
   reacción y las del diagrama activo (axial/cortante/momento) puedan
   coexistir.
3. **Separación (`clearance`) entre flecha de reacción y símbolo de apoyo**:
   se extrajo un único helper puro `reactionClearanceFor(supportType)` (antes
   el cálculo de separación estaba duplicado en `renderReaction` y en el
   bloque de `smartLabelCandidates` del propio diff de Remix — se corrigió
   esa duplicación al portar, tal como había señalado el análisis previo).

## Por qué me aparté del diff original de Remix en un punto

Al revisar `renderReaction` en Remix con cuidado (el usuario pidió
explícitamente que el resultado fuera fiel a Remix pero **sin introducir
errores**), encontré una inconsistencia real: la etiqueta de Rx sí invierte
de lado según el signo de la reacción (`anchor.x - direction * (sideClearance
+ 24)`), pero la flecha de Rx en `renderReaction` **no** — ambas ramas
(`direction > 0` / `direction <= 0`) restan `sideClearance` del mismo lado
(izquierda), solo intercambian cuál extremo lleva la punta de flecha. Eso
deja, para reacciones horizontales negativas, una flecha en el lado
izquierdo con la punta apuntando *lejos* del nodo, mientras su propia
etiqueta aparece en el lado derecho — inconsistente entre sí y distinto del
comportamiento original de Structure (donde el lado siempre se invertía con
el signo y la punta de flecha siempre toca el nodo, igual que el resto de
flechas de carga del archivo).

Contrasté esa inconsistencia con el patrón de `Ry` (que sí mantiene el lado
fijo — siempre "abajo" — tanto en su flecha como en su etiqueta, de forma
coherente entre sí) y confirmé que el problema era específico de la rama
`Rx`. Por eso:

- **Rx**: implementado con una sola expresión con signo (como el código
  original de Structure), sustituyendo el offset fijo de 8px por
  `sideClearance`, para que el lado se invierta con el signo de la reacción
  igual que su etiqueta — corrige la inconsistencia encontrada en el diff de
  Remix.
- **Ry** y **Mᵣ**: portados tal cual de Remix (lado fijo "abajo" para Ry,
  radio de arco proporcional a `bottomClearance` para Mᵣ), porque ahí sí son
  internamente consistentes entre flecha y etiqueta.

No hay ninguna prueba automatizada que hubiera detectado esto (no existe
ninguna que verifique el lado exacto de la flecha según el signo), así que
quedó documentado aquí para que quede trazable.

## Archivos tocados

- `src/features/canvas/StructuralCanvas.tsx` — `renderSupport` (4 símbolos
  rediseñados + import de `SupportType`), `reactionClearanceFor` (nuevo
  helper compartido), `renderReaction` (persistente + clearance + fix de
  Rx), bloque de `smartLabelCandidates` para reacciones (persistente +
  clearance).
- `src/styles.css` — bloque `.support-symbol` ampliado con las nuevas clases
  (`support-body-fill`, `support-pin-dot`, `support-roller-wheel`,
  `support-baseplate`, `support-spring-coil`, `support-spring-arc`) y sus
  estados `:hover`/`.selected`.

## Cómo verificar

```bash
npx vitest run src/App.test.tsx src/features/canvas
npm run typecheck
node scripts/check-protected-baseline.mjs   # frontera del motor intacta: 26 archivos
npm test        # 87 archivos / 631 pruebas en verde
```

El test `draws mixed reactions as separate horizontal Rx and vertical Ry
arrows` (`src/App.test.tsx`) sigue en verde con la geometría nueva
(verifica que Rx es horizontal, Ry es vertical, y los valores numéricos no
cambiaron).

No se pudo completar verificación visual en navegador en esta sesión (el
panel de vista previa no llegó a mostrar la página, mismo problema que en
cambios anteriores de esta sesión). Se recomienda, antes de cerrar
definitivamente este cambio, abrir en `npm run dev` un modelo con apoyos de
los cuatro tipos (incluido uno elástico con rigidez configurada) y reacciones
con signos mixtos, y confirmar visualmente que ninguna flecha de reacción
atraviesa su símbolo de apoyo, en ambos temas.

## Pendiente / siguiente paso

Ninguno funcional. Queda pendiente la verificación visual manual mencionada
arriba. Sin push (instrucción explícita del usuario: trabajo solo local, sin
GitHub).
