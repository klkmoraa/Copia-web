# ACM en la paleta de comandos, y una escritura de cursor que sobraba

**Fecha:** 2026-08-26 20:10
**Agente:** Claude Code
**Rama:** claude/canvas-quick-access-buttons-ezo45i

## Qué cambió
1. **El ACM se alcanza desde la paleta de comandos** («Evidencia: ACM · axial, cortante y
   momento»), junto a las otras cinco evidencias que ya estaban ahí. Va por el mismo bus
   de intenciones que el resto del taller —`toggle-diagram-stack`, un comando tipado más
   en `workspaceCommands`—, así que la paleta pide el cambio y el lienzo sigue siendo el
   único que sabe dibujarlo. Aparece desactivado mientras no hay análisis, como sus
   vecinas.
2. **El cursor deja de reescribirse con el mismo número.** Dentro de una zona de imantado
   el puntero recorre píxeles sin cambiar de estación; cada uno de esos movimientos
   repintaba el lienzo, la marca sobre la barra y el panel de resultados con un valor
   idéntico. Ahora la escritura se salta si la estación no cambió.

## Por qué
El ACM era la única evidencia sin puerta de teclado: las otras cuatro se alcanzan desde la
paleta desde CRI-100, y ésta sólo desde su botón. La escritura repetida salió al mirar el
camino del cursor después de añadir el imantado, que es justo lo que lo hace redundante.

## Archivos tocados
- `src/features/workspace/workspaceCommands.ts` — comando `toggle-diagram-stack`.
- `src/features/workspace/commandRegistry.ts` — entrada de paleta junto a las evidencias.
- `src/features/canvas/StructuralCanvas.tsx` — suscripción al comando y guarda de escritura.
- `src/i18n/{es,en}/shell.ts` — etiqueta de la entrada, en los dos idiomas.
- `src/features/workspace/commandRegistry.test.ts` — dos pruebas: que el comando se ofrece
  y pide por el bus, y que aparece desactivado sin análisis.

## Cómo verificar
```bash
npm run verify   # 258 archivos de prueba, 2658 pruebas, frontera protegida intacta
```
Comprobado en Chromium sobre el build: Ctrl+K → «ACM» → Enter despliega los tres carriles
y deja el botón pulsado; repetirlo lo pliega y no queda marca huérfana sobre la barra. De
paso quedó verificado lo que afirmé en la primera entrega y no había comprobado: el
despliegue **sí** entra en lo que el exportador serializa (`diagram-stack-lane` aparece en
el SVG serializado del lienzo).

## Límite conocido
En táctil el despliegue se ve pero no se lee: no hay hover, y un arrastre sobre él encuadra
el lienzo en vez de mover el cursor. Los extremos rotulados siguen dando los números que
gobiernan, así que degrada sin romperse. Cerrarlo pide decidir qué gesto usar —un toque que
hoy deselecciona— y es una decisión de producto, no una que deba tomar por mi cuenta.

## Pendiente / siguiente paso
Nada bloqueante. Dos decisiones abiertas para el usuario: la lectura táctil de arriba, y
persistir la elección de carriles entre sesiones (tocaría `types.ts`, frontera protegida).
