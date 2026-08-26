# Acceso rápido a la evidencia en el lienzo y despliegue ACM

**Fecha:** 2026-08-26 17:41
**Agente:** Claude Code
**Rama:** claude/canvas-quick-access-buttons-ezo45i

## Qué cambió
El lienzo estrena una barra de acceso rápido con cinco botones: **Axial · Cortante ·
Momento · Deformada · ACM**. Los cuatro primeros son las mismas capas de evidencia que
ya vivían dentro del popover de capas (mismo estado, misma función de conmutación),
sacadas a la vista para no cobrar dos clics por mirar el cortante. El quinto, **ACM**,
es lo único nuevo: en vez de turnar N, V y M sobre la barra, los despliega **a la vez**,
cada uno en su carril bajo el modelo, con la escala propia de cada carril y el extremo
sellado. Un desplegable junto al botón deja elegir cuáles de los tres carriles entran
(nunca se puede quedar vacío: el último carril encendido no se apaga).

## Por qué
Petición del usuario a partir de una captura de otra herramienta: quería las cuatro
vistas alcanzables desde el propio lienzo y una quinta que mostrara axial, cortante y
momento apilados bajo la estructura, con la posibilidad de elegir cuáles.

## Archivos tocados
- `src/features/canvas/diagramStack.ts` — **nuevo**. Lógica pura del ACM: orden canónico
  A-C-M, conmutación de carriles, resolución de la barra que se dibuja (selección primero,
  si no la más larga con resultado) y construcción de las rutas en píxeles a partir de las
  mismas Bézier exactas del motor (`segmentBezierControls`). No evalúa nada por su cuenta,
  no toca el modelo y no pide un análisis nuevo.
- `src/features/canvas/diagramStack.test.ts` — **nuevo**. 9 pruebas: orden canónico, no
  vaciarse, resolución de la barra, apilado, escala por carril, extremos y caso sin tramos.
- `src/features/canvas/CanvasDiagramStack.tsx` — **nuevo**. Capa SVG del despliegue, en
  coordenadas del lienzo (se mueve y escala con el dibujo, porque es parte del dibujo),
  anclada bajo el borde inferior del modelo.
- `src/features/canvas/CanvasEvidenceBar.tsx` — **nuevo**. La barra de cinco botones y el
  selector de carriles del ACM.
- `src/features/canvas/CanvasEvidenceBar.test.tsx` — **nuevo**. 3 pruebas: los cinco
  botones y su orden, conmutar la evidencia en un clic, y que el ACM no se pueda vaciar.
- `src/features/canvas/StructuralCanvas.tsx` — monta la barra y la capa; guarda el estado
  del ACM como estado local del lienzo.
- `src/features/canvas/phase2.css` — estilos de la barra, del selector y de los carriles,
  sobre roles del sistema (`--axial`, `--shear`, `--moment`).
- `src/i18n/es/canvas.ts`, `src/i18n/en/canvas.ts` — cinco claves nuevas, en los dos idiomas.

## Decisiones que conviene conocer
- **El ACM es presentación efímera del lienzo.** No entra en `project.settings` ni en el
  historial: desplegar tres carriles bajo el dibujo no es un dato del proyecto. Esto
  también deja intacta la frontera protegida (`types.ts`, `ProjectContext.tsx`).
- **No toca `resultTab`.** El despliegue convive con la evidencia que haya encendida sobre
  la barra en lugar de competir con ella. Sí respeta la capa `results`: encender el ACM la
  enciende, y apagarla apaga el despliegue — la evidencia se apaga con su capa.
- **Cada carril con su escala.** El axial de una viga puede ser mil veces menor que su
  momento; una escala común dejaría dos de los tres diagramas planos.
- **Los carriles abarcan la huella horizontal del modelo**, no la del miembro: en la viga
  simple coinciden, y en un pórtico el carril sigue siendo legible y va rotulado con el id
  de la barra que dibuja.

## Cómo verificar
```bash
npm run verify        # lint · docs · frontera protegida · 2641 pruebas · build · presupuesto
npm run dev           # y en la Mesa: plantilla → analizar → pulsar ACM
```
En el lienzo: los cuatro primeros botones encienden y apagan su evidencia sobre la barra;
ACM despliega los carriles bajo el modelo; el chevrón junto a ACM abre las tres casillas.
Ejecutado en esta sesión: `npm run verify` completo en verde (257 archivos de prueba,
2641 pruebas, frontera protegida intacta con 49 archivos verificados).

## Pendiente / siguiente paso
Nada pendiente. Posible siguiente paso si el usuario lo pide: que el ACM recuerde su
elección de carriles entre sesiones (hoy vuelve a los tres al recargar) y un atajo de
teclado para el despliegue.
