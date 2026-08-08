# Tipografía — Sistema de diseño structureCo

> Fuente de verdad: `src/design-system/tokens.css` (sección 5, "Instrumento de Precisión"), `src/design-system/components/ui.css`, `src/features/inspector/numericFormatting.ts`.
> Decisión heredada **D-010** (`docs/ux-redesign/DECISIONS.md`): pila local/sistema existente, **sin descarga remota ni archivos de fuente nuevos**.

## Pilas de fuente

| Token | Valor | Uso |
| --- | --- | --- |
| `--sc-font-display` | `"Segoe UI Variable Display", "SF Pro Display", Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | Titulares y superficies editoriales: bienvenida, encabezados de sección grandes, marca |
| `--sc-font-ui` | `"Segoe UI Variable Text", "SF Pro Text", Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | Toda la interfaz: controles, párrafos, etiquetas |
| `--sc-font-heading` | alias de `--sc-font-display` | Títulos |
| `--sc-font-mono` | `ui-monospace, "Cascadia Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace` | Mono técnica: valores numéricos de resultados (`.sc-result-metric > strong`, `.sc-numeric-value`) |

Notas:

- **Tamaños ópticos reales, sin descargar nada** (AG-015). `Segoe UI Variable Display`/`Text` (Windows 11) y `SF Pro Display`/`Text` (Apple) son la misma familia cortada para dos tamaños: la de display afina el interletrado y adelgaza los remates a 64px; la de texto los engorda y abre el espaciado a 12px. Es la mejora tipográfica más grande disponible bajo la decisión D-010, que prohíbe descargar fuentes.
- Inter se usa **si está instalada localmente**; no hay `@font-face` ni CDN (D-010). La cascada cae a `Segoe UI` estático o a San Francisco vía `-apple-system` donde las variables no existan.
- La mono prioriza la mono del sistema (`ui-monospace`) y cae a Cascadia/SF Mono/Consolas/Menlo según plataforma. Nunca se descarga.
- La familia display **no se aplica a la interfaz de trabajo**. El espacio de trabajo es denso y su tipografía no crece con la ventana; mezclar ahí una fuente de titulares sólo añade ruido.

## Pesos

| Token | Valor | Uso típico |
| --- | --- | --- |
| `--sc-font-weight-regular` | `400` | Cuerpo, hints, sufijos (`small` de labels) |
| `--sc-font-weight-medium` | `550` | Énfasis medio |
| `--sc-font-weight-semibold` | `650` | Botones, labels de campo, tabs, tool buttons (`ui.css` usa semibold como peso de control estándar) |
| `--sc-font-weight-bold` | `750` | Badges, encabezados de grupo de herramientas |
| `--sc-font-weight-display` | `720` | Titulares de display: por debajo de `heavy`, porque a 68px el 800 se empasta |
| `--sc-font-weight-heavy` | `800` | Máximo énfasis puntual |

Los valores intermedios (550/650/750) están calibrados para fuentes variables (Inter variable, Segoe UI Variable, SF). En una fuente estática el navegador redondea al peso disponible más cercano; la jerarquía se mantiene pero con saltos menos finos. No introducir pesos fuera de esta escala.

## Escala de tamaños

| Token | Valor | Uso previsto (observado en `ui.css` / `styles.css`) |
| --- | --- | --- |
| `--sc-font-size-caption` | `10px` | Metadatos mínimos: hints de campo, tooltips, `kbd` de atajos, badges, detalles de métricas, subtítulos de tool buttons |
| `--sc-font-size-technical` | `12px` | Texto técnico (etiquetas de magnitudes, anotaciones) |
| `--sc-font-size-label` | `12px` | Labels de formularios, tabs, segmented, descripciones de banners, filas de propiedades |
| `--sc-font-size-body` | `14px` | Cuerpo de párrafos (paneles de acordeón, contenidos) |
| `--sc-font-size-control` | `14px` | Texto dentro de controles: botones, inputs, acordeones |
| `--sc-font-size-subtitle` | `15px` | Subtítulos |
| `--sc-font-size-panel` | `17px` | Títulos de panel/modal (`.sc-panel-header h2`, `.sc-modal-surface__header h2`), valores destacados de métricas |
| `--sc-font-size-screen` | `26px` | Títulos de pantalla heredados |

### Escala de display (nueva en AG-015)

Fluida, y **sólo para superficies editoriales**. Antes el hero de bienvenida se escribía con tamaños sueltos en `styles.css`; ahora la escala vive en el sistema y se puede reutilizar sin re-inventarla.

| Token | Valor | Uso previsto | Uso prohibido |
| --- | --- | --- | --- |
| `--sc-font-size-display-xl` | `clamp(2.625rem, 1.55rem + 4.3vw, 4.25rem)` | Titular de la pantalla de bienvenida | Espacio de trabajo |
| `--sc-font-size-display-md` | `1.3125rem` (21px) | Encabezados de sección editorial (`.welcome-showcase-header h2`) | Títulos de panel (usar `panel`) |
| `--sc-font-size-lead` | `clamp(1rem, 0.93rem + 0.32vw, 1.1875rem)` | Párrafo de entrada bajo un titular | Cuerpo general (usar `body`) |

## Interlineado y tracking

| Token | Valor | Uso |
| --- | --- | --- |
| `--sc-line-height-display` | `1.015` | Titulares de display; a 68px el interlineado de cuerpo abre demasiado |
| `--sc-line-height-tight` | `1.2` | Títulos de panel y modal |
| `--sc-line-height-control` | `1.25` | Texto de controles |
| `--sc-line-height-compact` | `1.35` | Descripciones densas, hints, subtítulos |
| `--sc-line-height-body` | `1.5` | Párrafos |
| `--sc-tracking-tight` | `-0.025em` | Títulos (`letter-spacing` de headers de panel/modal) |
| `--sc-tracking-control` | `-0.008em` | Botones y controles |
| `--sc-tracking-display` | `-0.038em` | Titulares de display: a 68px el tracking normal se lee suelto |
| `--sc-tracking-technical` | `+0.01em` | Texto técnico pequeño (abre el tracking para legibilidad) |
| `--sc-tracking-eyebrow` | `+0.16em` | Micro-etiquetas en mayúsculas (`CONTINUAR PROYECTO`) |

Excepción de estilo: los encabezados de grupo del rail (`.sc-tool-group > h3`) usan mayúsculas con `letter-spacing: 0.06em` y caption bold — es el único caso de tracking abierto amplio.

## Números técnicos (tnum / lnum)

| Token | Valor |
| --- | --- |
| `--sc-numeric-variant` | `tabular-nums lining-nums` |
| `--sc-numeric-features` | `"tnum" 1, "lnum" 1, "cv02" 1, "cv03" 1, "cv04" 1, "cv11" 1` |

- **Tabulares (`tnum`)**: todas las cifras ocupan el mismo ancho → columnas de tablas de resultados y campos numéricos alinean dígito a dígito y no "bailan" al actualizar valores.
- **Lining (`lnum`)**: cifras de altura uniforme (sin old-style) para lectura técnica.
- Los `cv02/cv03/cv04/cv11` son alternativas estilísticas de Inter (formas desambiguadas de `a`, `g`, `6/9`, `l` recto); son inertes cuando resuelve la fuente del sistema.
- Aplicación real: `font-variant-numeric: var(--sc-numeric-variant)` en inputs de campos (`.sc-field__control input`, `.sc-unit-field__control input`), métricas (`.sc-result-metric > strong`) y `.sc-numeric-value`.

## Alineación de decimales

Reglas vigentes:

1. **Entrada numérica alineada a la derecha**: `.sc-unit-field__control input { text-align: right; }` — el dígito de las unidades queda pegado al separador de unidad física, que vive en un sufijo fijo (`> span`, min-width 48px, borde izquierdo).
2. **Cifras tabulares en todo valor numérico** (ver sección anterior): con `tnum`, la alineación derecha equivale a alinear la coma decimal cuando la precisión mostrada es constante por columna.
3. **Formato presentacional controlado** (`formatInspectorNumber`, `src/components/inspector/numericFormatting.ts`):
   - 6 dígitos significativos por defecto (configurable 1–21), `maximumFractionDigits` opcional.
   - Notación científica automática fuera del rango `[1e-4, 1e7)` con mantisa sin ceros residuales (`1.5e+8`).
   - `-0` y `0` se normalizan a `"0"`; valores no finitos se muestran como `"—"`.
   - **Nunca** retroalimenta el valor redondeado al estado del proyecto: el modelo conserva precisión completa.
4. La validación de entrada (`DECIMAL_NUMBER_PATTERN`) acepta signo, decimales con **punto** y exponente (`[+-]?d+(.d*)? | .d+ [eE][+-]?d+`).

## ES / EN

- La interfaz es bilingüe (catálogos completos ES/EN en `src/i18n/catalogs.ts`; ver `docs/ux-redesign/I18N_PARITY.md`). La escala tipográfica es común a ambos idiomas: los componentes truncan con elipsis (`text-overflow: ellipsis` en tool buttons, status strips) en lugar de reducir tamaño por idioma.
- El separador decimal de **entrada** es el punto (`.`) en ambos idiomas (patrón único en `numericFormatting.ts`); no hay localización de coma decimal en los campos numéricos actuales.
- Las unidades se muestran en sufijos tipográficamente diferenciados: `--sc-color-text-unit` + caption + fuente UI (no mono), mientras el valor usa mono + color de la magnitud (`.sc-result-metric`, `.sc-numeric-value small`).

## Jerarquía aplicada (resumen)

| Superficie | Composición |
| --- | --- |
| Título de panel/modal | panel 17px · tight 1.2 · tracking -0.025em |
| Subtítulo de panel | label 12px · compact · text-secondary |
| Botón / control | control 14px · semibold 650 · lh 1.25 · tracking -0.008em |
| Label de campo | label 12px · semibold; sufijo `small` en regular + muted |
| Hint / error de campo | caption 10px · compact; error usa `state-error-foreground` |
| Valor de resultado | mono · panel 17px · tabular · color de la magnitud; unidad en `small` UI caption |
| Metadato / atajo | caption 10px · muted |
