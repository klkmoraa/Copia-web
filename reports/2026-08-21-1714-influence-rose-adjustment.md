# Ajuste del rosa de Influencia — revisión visual de Fase 1

**Fecha:** 2026-08-21 17:14
**Agente:** Codex
**Rama:** `codex/clay-identity-redesign`
**Clasificación:** `AUDIT/TEMPORARY`

## Qué cambió

El usuario aprobó la identidad de la Fase 1 con una corrección: el coral de Momento se conserva en `#ED4B46`, mientras que Influencia sustituye su fucsia intenso por una familia rosa arcilla más sobria.

- Línea de Influencia: `#D85AC9` → `#B96478`.
- Área de Influencia: `#F2C2E6` → `#E7C6D2`.
- El patrón discontinuo de Influencia se conserva como señal no dependiente del color.
- Momento permanece coral y Deformada permanece violeta.

Durante la revisión se detectó una discrepancia independiente: el render aislado de Space 3D todavía respaldaba carga puntual con el coral antiguo cuando no había CSS disponible. Se sincronizó únicamente ese fallback visual con el azul vigente `#3A72E3`; el fallback de Momento permanece coral `#ED4B46`.

## Por qué

El fucsia anterior se percibía chillón frente a la identidad Clay mate de los adjuntos. El nuevo rosa mantiene una identidad clara para Influencia, pero se siente más empolvado, técnico y coherente con el marfil de Día y el grafito de Noche.

## Contraste verificado

| Fondo | Contraste de línea `#B96478` |
|---|---:|
| Día · canvas `#FFFDF9` | 4.01:1 |
| Día · superficie `#FFFCF7` | 3.98:1 |
| Noche · canvas `#0D161B` | 4.49:1 |
| Noche · superficie `#15232B` | 3.95:1 |

El mínimo es 3.95:1, por encima del piso no textual de 3:1 usado por los roles técnicos.

## Archivos tocados

- `src/design-system/tokens.css` — nueva línea y área para Influencia; Momento sin cambios.
- `src/design-system/tokens.test.ts` — contrato de la familia rosa de Influencia idéntica en Día y Noche.
- `src/space3d/view/threeViewport.ts` — sincronización del fallback visual de carga puntual.
- `src/space3d/view/threeViewport.test.ts` — prueba de carga azul y Momento coral cuando CSS no está disponible.
- `reports/evidence/2026-08-21-clay-rose-adjustment/` — script y evidencia Día/Noche.

## Cómo verificar

- `npm.cmd test -- src/design-system/tokens.test.ts src/space3d/view/threeViewport.test.ts`
- `npm.cmd test -- src/design-system`
- `npm.cmd run verify:space3d`
- `npm.cmd run typecheck`
- `npm.cmd run verify:docs`
- `npm.cmd run verify:protected`
- `npm.cmd run build`

## Evidencia visual

- `reports/evidence/2026-08-21-clay-rose-adjustment/influence-rose-light.png`
- `reports/evidence/2026-08-21-clay-rose-adjustment/influence-rose-dark.png`

Las dos capturas son suficientes porque el ajuste cambia únicamente color, no layout ni comportamiento responsive.

## Pendiente / siguiente paso

- Ajuste publicado en el Pull Request `#5` mediante `e091053318c42daec95572fe39d5c0fa70d8170b`.
- Las dos capturas necesarias se enviaron por correo: Influencia rosa y Momento coral en Día/Noche.
- Continuar con la especificación y el plan de la Fase 2: Workspace 2D, Tool Rail, Inspector y jerarquía de cargas superpuestas.
