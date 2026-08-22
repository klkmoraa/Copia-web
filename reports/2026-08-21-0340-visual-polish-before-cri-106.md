# CRI-112 · Remate visual final previo a CRI-106 — composición, jerarquía y polish cross-device

**Fecha:** 2026-08-21 03:40
**Agente:** Claude Code
**Rama:** `claude/structureco-visual-polish-xj6tw8`
**Issue:** [CRI-112](https://linear.app/klkmoraa/issue/CRI-112/remate-visual-final-previo-a-cri-106-composicion-jerarquia-y-polish)
**SHA baseline:** `origin/main` = `9b60556efde2d8bc435657819fecb9aec03de60f` ("CRI-109 · Welcome: el índice del paso activo usa el relleno, no el trazo")

## Qué cambió

Recomposición de Welcome (piloto de CRI-112, Dirección A — "carril y bandas"): desaparece el marco RAISED único que tapaba el 92 % del suelo de papel; las cinco puertas de entrada (lienzo, ejercicio, importar, DXF, Space 3D) suben a un carril lateral visible sólo en el paso 1; el carril de pasos pasa a progress rail de una fila garantizada en K0; el pórtico se redibuja a otra proporción y escala (~460 px en X2, esquina superior derecha, dos filas de alto); Continuar gana materia propia y una placa adaptativa (datos reales si hay modelo, invitación si está vacío); la biblioteca se convierte en tabla técnica con encabezados y casi desaparece cuando está vacía; el ciclo de trabajo del paso 2 se ilustra con tres glifos SVG planos nuevos.

Después del checkpoint visual con el propietario, cuatro ajustes finales: menos aire en X2 con pocos proyectos, pórtico más bajo en K0 retrato, menos masa lima en el pórtico (geometría, no color) y paso 2 algo más compacto.

## Por qué

Entrevista pregunta-a-pregunta con el propietario (24 preguntas) antes de tocar código, registrada íntegra en la descripción de CRI-112. Diagnóstico medido sobre `main` (no de memoria): 457 px + 766 px de vacío en X2, portal al 1,7 % del viewport, `.welcome-resume-card` computando el mismo fondo y la misma sombra que su contenedor, stepper partido en 3 filas en K0, gutters del 21 % del ancho en K0.

## Decisiones de la entrevista (resumen — íntegras en CRI-112)

Alcance: toda StructureCo, piloto en Welcome primero. Sensación: premium + mesa técnica cálida + vivo y táctil. Densidad distinta por dispositivo. Continuar domina con placa adaptativa. Nuevo proyecto secundario táctil. Recientes como tabla técnica. Vacío casi desaparece. Portal fuerte, acotado a una esquina, a dos filas. Progress rail con el nodo 4 marcado como salida. Marca ligada al portal. Clay táctil por composición, sin tocar tokens. Color vivo en iconos/acciones, color de dominio sólo si el dominio es distinto. Noche profunda pero cálida. Móvil de máxima claridad, decoración moderada. Animación expresiva en todo el producto, dentro de los tokens existentes. Grupos compactos sobre el suelo. Las cinco puertas suben al paso 1 sin retirarse del paso 3.

## Referencias — qué se tomó y qué se rechazó

**Imagen 1 (sidebar):** tomada la forma completa, rellenada sólo con capacidades reales (carril con Inicio/importar/DXF/Aula/Space 3D). Rechazado: cuenta de usuario, plan Pro, miniaturas, carril de cursos, secciones inexistentes, titular a dos líneas, stepper de 3.
**Imagen 2 (móvil):** tomadas las cuatro — pasos en una fila, rejilla de 4 iconos, Continuar/Nuevo apiladas, portal en banda propia. Rechazado: campana, avatar, saludo personal, alto de cabecera.
**Imagen 3 (móvil variante):** tomadas las tarjetas ilustradas, aplicadas al ciclo del paso 2 (no al stepper, que ya era rail). Rechazado: barra de progreso 65 %, chips de estado de análisis (copy prohibido), miniaturas, tab bar inferior, escudo de verificación.
**Imagen 4:** descartada por el propietario.
**Imagen 5 (denso):** tomada la placa de datos de Continuar, la densidad general, recientes como tabla con encabezados. Rechazado: secciones inexistentes, cuenta/plan, columnas Tipo/Estado.

## Archivos tocados

- `src/graphics/isometricPortal.ts` — proporciones del pórtico redibujadas (`DEFAULT_PORTAL`); ajuste final: `beamHeight` 21→15 (menos masa lima, geometría no color).
- `src/features/welcome/StructuralPortalHero.tsx` — encuadre del `viewBox` derivado del bounding box real en vez de constante fija.
- `src/features/welcome/WorkCycleGlyph.tsx` — nuevo. Tres glifos SVG planos (modelar/cargar/analizar), sin filtro ni clay: representan la ingeniería, que sigue plana por contrato.
- `src/features/welcome/WelcomeScreen.tsx` — carril de puertas (paso 1 sólo), rail de progreso, nodo 4 marcado como salida, placa adaptativa de Continuar, hub como banda propia de la mesa.
- `src/features/welcome/WelcomeScreen.test.tsx` — dos pruebas actualizadas para cubrir las dos ramas de la placa adaptativa (antes sólo fijaban "0 nudos · 0 barras").
- `src/features/project-hub/ProjectHub.tsx` — tabla con columnas (`updatedAt` real vía `Intl.DateTimeFormat`), colapso a una línea cuando no hay proyectos ni recuperaciones.
- `src/features/project-hub/projectHub.css` — materia de tabla técnica; ajuste final: padding y margen de encabezado reducidos.
- `src/styles.css` — reemplazo íntegro del bloque de composición de Welcome (marco único → carril + bandas sobre el suelo); ajustes finales de `row-gap` en `.welcome-stage` y `.welcome-work` (no-welcome), `.welcome-panel` y altura del portal en K0 retrato.
- `src/i18n/catalogs.ts`, `src/i18n/phase2Catalogs.ts` — claves nuevas ES/EN (`welcome.gateRailNav`, `welcome.resumeEmpty`, `welcome.gateDxf`, `hub.columnProject/Updated/Revision`).

## Contratos preservados

- **CRI-104** — no reabierto: 4 pasos y su orden, autoskip, `ProjectHub`/IndexedDB reales sin tocar persistencia, todas las puertas alcanzables (verificadas una a una: lienzo, ejercicio, importar, DXF, Aula, Space3D marcado experimental), recuperación garantizada por construcción (su presencia fuerza el despliegue del hub).
- **CRI-105** — no reabierto: cero HEX nuevos, cero tokens de radio/sombra nuevos (`tokens.test.ts` en verde); intensidad clay conseguida por composición.
- **Contrato de contenido (CRI-88 #1)** — ningún chip ni copy de estado de análisis; ningún dato inventado (miniaturas, tipos, porcentajes).
- **`verify:protected`** — 38 archivos verificados, frontera intacta: solver/model/schema sin tocar.
- **Marca** — geometría fija, sin recolorear ni animar.

## Responsive verificado

X2 (1440×900) Día/Noche pasos 1·2·3 · M1 (1100×820) · K0 retrato (390×844) Día/Noche · K0 apaisado (844×390) — sin overflow horizontal en ninguno (verificado por `scrollWidth`). Stepper en una sola fila en K0 en los dos casos.

## Gates

| Gate | Resultado |
|---|---|
| `npm run lint` | verde (4 warnings pre-existentes, ninguno en archivos tocados) |
| `npx vitest run src/features/welcome src/features/project-hub` | 6 archivos, 44 pruebas — verde |
| `npx vitest run src/design-system` | 13 archivos, 104 pruebas — verde |
| `npm run typecheck` | verde |
| `npm run verify:protected` | verde — 38 archivos, frontera intacta |
| `npm run verify:perf` | verde — registrado, sin techo bloqueante configurado |
| `npm run build` | verde |
| `npm test` | **224 archivos, 2245 pasadas, 8 saltadas** — verde |

## Bundle de entrada

`WelcomeScreen` no es lazy y vive en el chunk de entrada. Antes: 543.62 kB / gzip 166.01 kB. Después: 547.93 kB / gzip 166.92 kB — **+0,8 % raw, +0,5 % gzip**. No crece de forma significativa.

## Evidencia

Capturas before/after en `reports/evidence/2026-08-21-0340-cri-112-visual-polish/{before,after}/`: X2 Día/Noche paso 1, K0 retrato Día/Noche paso 1, K0 apaisado Día paso 1, X2 paso 2, X2 paso 3.

## Limitaciones

- Con un solo proyecto guardado sigue quedando aire bajo la tabla de recientes en X2 (se llena solo con 3-4 proyectos; no se rellenó con contenido inventado, por instrucción expresa del propietario).
- El pórtico en K0 retrato sigue siendo la pieza que más alto consume antes de Continuar, aunque se acortó.
- El paso 2 conserva algo de aire inferior en X2: se ajustó el `gap` interno, no la estructura de columnas (fuera de alcance del ajuste final pedido).

## Pendiente / siguiente paso

- Propagación de la Dirección A a las demás familias de superficies (cascarón global, Mesa + ToolRail, Inspector + Results, Datasheet + Model Doctor), con checkpoint por familia — es alcance D de CRI-112, no incluido en este piloto.
- **CRI-106 no se ejecuta** en este slice.
- **CRI-93 sigue BLOCKED** por dispositivo físico.
