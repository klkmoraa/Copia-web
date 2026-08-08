# S02 + S03 — Auditoría de dirección visual y consolidación de tokens

- **Agente:** Claude Code (agente principal)
- **Modelo:** Opus 5 (`claude-opus-5`)
- **Fecha:** 2 de agosto de 2026
- **Estado de GitHub:** NO UTILIZADO

## Objetivo

Comprobar la implementación contra las referencias visuales oficiales y cerrar los huecos
donde el CSS se saltaba el sistema de diseño.

## Hallazgo principal: la dirección ya estaba implementada

Se abrieron las referencias reales (`05-mesa-modular-desktop.png` y compañía) y se comparó
elemento a elemento con la aplicación en ejecución. **Coinciden**: los grupos del rail
(NAVEGAR / CREAR / CARGAS / ANOTAR / EDITAR), la TopBar, el dock «CENTRO ANALÍTICO» con
Compacto / Expandido / Enfocar, los grupos de pestañas (ESTADO, ESFUERZOS, FORMA, AVANZADO,
COMPRENDER, AVISOS), la ficha de elemento con M máx / V máx / M mín y la guía numerada del
diagrama están todos implementados con los mismos rótulos.

**S02 no requería rediseño.** Habría sido un error reconstruir lo que ya existe. El trabajo
real estaba en la coherencia de la implementación.

## Hallazgo crítico: cinco de seis parejas sólidas incumplían WCAG AA

`src/styles.css` codificaba `#fff` a mano en 11 sitios, siempre como texto sobre un relleno
semántico. Un literal no puede seguir al tema, así que en Noche el contraste se desplomaba.

Contraste medido antes de corregir:

| Pareja | Blanco codificado | AA |
|---|---:|---:|
| Acción primaria, Noche `#2fbe8e` | **2,37** | 4,5 |
| Éxito, Noche `#45c98a` | **2,11** | 4,5 |
| Error, Noche `#f26b6b` | **2,96** | 4,5 |
| Éxito, Día `#1c9560` | **3,81** | 4,5 |
| Error, Día `#d44848` | **4,36** | 4,5 |
| Acción primaria, Día `#0a7e5e` | 5,05 | 4,5 |

Lo llamativo: **los tokens ya eran correctos**. `--sc-color-action-foreground` sobre
`--sc-color-action-primary` da 7,96 en Noche, y la prueba de tokens ya lo comprobaba. El CSS
simplemente no los usaba. La prueba vigilaba la definición, no el consumo.

## Segundo hallazgo: 26 sombras que no seguían al tema

`tokens.css` redefine `--sc-shadow-*` en el bloque Noche con alfa mucho mayor, pero
`styles.css` tenía 26 `box-shadow` con `rgba()` fijo. Todas eran demasiado débiles de noche.

Además el sistema tenía cuatro niveles y la práctica usaba al menos seis. Faltaban dos
elevaciones que el producto sí necesita: el **contacto** de un control activo dentro de su
carril, y la **hoja inferior**, cuya sombra sube porque la luz cae desde arriba.

## Decisiones

- Nuevos tokens de pareja sólida: `--sc-color-success-solid` / `-on-solid` y
  `--sc-color-error-solid` / `-on-solid`. Los valores se **calcularon** para cumplir AA
  (`#187f52` da 5,00 con blanco; `#b43d3d` da 5,71), no se eligieron a ojo.
- `--sc-color-state-*` **no se tocó**: sigue reservado para bordes, iconos y texto sobre
  superficie, donde el requisito es 3:1 y no 4,5:1. Cambiar el matiz semántico habría
  afectado usos que ya eran correctos.
- Tres tokens de elevación nuevos: `--sc-shadow-contact`, `--sc-shadow-sheet` y
  `--sc-shadow-drop` (esta última porque `drop-shadow()` sólo admite una capa).
- Las 26 sombras se mapearon a su nivel de elevación real, no se borraron.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/design-system/tokens.css` | 4 tokens de pareja sólida + 3 de elevación, en ambos temas |
| `src/styles.css` | 11 literales `#fff` → tokens; 26 sombras → tokens; 1 velo → token |
| `src/design-system/tokens.test.ts` | +2 parejas de contraste, +2 pruebas de guardia |
| `docs/releases/0.8.1/DESIGN_AUDIT.md` | **nuevo**: auditoría completa contra la referencia |

## Archivos protegidos comprobados

`node scripts/check-protected-baseline.mjs` → «Frontera protegida intacta: 22 archivos verificados.»

## Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npx oxlint` | limpio |
| `npm run typecheck` | limpio |
| `npx vitest run` | **76 archivos, 515 pruebas, todas en verde** (48,1 s) |
| `npm run build` | correcto |

Delta: 513 → 515 pruebas (**+2**).

## Evidencia medida en la aplicación real

Build de producción servido en `http://localhost:4173`, midiendo el estilo computado tras
alternar `data-theme`:

| Pareja | Día | Noche |
|---|---:|---:|
| Acción primaria | 5,05 | 7,96 |
| Éxito sólido | 5,00 | 8,95 |
| Error sólido | 5,71 | 6,37 |

Las seis parejas cumplen AA. `--sc-shadow-sheet` y `--sc-shadow-contact` resuelven con
valores distintos por tema (`#0818102e` en Día, `#00000085` en Noche). Consola sin errores.

| Métrica | Antes | Después |
|---|---:|---:|
| Literales de color opacos en `styles.css` | 11 | **0** |
| Sombras `rgba()` fijas | 26 | **0** |
| Total de literales de color | 38 | **0** |
| Parejas sólidas que incumplen AA | 5 de 6 | **0 de 6** |
| Niveles de elevación tokenizados | 4 | 7 |

### Una equivocación que la medición corrigió

La primera medición en el navegador dio 1,27 para éxito y error en ambos temas, valores
imposibles. La causa era que el servidor de vista previa servía un build anterior a los
tokens nuevos. Tras reconstruir, los valores fueron los correctos. **Queda anotado porque es
justo la clase de resultado que se habría reportado como bueno sin comprobarlo.**

## Riesgos

- Las 26 sombras cambian de valor. Son ajustes de elevación dentro del mismo lenguaje, pero
  no se han comparado visualmente lado a lado; queda para S17.

## Limitaciones

- **Sin capturas antes/después.** El panel del navegador no se muestra en esta sesión, así
  que la verificación fue numérica sobre el estilo computado, no visual.
- La auditoría comparó la referencia con el árbol de accesibilidad y el texto de la
  aplicación, no con una captura pixel a pixel.

## Pendientes

- Las referencias visuales oficiales siguen fuera de git, dentro de respaldos ignorados.
  Versionarlas es decisión del usuario.
- `src/styles.css` sigue en 181 kB.

## Siguiente paso

S04 — Navegación y shell.

## Commit local

`refactor(design): consolidate semantic tokens`
