# S02 — Auditoría de dirección visual «Mesa Modular de Precisión»

Fecha: 2 de agosto de 2026. Auditoría contra las referencias reales, no contra el recuerdo
del código.

## 1. Estado de las referencias

Las cinco direcciones visuales existen como PDF y como conceptos renderizados, pero **sólo
dentro de carpetas de respaldo ignoradas por git**:

```
structureCo-backup-redesign-20260802-002717/output/
  design-exploration/structureco-directions-2026-08-01/
    concepts/   15 conceptos (5 direcciones x desktop/mobile/system)
    boards/     6 láminas comparativas
    captures/   33 capturas reales de la aplicación
  pdf/structureco-directions-2026-08-01/
    01-instrumento-precision-structureco.pdf … 05-mesa-modular-structureco.pdf
```

**No encontrado:** `structureCo_mockups_canva_10_paginas.pdf`.

**Riesgo:** las referencias oficiales no están versionadas. Un `git clean` las borraría.

## 2. La dirección ya está implementada

`REPORT.md` de la exploración recomendó **Mesa Modular como arquitectura, con préstamos de
Instrumento de Precisión (rigor cromático y numérico) y Plano Editorial (jerarquía y
respiración)**. La cabecera de `src/design-system/tokens.css` declara exactamente esa
combinación, y la implementación la sigue.

Comparación del concepto `05-mesa-modular-desktop.png` con la aplicación en ejecución:

| Elemento de la referencia | Estado en el producto |
|---|---|
| Rail lateral por grupos: NAVEGAR / CREAR / CARGAS / ANOTAR E INSPECCIONAR / EDITAR | **implementado**, con los mismos grupos y atajos (V, H, N, M, S, P, D, O, C, X, B) |
| TopBar: selector de proyecto, estado local, casos activos, combinación, unidades, deshacer/rehacer, Analizar | **implementado** |
| Canvas dominante con SNAP / GRID / Capas y controles de zoom | **implementado** |
| Inspector a la derecha con pestañas Inspector / Cargas / Vista | **implementado** |
| Ficha de elemento con métricas M máx / V máx / M mín | **implementado** |
| Propiedades frecuentes, valores derivados y avanzadas separadas | **implementado** |
| Dock inferior «CENTRO ANALÍTICO» con Compacto / Expandido / Enfocar | **implementado** |
| Pestañas agrupadas: ESTADO, ESFUERZOS, FORMA, AVANZADO, COMPRENDER, AVISOS | **implementado**, con los mismos rótulos |
| Guía numerada del diagrama (1 explicación, 2 valores principales, 3 comprobación) | **implementado** |
| Tema Noche como variante nativa, no invertida | **implementado**, bloque `[data-theme='dark']` explícito |

**Conclusión: S02 no requiere rediseño.** La arquitectura visual coincide con la referencia
elegida. El trabajo real está en la coherencia de la implementación, que es lo que audita el
resto de este documento.

## 3. Lo que sí divergía

### 3.1 Primeros planos codificados a mano (defecto de accesibilidad)

`src/styles.css` contenía **11 apariciones de `#fff`**, todas como texto sobre un relleno
semántico (`var(--accent)`, `var(--success)`, `var(--error)`). Un literal no puede seguir al
tema, así que en Noche el contraste se desplomaba.

Contraste medido antes de corregir:

| Pareja | Blanco codificado | Requisito AA |
|---|---:|---:|
| Acción primaria, tema Noche `#2fbe8e` | **2,37** | 4,5 |
| Éxito, tema Noche `#45c98a` | **2,11** | 4,5 |
| Error, tema Noche `#f26b6b` | **2,96** | 4,5 |
| Éxito, tema Día `#1c9560` | **3,81** | 4,5 |
| Error, tema Día `#d44848` | **4,36** | 4,5 |
| Acción primaria, tema Día `#0a7e5e` | 5,05 | 4,5 |

Cinco de seis parejas incumplían AA. Los tokens ya eran correctos —
`--sc-color-action-foreground` da 7,96 en Noche—; el CSS simplemente no los usaba.

### 3.2 Sombras que no seguían al tema

**26 sombras `rgba()` fijas** en `styles.css`, mientras `tokens.css` redefine
`--sc-shadow-*` en el bloque Noche con alfa mucho mayor. Todas esas sombras eran demasiado
débiles de noche. Además había cuatro niveles de elevación en los tokens y al menos seis
tratamientos distintos en la práctica.

### 3.3 Huecos reales en el sistema de sombras

Los cuatro tokens existentes (`raised`, `floating`, `modal`, `popover`) no cubrían dos
elevaciones que el producto sí usa:

- **contacto**: un control activo dentro de su carril, que no debe parecer que flota;
- **hoja inferior**: sombra hacia arriba, porque la luz cae desde arriba.

## 4. Lo que se conserva sin tocar

- Los colores técnicos de diagramas (`--sc-color-technical-*`), verificados en 0.8.0.
- `--sc-color-state-*`, reservados para bordes, iconos y texto sobre superficie, donde el
  requisito de contraste es 3:1 y no 4,5:1.
- La escala tipográfica, el espaciado, los radios y la iconografía, que ya son coherentes.
- La arquitectura de la interfaz, que coincide con la referencia.

## 5. Estado tras S03

| Métrica | Antes | Después |
|---|---:|---:|
| Literales de color opacos en `styles.css` | 11 | **0** |
| Sombras `rgba()` fijas | 26 | **0** |
| Total de literales de color en `styles.css` | 38 | **0** |
| Parejas sólidas que incumplen AA | 5 de 6 | **0 de 6** |
| Niveles de elevación tokenizados | 4 | 7 |

Contraste medido en la aplicación en ejecución, sobre el build de producción:

| Pareja | Día | Noche |
|---|---:|---:|
| Acción primaria | 5,05 | 7,96 |
| Éxito sólido | 5,00 | 8,95 |
| Error sólido | 5,71 | 6,37 |

## 6. Puertas que impiden la regresión

`src/design-system/tokens.test.ts`:

- ningún literal de color opaco puede aparecer en `styles.css`;
- `rgba()` sólo se admite dentro de `box-shadow`, `drop-shadow`, `filter` o un velo de fondo;
- toda pareja sólida declarada debe medir ≥ 4,5:1 en ambos temas;
- Noche sigue siendo un tema explícito, sin `invert()` ni `filter`.

## 7. Pendiente

- Las referencias visuales oficiales siguen fuera de git. Versionarlas o archivarlas
  formalmente es una decisión del usuario, no del agente.
- `src/styles.css` sigue teniendo 181 kB. Depurarlo por superficie es un trabajo aparte,
  registrado en `PERFORMANCE.md`.
