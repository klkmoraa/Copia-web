# ACM · el carril del momento se pintaba sólido

**Fecha:** 2026-08-26 18:15
**Agente:** Claude Code
**Rama:** claude/canvas-quick-access-buttons-ezo45i

## Qué cambió
El carril del momento del despliegue ACM salía como un manchón rojo sólido, en vez del
área translúcida con la que se dibujan el axial y el cortante. La causa no era el tono ni
la opacidad del área: una regla del color del carril pintaba **también de relleno la
línea** del diagrama. Una `<path>` abierta que se rellena se cierra contra su cuerda, así
que la curva se llenaba entera a opacidad plena, por encima del área. Ahora el color se
reparte por propiedad —la línea sólo lleva trazo; el área, el punto del extremo y el
rótulo llevan relleno— y el área baja de 0,22 a **0,18**, la misma opacidad que el
diagrama dibujado sobre la barra (`.diagram-fill`).

## Por qué
Lo vio el usuario: «el momento no encaja con el estilo, debe ser como el cortante, se ve
más opaco el relleno». El defecto sólo se notaba en el momento porque es el único de los
tres cuya cuerda encierra área: un axial constante y un cortante recto coinciden con su
propia cuerda y el relleno de más medía cero.

## Archivos tocados
- `src/features/canvas/phase2.css` — el color del carril se reparte por propiedad; el área
  pasa a 0,18 para igualar el diagrama sobre la barra.
- `src/features/canvas/CanvasDiagramStack.test.tsx` — **nuevo**. Monta la capa con la hoja
  real inyectada y comprueba la cascada que sirve el producto: la línea nunca lleva
  relleno, el área es translúcida y hay un carril por cantidad en orden canónico.

## Cómo verificar
```bash
npm run verify   # 258 archivos de prueba, 2644 pruebas, frontera protegida intacta
```
La prueba nueva es una regresión de verdad: con el CSS anterior falla (la línea del carril
computa `var(--moment)` en lugar de `none`); con el actual pasa. Comprobado además en
Chromium sobre el build de producción: `fill: none` en la línea y `rgb(201, 52, 0) @ 0.18`
en el área del momento.

## Pendiente / siguiente paso
Nada pendiente.
