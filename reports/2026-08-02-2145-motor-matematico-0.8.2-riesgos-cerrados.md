# Motor matemático 0.8.2 — riesgos #2, #5, #6 cerrados y ampliación autorizada a UI (#3, #4)

**Fecha:** 2026-08-02 21:45
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Continuación de la fase de confiabilidad del motor (ver
`reports/2026-08-02-2110-motor-matematico-0.8.2.md` para el trabajo original de
esa misma sesión). Se cerraron tres de los siete riesgos pendientes que quedaron
documentados en `docs/motor-matematico/CONTEXTO-MEJORA-MOTOR-0.8.2.md`:

- **Riesgo #5** (`ReactionEnvelope.complete` solo cubría escenarios, no nodos):
  corregido en el motor con prueba TDD.
- **Riesgo #6** (fusión de acciones concentradas casi coincidentes): confirmado
  con una prueba dedicada que el límite es intencional, no accidental.
- **Riesgo #2** (umbrales de confiabilidad sin evidencia empírica): resuelto con
  una batería de 10 modelos de referencia legítimos que confirma que todos
  clasifican `reliable` con margen ≥1000× respecto al umbral `limited`.

Los riesgos #3 y #4 (mostrar el nivel de confiabilidad y ambos lados de la
envolvente en la interfaz) requerían tocar UI, lo cual las instrucciones
originales de esta fase excluían explícitamente. **El usuario autorizó
expresamente ampliar el alcance a UI** para esta sesión (sin exportaciones ni
PDF), y se implementaron y verificaron en el navegador.

## Por qué

El usuario pidió continuar cerrando los riesgos pendientes del documento de
contexto tras la fase inicial del motor. Para #3 y #4 se preguntó explícitamente
antes de proceder por el conflicto con la restricción original "no modifiques...
estilos ni diseño"; el usuario eligió ampliar el alcance.

## Archivos tocados

Motor:
- `src/engine/resultSummary.ts` — `NodeReactionEnvelope.complete` por nodo;
  `ReactionEnvelope.complete` exige ahora cobertura completa nodo por nodo, no
  solo que no falte ningún escenario.
- `src/engine/resultSummary.test.ts` — prueba TDD del caso anterior (falló
  primero, luego pasó tras la corrección).
- `src/engine/discontinuity.test.ts` — prueba dedicada del límite de fusión de
  acciones concentradas casi coincidentes (`coordinateTolerance(L)`).
- `src/engine/reliabilityCalibration.test.ts` *(nuevo)* — 16 pruebas: 10 modelos
  de referencia (viga simple, pórtico, armadura, voladizo con peso propio,
  conexión semirrígida, Timoshenko, apoyo elástico inclinado, 4 marcos de
  Hibbeler) clasifican `reliable`, más una prueba de margen numérico.

Interfaz (alcance ampliado, autorizado explícitamente):
- `src/features/results/ResultsPanel.tsx` — el indicador de estado de la barra
  de comandos distingue `reliable`/`limited`/`unreliable` vía
  `resolveReliability()`, reutilizando la clase `is-warning` existente (sin CSS
  nuevo). El cursor de la envolvente evalúa ahora ambos lados
  (`evaluateEnvelopeAt(..., 'left'/'right')`) y muestra los dos límites cuando
  difieren, reutilizando la clase `at-jump` existente.
- `src/i18n/catalogs.ts` — 3 claves nuevas en español e inglés
  (`results.stateResolvedLimited`, `results.stateResolvedUnreliable`,
  `results.envelopeDiscontinuityReading`), verificadas por `catalogs.test.ts`.

Configuración de desarrollo:
- `.claude/launch.json` — configuración `structureco-dev-verify` con puerto
  automático, para poder levantar un servidor propio sin chocar con el de otra
  sesión activa en el puerto 5173. No afecta la aplicación.

Documentación:
- `docs/motor-matematico/CONTEXTO-MEJORA-MOTOR-0.8.2.md` — riesgos #2, #5 y #6
  marcados como resueltos con su evidencia; riesgos #3 y #4 marcados como
  resueltos con el detalle de la ampliación de alcance y la verificación en
  navegador; nota de alcance actualizada en la cabecera.

## Cómo verificar

```bash
npm run typecheck && npm run lint && npm run verify:protected && npm test && npm run build
```

Resultado obtenido: todo en verde, **83 archivos / 573 pruebas** (línea base de
esta fase: 78/530; tras el primer reporte: 82/557).

Verificación en navegador (dev server propio en puerto libre vía
`structureco-dev-verify`):
- Ejemplo "Viga simplemente apoyada" → estado "Resultados resueltos" /
  `is-resolved` / sin `title` — sin regresión frente a un modelo sano.
- Con "Env." activo (4 escenarios) en el diagrama de cortante, cursor en
  `x=4.000 m`: `Mín.: izq. 0.000 → der. -30.000 kN`,
  `Máx.: izq. 30.000 → der. 0.000 kN` — el salto real por la carga puntual se ve
  en ambos lados.
- El mismo punto en el diagrama de momento (continuo ahí) no muestra ninguna
  línea de discontinuidad — cero falsos positivos.

## Pendiente / siguiente paso

Quedan 2 de los 7 riesgos originales, ninguno accionable dentro del alcance
actual sin nueva decisión del usuario:

- **Riesgo #1** (`AnalysisResult.reliability` opcional): verificado que ningún
  consumidor lee el campo directamente hoy (`envelope.ts` e `influence.ts` ya
  usan `resolveReliability`); el riesgo queda documentado para código futuro, no
  requiere cambio.
- **Riesgo #7** (sin prueba positiva de subdivisión de influencia con un modelo
  físico real): no construible con la biblioteca de elementos actual, ya que su
  reconstrucción es exacta; documentado como limitación conocida.

**No se hizo push.** Todos los cambios de esta sesión (11 commits en total desde
`cdc0238`) están commiteados localmente en `main`, pendientes de confirmación
explícita del usuario para subir a GitHub.
