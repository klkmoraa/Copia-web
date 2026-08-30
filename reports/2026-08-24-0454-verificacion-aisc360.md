# Primera verificación por norma real: AISC 360 LRFD (CRI-45)

**Fecha:** 2026-08-24 04:54
**Agente:** Claude Code
**Rama:** claude/propuestas-mejora-ubyt3j

## Qué cambió

`docs/architecture/structureco-elastic-index.md` decía, en su propio «Qué
falta», que StructureCo no hace ninguna verificación normativa real: η es una
estimación elástica orientativa, sin φ, sin pandeo, sin interacción P-M de
código, y llamaba a esa pieza ausente CRI-45. Ahora existe una primera fase de
esa pieza: `src/features/results/aisc360Design.ts` verifica axil (compresión
E3 en las dos direcciones, tracción D2-a sólo fluencia), flexión mayor
compacta (F2, meseta plástica), cortante de alma compacta (G2.1) e
interacción P-M (H1), sobre perfiles I doblemente simétricos de catálogo.

Un dato ausente —sección no soportada, material sin catálogo, sección no
compacta, `Lb > Lp` sin poder verificar pandeo lateral-torsional, alma
esbelta— produce un `gap` con su causa exacta, nunca un ratio fabricado: la
misma regla dura que ya gobierna η, aplicada a un módulo nuevo y separado que
no la reemplaza.

El Inspector muestra una tarjeta nueva (`Aisc360DesignCard`) junto a la del
índice elástico, y cuatro campos editables por barra —K mayor, K menor,
longitud no arriostrada fuera de plano, Lb— que **sólo lee este módulo**: el
Analysis Engine no los toca y ningún resultado existente cambia con o sin
ellos declarados.

## Por qué

El usuario pidió pensar en grande y con permiso total para mover lo que hiciera
falta. Explorar el repo mostró que el propio proyecto ya se había señalado a sí
mismo el hueco más grande y mejor documentado: una herramienta de análisis
estructural sin ninguna verificación de diseño real es, para un ingeniero,
media herramienta. La base ya estaba (catálogo de perfiles con módulo
plástico, radio de giro y geometría de ala/alma; catálogo de materiales con Fy
y E), así que era la mejora de mayor apalancamiento disponible sin tocar el
solver.

## Archivos tocados

Frontera protegida (autorización explícita del usuario, línea base
refrescada): 2 archivos.
- `src/types.ts` — 4 campos opcionales en `MemberModel`
  (`designEffectiveLengthFactorMajor/Minor`,
  `designUnbracedLengthMinor/LateralTorsional`); no los lee el solver.
- `src/data/migrate.ts` — parseo y validación (positivos) de esos 4 campos.

Fuera de la frontera:
- `src/features/results/aisc360Design.ts` *(nuevo)* — el motor: E3, D2-a, F2,
  G2.1, H1, con gaps declarados y las vistas de barra y de estructura.
- `src/features/results/aisc360Design.test.ts` *(nuevo)* — 21 pruebas: cada
  fórmula contra un cálculo de mano independiente (columna W12x26/A992,
  L=3m), cada gap, la puerta de confiabilidad compartida con η, y la vista de
  estructura.
- `src/features/inspector/Aisc360DesignCard.tsx` *(nuevo)* — la tarjeta.
- `src/features/inspector/InspectorProperties.tsx` — la tarjeta cableada tras
  `InspectorNarrativeCard`; grupo nuevo «Longitudes de pandeo (AISC 360)» con
  los 4 campos editables; validador `positive`.
- `src/i18n/es/results.ts`, `src/i18n/en/results.ts` — 27 claves `aisc.*`.
- `src/i18n/es/inspector.ts`, `src/i18n/en/inspector.ts` — 6 claves de
  etiquetas de campo + `inspector.positiveValidation`.
- `docs/architecture/structureco-aisc360-design-check.md` *(nuevo,
  CANONICAL)* — contrato completo: alcance, gaps, qué falta.
- `docs/architecture/structureco-elastic-index.md` — el «Qué falta» ahora
  enlaza a la fase implementada.
- `docs/README.md`, `docs/architecture/README.md` — índice y mapa
  actualizados.
- `README.md` — fila nueva en la tabla de capacidades.
- `scripts/protected-baseline.sha256` — refrescado (`--update`), 49 archivos.

## Cómo verificar

```bash
npm run verify        # exit=0 — 255 archivos / 2647 pruebas, 8 omitidas
npm run verify:space3d
node scripts/validate-ci.mjs
PLAYWRIGHT_CHANNEL=chromium PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run qa
```

Leído de esta ejecución: `npm run verify` en verde (lint, docs —32
documentos—, frontera protegida intacta con los 2 cambios autorizados,
**2647 pruebas (21 nuevas)** frente a las 2626 con las que empezó el bloque,
build, presupuesto de rendimiento sin techo bloqueante, chunk de entrada
limpio). `npm run qa` — **191 checks, ninguno en
false, cero consola y cero errores de página** — mismos números que la tanda
anterior, porque este cambio no toca ningún flujo que el recorrido general
ejercite; no hay todavía un `qa-aisc360.mjs` dedicado (ver pendientes).

## Pendiente / siguiente paso

Documentado explícitamente en `structureco-aisc360-design-check.md`, para que
nadie lo confunda con «terminado»:

1. **Envolvente sobre todas las combinaciones LRFD**, no sólo el análisis
   activo — mismo límite que tiene η hoy.
2. **Perfiles no compactos y el tramo `Lb > Lp` de F2** exigen la constante
   torsional J y `rts`/`Cw`, que el catálogo de secciones no tabula.
3. **Rotura en sección neta a tracción (D2-b)** exige Fu y área neta.
4. **Un `qa-aisc360.mjs`** con navegador real que ejercite la tarjeta y los
   campos nuevos del Inspector — hoy la cobertura es de pruebas unitarias.
5. **Columnas del datasheet** para los 4 campos nuevos: hoy sólo se editan
   desde el Inspector.

Siguen abiertos de antes, sin relación con este cambio: guardar en disco y
compartir (`saveBytes`/`buildShareLink`), el diálogo de confirmación de una
propuesta de IA, la partición de `StructuralCanvas.tsx`, y el reparto de la
fila del hub con el nombre truncado.
