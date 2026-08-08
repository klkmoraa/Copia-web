# Verificación visual en navegador: regresión de visibilidad encontrada y corregida

**Fecha:** 2026-08-03 23:10
**Agente:** Claude Code
**Rama:** main

## Por qué la verificación visual llevaba toda la sesión bloqueada

El servidor de desarrollo escucha en **5173** (el puerto por defecto de Vite),
pero `.claude/launch.json` declara **3000**. La herramienta de vista previa
intentaba abrir el puerto declarado y la navegación fallaba una y otra vez.
Al leer el log del propio servidor apareció `Local: http://localhost:5173/`,
y navegando ahí cargó a la primera. Los once reportes anteriores de esta
sesión que dicen "pendiente de verificación visual" lo estaban por esto.

## La regresión: la pantalla de inicio estaba invisible

Con el navegador ya funcionando, lo primero que apareció fue que
`.welcome-hero`, `.welcome-showcase` y las seis tarjetas de plantilla estaban
todas en **`opacity: 0`**. La pantalla de inicio completa —título, subtítulo,
vitrina— no se veía. Solo quedaban visibles los elementos sin animación de
montaje.

**La causa fue mi propia optimización de bundle** (commit `5d0c541`). Al
mover las capacidades de `motion` a carga asíncrona, los componentes con
`initial={{ opacity: 0, ... }}` aplican ese estado inicial en el primer
render pero **no animan hacia `animate`**, porque las capacidades que
ejecutan la animación todavía no han llegado. El elemento se queda en su
estado inicial: invisible, de forma permanente.

Es exactamente el tipo de fallo que ninguna de las 642 pruebas podía
detectar: en jsdom no hay motor de animación ni composición, así que los
componentes rinden su DOM y las aserciones sobre texto, roles y clases pasan
igual. Solo un navegador real lo muestra.

## La corrección

Se aplicó la política que este mismo proyecto ya documenta en
`MOTION.md` ("CSS es el predeterminado; la librería se reserva para salidas y
reflow de listas") y que yo no había respetado al portar el rediseño:

1. **Las animaciones de entrada de sección vuelven a CSS.** `.welcome-hero` y
   `.welcome-showcase` dejan de ser `m.section` y recuperan una keyframe
   `sc-fade-up`. Una animación de montaje **debe** funcionar antes de que
   cargue cualquier JavaScript de animación.
2. **`initial={false}` en la vitrina de plantillas.** Las tarjetas aparecen
   ya en su estado final en el primer montaje; los cambios de filtro
   posteriores siguen animando con normalidad, porque para entonces las
   capacidades ya llegaron. Queda comentado en el código el porqué.
3. **Anulación completa bajo `prefers-reduced-motion`.** El token reducido
   deja la duración en `0.001ms` pero **conserva el retardo escalonado**, y
   con `fill: both` eso mantiene la sección en su estado inicial (invisible)
   durante ese retardo. Se anula la animación entera, no solo su duración.

Las animaciones que sí conducen `whileHover` / `whileTap` / `AnimatePresence`
de salida se conservan: todas ocurren tras interacción del usuario, cuando
las capacidades ya están cargadas.

## Lo que sí se verificó en el navegador real

- **Pantalla de inicio**: título, subtítulo, insignia de versión mostrando
  `v0.8.2` desde `APP_VERSION` (no un literal), los tres *highlights*, las
  tres tarjetas de lanzamiento con `0 nudos · 0 barras`, y **las seis
  plantillas** con sus insignias correctas (Académico ×3, Pórticos, Vigas 2D,
  Armaduras). Antes del arreglo el árbol accesible exponía 8 controles; tras
  el arreglo, 14 — las seis tarjetas no estaban llegando.
- **Apoyos tipo CAD**: el símbolo renderiza sus partes nuevas
  (`polygon.support-body-fill`, `line.support-baseplate`, cinco líneas de
  hachurado, `circle.support-pin-dot`).
- **Reacciones persistentes**: tras analizar el pórtico de ejemplo, con la
  pestaña de resultados en **"Momento"**, siguen dibujándose los dos símbolos
  de reacción con sus componentes `rx` y `ry`. Ése es justamente el
  comportamiento que antes dependía de tener abierta la pestaña "Reacciones".
- **Toasts**: se renderiza la tarjeta, con el texto y la descripción
  correctos, `aria-live="polite"`, y `z-index: 1300` — por encima de
  `--sc-z-modal` (1200), confirmando el arreglo de apilamiento.

## Lo que NO se pudo verificar, y por qué

El panel de vista previa **no compone frames** (el propio entorno lo indica
al pedir una captura). Sin composición, `requestAnimationFrame` no avanza:
las líneas de tiempo de animación quedan congeladas en `currentTime: 0`. En
la práctica eso significa que **no se pudo comprobar que las animaciones se
completen** —ni la salida de las tarjetas al filtrar, ni los resortes de
popovers y toasts—. Se verificó su estado inicial, su DOM y su
accesibilidad, no su reproducción.

Además, el panel corre con `prefers-reduced-motion: reduce` activo
(`matchMedia` lo confirma), así que lo observado corresponde a la ruta de
movimiento reducido. **La ruta con movimiento completo sigue sin verificarse
visualmente.**

## Archivos tocados

- `src/features/welcome/WelcomeScreen.tsx` — secciones a `<section>` plano,
  `initial={false}` en la vitrina, helper `fadeInUp` eliminado.
- `src/styles.css` — keyframe `sc-fade-up` restaurada para las dos secciones
  y su anulación bajo movimiento reducido.

## Cómo verificar

```bash
npm run verify   # 642 pruebas, build y presupuesto en verde
npm run dev      # y abrir http://localhost:5173 (NO 3000)
```

En el navegador, con las herramientas de desarrollo:

```js
getComputedStyle(document.querySelector('.welcome-hero')).opacity   // "1"
document.querySelectorAll('.welcome-template-card').length          // 6
```

## Pendiente / siguiente paso

1. **Corregir el puerto en `.claude/launch.json`** (declara 3000, Vite sirve
   5173) para que la vista previa no vuelva a fallar. No se tocó en este
   commit por ser configuración de entorno del usuario.
2. **Verificación visual con movimiento completo**, en un navegador que
   componga: confirmar que los resortes de popovers, toasts y filtrado se
   reproducen y terminan.
3. Sin push (instrucción explícita del usuario: trabajo solo local, sin
   GitHub).
