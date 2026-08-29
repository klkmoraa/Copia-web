# Reporte de entrega: dos popovers de la Cinta se abrían fuera de la pantalla en teléfono

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/visual-bugs-sfzhdn`
**Commits:** `cefdfe9`, `2d9925b`, y el que acompaña este reporte

---

## 1. Qué se pidió

Una captura de un teléfono en `klkmoraa.github.io` (iPhone, retrato, ~390 px CSS): a la
izquierda de la pantalla se veía una columna vertical de cajas blancas cortadas por el borde
—chevrones de `<select>`, un fragmento «...cer», otro «...idez»— superpuesta al lienzo de una
viga simplemente apoyada. El pedido: «hay unos bugs visuales... corrígelos todos porfavor»,
sin poder describir más porque el resto de la interfaz no dejaba hacer scroll para verlos.

## 2. Dos bugs, no uno

Reproducido con Playwright headless (`chromium`, 390×844, `deviceScaleFactor:2`) contra el
`dist/` construido en local, primero sin tocar nada:

### 2.1 · «Más acciones» (el botón `•••`) — el de la captura

`.mobile-actions-menu` (`src/styles/10-shell.css`) se anclaba con `right:0` a su disparador.
En el layout compacto (`.mobile-actions-wrap`, único grupo que sobrevive bajo 700 px — D-14 ·
CRI-95) ese disparador vive pegado al borde IZQUIERDO de la Cinta, a ~18 px. Con 320 px de
ancho de menú, el panel se abría de `x=-258` a `x=62`: 258 px fuera de pantalla, sólo la
astilla derecha visible — exactamente los chevrones y el «...cer» (cola de Deshacer/Rehacer) de
la captura. `.project-menu`, el mismo patrón con el mismo disparador pegado al borde, ya lo
resolvía con `left:0`; se aplicó el mismo anclaje aquí.

### 2.2 · Selector de norma y causa de fiabilidad — encontrado al verificar, no en la captura

Al reproducir el primero se encontró un segundo bug, distinto, en los popovers que usan el
`Popover` genérico del sistema dentro de la Cinta (`AISC 360-16 (LRFD)`, la causa gobernante de
fiabilidad). Bajo 700 px `.sc-popover__surface` pasa a `position:fixed` para actuar como
bandeja de fondo — pero `.topbar` lleva `backdrop-filter` (su cristal), y eso la convierte en
el bloque de contención de cualquier descendiente `fixed`, igual que un `transform`. `bottom`
medía entonces contra el borde inferior de la Cinta (~50 px de alto), no contra la pantalla:
con 300+ px de contenido el panel se abría hacia arriba y salía casi entero por encima del
viewport (medido: `top:-330px`). El eje horizontal no tenía el problema — la Cinta ocupa el
ancho completo del viewport, así que ahí `left`/`right` ya coincidían con la pantalla real.

## 3. Cómo se corrigió cada uno

- **2.1** — `right:0` → `left:0` en `.mobile-actions-menu`. Medido en 320–1023 px de ancho:
  el menú cabe siempre dentro del viewport.
- **2.2** — se reescribió sólo `bottom`, contra `100dvh` (una unidad, no una coordenada de la
  caja secuestrada), en vez de renunciar a `position:fixed` o a la anchura ya resuelta.

## 4. Lo que Codex encontró en revisión, y que esta rama no había cubierto

El PR #1 recibió dos comentarios `P1` de `chatgpt-codex-connector`, después de que este agente
ya diera el trabajo por terminado:

1. **Faltaba este reporte.** AGENTS.md §Flujo de trabajo lo exige tras un cambio relevante;
   se generó aquí.
2. **La compensación de §2.2 no estaba condicionada al soporte de `backdrop-filter`.**
   `material.css` (líneas 312-340) ya tiene un `@supports not (...)` que deja la Cinta sin
   `backdrop-filter` — y por tanto sin secuestrar el bloque de contención — cuando el navegador
   no lo soporta. En esa rama `bottom` ya medía bien contra la pantalla real por sí solo; restarle
   además la compensación de `100dvh` lo habría mandado casi una pantalla entera por DEBAJO del
   viewport. Se corrigió envolviendo la compensación en el `@supports` inverso exacto, así que
   las dos ramas nunca compensan la misma coordenada dos veces.

## 5. Verificación

```
npm run build                                          OK
npx vitest run src/features/topbar src/design-system    132 pruebas, verde
```

Geometría medida con Playwright (`position:fixed`/`getBoundingClientRect`), antes y después,
en 320/360/390/460/500/600/700/1023 px de ancho: los dos paneles quedan dentro del viewport en
todo el rango. No se pudo reproducir en un navegador SIN soporte de `backdrop-filter` desde
aquí (Chromium headless lo soporta siempre); la corrección de §4.2 se verificó leyendo el
`@supports` existente en `material.css` y comprobando que el `@media`/`@supports` nuevo es su
inverso exacto, no ejecutando el caso real.

## 6. Lo que este cambio no hace

- No toca `.canvas-layer-popover` (el popover de capas del lienzo): vive fuera de `.topbar`,
  no hereda ninguno de los dos bugs, y no se le tocó una sola regla.
- No introduce un portal ni cambia el componente `Popover` (`overlays.tsx`): el arreglo es
  sólo CSS, acotado a los consumidores que viven dentro de la Cinta.
- No fusiona en `main`: el intento de `git push` directo a `main` fue bloqueado por el sandbox
  de esta sesión: la vía usada es un Pull Request (`#1`), pendiente del gate en verde.
