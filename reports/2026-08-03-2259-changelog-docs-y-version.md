# CHANGELOG 0.8.2, documentación de motion y rutas obsoletas

**Fecha:** 2026-08-03 22:59
**Agente:** Claude Code
**Rama:** main

## Qué cambió

### Reconciliación de la versión

`package.json` estaba en **0.8.2** desde el commit `703c474`, pero el
CHANGELOG se detenía en 0.8.1: **46 commits** de trabajo real quedaron sin
documentar (motor P-Delta, clasificación de confiabilidad, paleta v2 y todo
el programa visual de esta sesión). Además había una sección huérfana
`## No publicado — 2026-08-02 · Rediseño visual integral` colgando entre
0.8.1 y 0.8.0, sin número de versión asignado.

Se agregó una sección `## 0.8.2 — No publicado` al principio que reúne todo
lo acumulado desde 0.8.1, y la sección huérfana del rediseño se movió dentro
de ella como subsección (`### Rediseño visual integral (2026-08-02)`), que es
donde corresponde: era trabajo sin publicar que pertenece a 0.8.2. No se
inventó ninguna fecha de publicación — la sección deja explícito que sigue
sin usarse GitHub.

La sección cubre: añadido (P-Delta, confiabilidad, toasts, copiar JSON,
filtros de plantillas, gate de rendimiento), cambiado (paleta v2, pantalla de
inicio, apoyos y reacciones, menús y popovers, etiquetas del canvas, carga
diferida de la librería de animación), corregido (defectos del motor P-Delta,
persistencia del modo, layout del acordeón, relleno de nodo), eliminado
(los dos tokens muertos) y preservado (frontera matemática).

### `MOTION.md` estaba desfasado en tres frentes

1. **Rutas inexistentes**: apuntaba a `src/styles/tokens.css` y `src/ui/ui.css`,
   que desaparecieron en la reorganización a `src/design-system/`.
2. **No mencionaba la librería de animación**. Se agregó una sección propia
   que fija la política: CSS es el predeterminado, `motion` se reserva para
   salidas y reflow de listas, se importan **`m.*` y nunca `motion.*`**, el
   bundle de capacidades se carga asíncrono, y `strict` hace que un
   `motion.*` perdido lance error. También por qué el proveedor va en
   `main.tsx` y no en `App.tsx`, y por qué `domMax` y no `domAnimation`.
3. **La tabla de superficies describía animaciones que ya no existen**
   (`sc-pop-in`, `sc-surface-in`, `sc-dialog-in`, `sc-drawer-in`, `sc-fade-up`
   sobre elementos de bienvenida que se eliminaron). Se reescribió con lo que
   realmente anima cada superficie hoy, incluyendo toasts y vitrina de
   plantillas.

**Lo más importante que faltaba**: la sección de `prefers-reduced-motion`
afirmaba que la anulación de tokens en CSS cubría *todo* el sistema —"cubre
también código futuro que use los tokens"—. Eso dejó de ser cierto al entrar
la librería: **sus animaciones las conduce JavaScript, no el motor de CSS**,
así que redefinir las duraciones no las toca. Se añadió una cuarta capa
documentada (`useReducedMotion()` en cada componente que anima) y se marcó
explícitamente como el error fácil de cometer, porque el resto del sistema da
la impresión contraria.

Se añadió además una regla operativa que esta sesión aprendió a golpes: al
migrar una superficie a la librería hay que **retirar su animación CSS**. No
hacerlo dejó dos animaciones corriendo sobre el mismo elemento cuatro veces
durante 0.8.2, y las cuatro hubo que corregirlas después.

### Otras rutas obsoletas

- `SPACING_DENSITY.md` y `TYPOGRAPHY.md` apuntaban a las mismas carpetas
  desaparecidas; `TYPOGRAPHY.md` además a `src/components/inspector/numericFormatting.ts`,
  que hoy vive en `src/features/inspector/`.
- `CONTRIBUTING.md` mandaba reutilizar los tokens de `src/styles/tokens.css`.
  Se corrigió, se añadió el puntero a `MOTION.md` antes de animar, y se
  documentó que `npm run verify` ahora puede fallar por presupuesto de
  rendimiento, con la pista de dónde mirar.

`docs/architecture/FRONTEND.md` también menciona esas carpetas, pero ahí es
correcto: documenta precisamente que desaparecieron.

## Archivos tocados

- `CHANGELOG.md` — sección 0.8.2 nueva; sección huérfana del rediseño movida
  dentro de ella.
- `docs/design-system/MOTION.md` — rutas, sección de librería, tabla de
  superficies, regla de migración, cuarta capa de reduced-motion.
- `docs/design-system/SPACING_DENSITY.md`, `docs/design-system/TYPOGRAPHY.md` — rutas.
- `CONTRIBUTING.md` — rutas, puntero a MOTION.md, nota del gate de rendimiento.

## Cómo verificar

```bash
npm test        # 89 archivos / 642 pruebas en verde
node scripts/check-performance-budget.mjs
node scripts/check-protected-baseline.mjs
grep -rn "src/styles/tokens.css\|src/ui/ui.css" docs/ CONTRIBUTING.md README.md
```

La última búsqueda solo debe devolver `docs/architecture/FRONTEND.md`, donde
la mención es intencional.

## Pendiente / siguiente paso

Queda la verificación visual guiada (punto D del plan), única parte que
requiere el navegador. Sin push (instrucción explícita del usuario: trabajo
solo local, sin GitHub).
