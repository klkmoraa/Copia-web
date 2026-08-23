# Evidencia · Superficie «Datos» unificada

**Ejecutado:** 2026-08-23 · Chromium real sobre el `dist/` de producción.
**Clasificación:** `AUDIT/TEMPORARY` — ver [reports/README.md](../../README.md).

| Captura | Qué enseña |
|---|---|
| `1-datos-resultados-light.png` | Una superficie, tres pestañas, y **las ocho lecturas de resultado en una sola tira**: Resumen · Reacciones · Axial · Cortante · Momento · Deformada · Influencia · Aprender. Antes estaban partidas entre dos componentes con dos lanzadores. |
| `1-datos-resultados-dark.png` | Lo mismo en Noche. |
| `2-datos-reacciones-misma-tira.png` | Reacciones era una superficie aparte que se pedía desde un grupo de lanzadores. Ahora es la pestaña de al lado. |
| `3-datos-tabla.png` | La Hoja de datos como pestaña «Tabla», sin cromo propio. |
| `4-datos-revision.png` | El Model Doctor como pestaña «Revisión», sin cromo propio. |
| `5-datos-k0-pantalla-completa.png` | K0 táctil, 390×844: la misma superficie a pantalla completa. |

## Lo que estas capturas dejan medir

- **El lienzo recupera el alto del dock inferior.** Resultados era un carril
  acoplado y redimensionable en la parte de abajo; ya no existe.
- **Un cromo, no cuatro.** Un título, un botón de cerrar, un `peek`. Antes cada
  una de las cuatro superficies densas traía el suyo.
- **La superficie es modal.** Mientras está abierta, el fondo queda `inert`.
  Es la consecuencia buscada de que todo lo denso viva en una superficie
  invocada, y no un efecto colateral: el dock anterior era modeless en K0 y por
  eso convivía con el lienzo.

## Dos defectos que la fusión destapó, y quedaron corregidos

1. **El diagrama no cabía.** El cajón por defecto del sistema mide 420 px y la
   lectura de un diagrama se partía en tres líneas. «Datos» toma ancho propio
   (`min(720px, 100vw)`) y el contenido se adapta por **`@container`**, no por
   `@media`: en X2 el viewport es ancho y el contenedor no, y una consulta de
   viewport no puede ver eso.
2. **Un borrador sin aplicar se habría perdido en silencio.** Mientras cada
   superficie montaba su propio cajón, sus borradores vivían en el componente
   que lo envolvía y sobrevivían a una suspensión por accidente de dónde estaba
   declarado el `useState`. Al meter los cuerpos dentro del cajón compartido,
   `AnimatePresence` los desmontaría. `retainedState.tsx` vuelve esa propiedad
   explícita, y hay prueba que lo fija.
