# Recuperar la carga inicial (LazyMotion) y blindar el presupuesto de rendimiento

**Fecha:** 2026-08-03 22:45
**Agente:** Claude Code
**Rama:** main

## Qué cambió

### El problema, medido

Al medir el estado real del proyecto tras los 11 commits de esta sesión, la
carga inicial (lo que el navegador descarga antes del primer pintado) había
crecido así:

| | 0.8.1 documentado | Tras los cambios de hoy | Δ |
|---|---:|---:|---:|
| Bytes | 556 000 | 710 838 | **+28 %** |
| gzip | 148 531 | 195 360 | **+31 %** |

Causa: `motion` entró al chunk de entrada porque `WelcomeScreen` lo importa
directamente, y la pantalla de bienvenida es lo primero que se pinta.

**Lo más grave no fue la regresión, sino que nada la detectó.** Existían
`scripts/measure-performance.mjs` y `docs/releases/0.8.1/PERFORMANCE.md` con
presupuestos escritos, pero el script solo *imprime* números — nunca falla.
El paso de CI llamado "Presupuestos de rendimiento" ejecutaba justamente ese
script que no puede fallar, así que el gate era decorativo. Los números se
midieron una vez en agosto, se escribieron al documento, y quedaron a la
deriva.

### A · Sacar el bundle de animación del chunk de entrada

Se migró de los componentes `motion.*` (que arrastran todas las capacidades
de la librería al chunk que los importe) a los componentes ligeros `m.*` con
`LazyMotion`, y el conjunto de capacidades se aisló en
`src/design-system/motionFeatures.ts` para que el empaquetador lo separe y lo
cargue **después** del primer pintado.

Resultado medido:

| | Antes | Después | Δ |
|---|---:|---:|---:|
| Bytes | 710 838 | 629 337 | **−81 501** |
| gzip | 195 360 | 169 132 | **−26 228 (−13 %)** |

El bundle de animación (84 387 bytes / 27 367 gzip) pasó a ser un chunk
diferido (`motionFeatures-*.js`).

Detalles:
- Se usa `domMax`, no `domAnimation`, porque la pila de toasts y la grilla de
  plantillas de bienvenida animan su `layout`, y las animaciones de layout
  solo están en `domMax`.
- El proveedor `LazyMotion` se montó en `main.tsx` y no en `App.tsx` porque
  `ComponentLab` (la vitrina interna de `/__components`) se renderiza **en
  lugar de** `App`, y también usa componentes animados — desde `App` habría
  quedado fuera de cobertura.
- Se activó `strict`, que hace que un `motion.*` perdido lance un error en
  vez de volver a arrastrar el bundle completo al chunk de entrada en
  silencio. Es la garantía de que esta corrección no se deshaga sola.

Sin cambios de comportamiento visible: mismas animaciones, mismos tiempos,
mismo manejo de `prefers-reduced-motion`.

### B · Que el presupuesto se cumpla solo

Nuevo `scripts/check-performance-budget.mjs`: reutiliza el script de medición
como única fuente de verdad (lo invoca con `--json`, en vez de reimplementar
el recorrido de `dist/`) y **falla con exit 1** si la carga inicial supera su
techo, indicando en cuánto se pasó y dónde mirar.

- Enganchado a `npm run verify` (nuevo script `verify:perf`), que es el gate
  mínimo que `CONTRIBUTING.md` exige para cualquier cambio.
- El paso de CI "Presupuestos de rendimiento" (`.github/workflows/ci.yml`)
  pasó de ejecutar el script que solo imprime al que sí falla.
- Se verificó que el gate **realmente falla**, no solo que pasa: se bajó el
  techo a la mitad, se confirmó exit 1 con el mensaje correcto, y se
  restauró.

Techo declarado: 648 000 bytes / 174 000 gzip — el valor medido más un 3 % de
holgura deliberada, para que una edición de contenido normal (unas claves de
traducción, una regla CSS) no rompa el gate, pero una librería nueva o un
import ansioso sí.

## Deuda conocida, documentada en el propio script

El techo sigue **por encima** de la línea base de 0.8.1 (556 000 / 148 531).
La diferencia restante (~20 600 gzip) es el núcleo de animación (`m` +
`AnimatePresence` + `LazyMotion`) que la pantalla de bienvenida arrastra al
chunk de entrada, más ~1 300 gzip de CSS nuevo legítimo. Cerrar esa brecha
requiere devolver las animaciones de la pantalla de inicio a CSS, que es una
decisión de diseño, no una optimización mecánica — está anotada en el
comentario de `BUDGET` para quien la retome. Mientras tanto el techo sostiene
la línea donde está en vez de dejarla seguir a la deriva.

## Archivos tocados

- `src/design-system/motionFeatures.ts` *(nuevo)* — bundle de capacidades aislado.
- `src/main.tsx` — proveedor `LazyMotion` con carga asíncrona y `strict`.
- `src/features/welcome/WelcomeScreen.tsx`, `src/features/topbar/TopBar.tsx`,
  `src/features/workspace/ToastNotification.tsx`,
  `src/design-system/components/overlays.tsx` — `motion.*` → `m.*`.
- `scripts/check-performance-budget.mjs` *(nuevo)* — gate de presupuesto.
- `package.json` — script `verify:perf`, encadenado en `verify`.
- `.github/workflows/ci.yml` — el paso de rendimiento ahora puede fallar.

## Cómo verificar

```bash
npm run verify        # incluye el gate nuevo al final
node scripts/measure-performance.mjs   # composición detallada
npm run validate:ci   # los workflows siguen consistentes
```

Resultado obtenido: 88 archivos / 636 pruebas en verde, frontera protegida
intacta (26 archivos), presupuesto respetado (629 337 / 169 132 contra el
techo 648 000 / 174 000).

Verificación visual en navegador todavía pendiente (el panel de vista previa
estuvo bloqueado toda la sesión). Es especialmente relevante aquí: conviene
confirmar que las animaciones siguen ocurriendo tras la carga diferida del
bundle de capacidades — en particular la animación de entrada de la pantalla
de bienvenida, que ahora podría no alcanzar a ejecutarse en una carga en frío
si las capacidades llegan después del primer pintado (degrada a aparecer sin
animación, que es el mismo resultado que con `prefers-reduced-motion`).

## Pendiente / siguiente paso

- Cerrar la brecha restante vs 0.8.1 (decisión de diseño, ver arriba).
- Sin push (instrucción explícita del usuario: trabajo solo local, sin GitHub).
