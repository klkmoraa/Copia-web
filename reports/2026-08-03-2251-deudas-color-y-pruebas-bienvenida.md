# Cerrar las dos deudas de color y cubrir con pruebas la pantalla de inicio

**Fecha:** 2026-08-03 22:51
**Agente:** Claude Code
**Rama:** main

## Qué cambió

### E · Las dos deudas de color que `PALETTE.md` dejaba anotadas

**1. Relleno de nodo desincronizado en Noche.** La migración a la paleta v2
(2026-08-03) bajó `--sc-color-bg-canvas` Noche a `#060b09` pero dejó
`--sc-color-canvas-node-fill` en el valor v1 (`#0c1012`), de modo que el
relleno del nodo quedaba un pelín más claro que el fondo del canvas — algo
que en Día no ocurría (ambos son `#fafcfb`). Se sincronizó a `#060b09`. El
contorno del nodo lo sigue aportando `canvas-member`, así que el nodo se
mantiene visible; solo desaparece la diferencia de tono que no era
intencional.

**2. `--sc-color-state-valid` / `--sc-color-state-invalid`: eran tokens
muertos.** El documento pedía "revisar si deben converger con
`state-success`/`state-error`". Al revisarlo encontré algo distinto de lo que
la pregunta asumía: **ningún archivo del proyecto los consume** (búsqueda
sobre todo `src/**` en `.css`, `.ts` y `.tsx`). Lo que la nota describía como
su uso —"validación de formularios"— en realidad se resuelve con
`--sc-color-state-error-foreground` (`.sc-field__error` /
`.sc-unit-field__error` en `ui.css`).

Por eso no se recalibraron sino que **se eliminaron**: recalibrar dos tokens
que nadie lee solo los deja listos para volver a desincronizarse en la
próxima migración de paleta, que es exactamente cómo llegaron a ser deuda.
La decisión queda documentada en `PALETTE.md` para que el otro agente
(Codex) vea por qué desaparecieron y no los reintroduzca por costumbre.

### F · Pruebas de lo que el rediseño de la pantalla de inicio dejó sin cubrir

El rediseño (commit `31bd254`) agregó filtros de plantillas, tarjetas de
lanzamiento e insignias de categoría sin ninguna prueba propia: la única
prueba que tocaba esa pantalla (`App.test.tsx`) solo comprobaba que el texto
en español no se filtrara al usar inglés, y hubo que adaptarle el selector.

Nuevo `WelcomeScreen.test.tsx` con 6 pruebas:

- Se listan **todos** los ejemplos disponibles, cada uno con insignia de
  categoría (antes del rediseño solo se mostraban 3 de 6, elegidos a mano;
  esta prueba fija que ya no se pierda ninguno).
- El filtro por categoría reduce la lista, muestra solo académicos, luego
  solo modelos, y restaura el total — comprobando además que las insignias
  correspondan al filtro activo.
- El filtro activo se marca con `aria-selected` para tecnología asistiva.
- Al elegir una plantilla se abre el espacio de trabajo.
- La tarjeta "continuar proyecto" informa el tamaño del proyecto actual
  (`0 nudos · 0 barras` en uno en blanco) — cubre la interpolación de esa
  clave nueva, que es la única del rediseño con variables.
- La pantalla se localiza en inglés (filtros y conteo incluidos) sin dejar
  texto en español.

## Archivos tocados

- `src/design-system/tokens.css` — `canvas-node-fill` Noche sincronizado;
  `state-valid`/`state-invalid` eliminados de ambos temas.
- `docs/design-system/PALETTE.md` — ambas deudas cerradas en la tabla y en
  las notas, con la explicación de por qué se eliminaron los dos tokens.
- `src/features/welcome/WelcomeScreen.test.tsx` *(nuevo)* — 6 pruebas.

## Cómo verificar

```bash
npx vitest run src/features/welcome/WelcomeScreen.test.tsx
npx vitest run src/design-system/tokens.test.ts src/utils/svgExport.test.ts
npm run lint && npm run typecheck
npm test        # 89 archivos / 642 pruebas en verde (+6)
```

`tokens.test.ts` (que recalcula contrastes WCAG dinámicamente contra los
tokens reales) sigue en verde tras quitar los dos tokens y mover el relleno
de nodo, confirmando que ninguna pareja medida dependía de ellos.

Verificación visual en navegador todavía pendiente (panel de vista previa
bloqueado toda la sesión). Para esta parte conviene mirar un modelo con
nodos en tema Noche, para confirmar que el nodo sigue leyéndose bien ahora
que su relleno iguala el fondo del canvas.

## Pendiente / siguiente paso

Sin push (instrucción explícita del usuario: trabajo solo local, sin GitHub).
