# Sistema de diseño

**Clasificación:** `CANONICAL`

structureCo se comporta como una aplicación de escritorio del sistema: neutra,
densa, precisa y sin decoración. Este documento explica **por qué** el sistema es
así; `tokens.css` es lo que lo implementa y `brand/brandbook.html` lo enseña
leyendo esos tokens en vivo.

## Las cuatro decisiones

Todo lo demás sale de aquí. Si una pieza nueva no encaja, la que está mal es la
pieza.

1. **Neutro absoluto.** Los grises no tienen temperatura. En cuanto un gris coge
   un matiz, el acento deja de ser el único color de la pantalla y el color deja
   de significar algo.
2. **Un solo acento.** El azul de sistema identifica y acciona. Nada más lo hace.
   Un botón azul sobre una pantalla gris dice «esto es lo siguiente» sin
   necesitar tamaño ni sombra.
3. **Material, no sombra.** La profundidad la comunica un material translúcido
   que desenfoca y satura lo que tapa, más un filete de medio píxel. Ninguna
   pieza tiene volumen propio.
4. **Rellenos, no cavidades.** Un campo, un segmento o un fondo pulsado son un
   relleno gris translúcido de la jerarquía de fills, nunca un hueco excavado con
   sombra interior.

## Las nueve capas de `tokens.css`

| Capa | Qué contiene | Quién la consume |
|---|---|---|
| 1 · Primitivas | Grises acromáticos y colores de sistema. | Nadie directamente. |
| 2 · Roles semánticos | `--sc-color-*`: fondos, superficies, rellenos, tintas, acción, estados. | Los componentes. |
| 3 · Roles técnicos | Cargas, diagramas, reacciones, cotas, ejes. | El lienzo y los resultados. |
| 4 · Forma | Espaciado, tamaños, radios por rol. | Todo. |
| 5 · Materia | Materiales, elevación, filete, anillos. | `material.css`. |
| 6 · Tipografía | Familias, pesos, escala, tracking óptico. | Todo. |
| 7 · Controles | Alturas, layout, densidad. | El shell. |
| 8 · Motion | Duraciones, curvas, apilamiento. | Todo. |
| 9 · Alias | `--accent`, `--surface`, `--text`… | CSS heredado. |

## Color: se decide por apariencia

El sistema anterior exigía un mismo HEX en claro y en oscuro para todo rol
semántico. Eso encerraba la paleta en una franja de luminancia estrechísima y no
es como trabaja la plataforma que este producto imita: **systemBlue vale #007AFF
en claro y #0A84FF en oscuro** porque un color medido sobre blanco no está medido
sobre negro.

Lo que sustituye a aquella regla es un contrato más exigente, no más laxo:

> Todo rol debe alcanzar **3:1** contra los **dos** fondos de **su** apariencia
> —lienzo y superficie—, y **4,5:1** si escribe texto.

En claro, la familia técnica usa los grados *accessible* de la paleta de sistema
(los de alto contraste, `#0040DD`, `#248A3D`, `#C93400`…), que son los correctos
para un trazo de 1,5 px sobre papel blanco. En oscuro usa los grados vivos
(`#0A84FF`, `#30D158`, `#FF9F0A`…). `tokens.test.ts` mide cada rol contra los dos
fondos de su apariencia en cada ejecución de la suite.

El relleno de acción es la única pieza que comparte HEX en las dos apariencias
(`#0071EB`), y no por doctrina: es el único grado de systemBlue que llega a 4,5:1
con texto blanco encima **y** a 3:1 contra los dos lienzos. Por encima se come la
etiqueta; por debajo desaparece sobre el fondo oscuro.

## Materia: seis niveles

Lo que distingue un nivel de otro no es cuánto volumen tiene la pieza, sino en
qué plano está: el valor del fondo, el material y el filete.

| Nivel | Qué es | Cómo se pinta |
|---|---|---|
| `flat` | Zona técnica densa: tabla, fila, celda. | Relleno cuaternario, sin canto visible, sin sombra. |
| `inset` | Campo, segmento, bandeja. | Relleno terciario. **No** es una cavidad. |
| `raised` | Panel, tarjeta, barra acoplada. | Superficie opaca + filete. Sin proyección: no está despegada de nada. |
| `floating` | Popover, menú, aviso. | Material grueso + desenfoque + anillo especular + elevación 3. |
| `sheet` | Plano que nace de un borde. | Proyección hacia dentro del viewport, en la dirección de su lado. |
| `modal` | Interrupción. | Elevación 4 + velo que además desenfoca. |

El pulsado no hunde: sube el relleno un grado y encoge la pieza un 3 %.
**Ningún control se eleva bajo el puntero** — se tiñe. La profundidad se reserva
para lo que de verdad flota, y por eso ahí sí se nota.

## Forma

`data 0 · control 7 · card 12 · panel 14 · modal 18 · cápsula 999`

El reparto es por **rol**, no por tamaño de la caja: un botón de 44 px y otro de
28 px son los dos controles y comparten radio. Un panel no hereda el radio de sus
controles por estar hecho de ellos. La cápsula sobrevive sólo donde el sistema la
usa —segmentos, etiquetas, contadores—, nunca un panel ni una tarjeta.

`data` es el escalón cero: no es «un radio muy pequeño», es la ausencia
deliberada de radio en una celda comparable. Redondear una rejilla la vuelve más
difícil de barrer, no más amable.

## Tipografía

Una sola familia hace la interfaz entera y la jerarquía la llevan el peso, el
tamaño y el tracking óptico. La primera de cada pila no es un archivo: es la cara
del sistema (SF Pro, SF Mono), que no se puede empaquetar ni hace falta
empaquetar. **Inter** es el sustituto donde no la hay, elegido por métricas.

El cuerpo es **13 px**, el de una app de escritorio, no los 14 de una página. El
semibold es **590**, que es el valor real de SF y no un 600 redondeado.

La monoespaciada existe para los **números** —valores, unidades, fórmulas y
matrices— y para nada más. Rotular con ella una pestaña, una insignia o el nombre
del proyecto era la voz del sistema anterior.

## Disposición

Las cuatro decisiones gobiernan la materia. Éstas gobiernan **dónde se pone
cada cosa**, y salen de haber medido dónde el producto seguía delatándose como
una página web maquillada de app.

1. **El producto abre como un lanzador de documento, no como una página.** Una
   ventana acotada y centrada, con lo que se puede crear a un lado y lo que ya
   existe al otro. Sin asistente, sin etapas y sin espacio muerto bajo el
   pliegue: un lanzador se acaba donde acaba su contenido.
2. **Una superficie por destino.** Cada capacidad se alcanza desde exactamente
   un sitio de la pantalla. Dos caminos al mismo lugar no son comodidad: son dos
   estados que hay que mantener de acuerdo, y ninguno de los dos dice que el
   otro existe. La excepción es la degradación responsive, donde sólo uno de los
   dos es visible a la vez y los dos consumen la MISMA definición.
3. **La barra superior no rotula sus ítems.** Un ítem de barra unificada enseña
   su valor, no su categoría; apilar etiqueta sobre control multiplica el ancho
   por el número de ítems y termina truncando la etiqueta, que es lo peor de los
   dos mundos. Lo que necesita rótulo va en un popover, donde hay sitio.
4. **Ninguna superficie flotante se solapa con otra.** Chrome de lienzo, barras
   contextuales, lanzadores y paneles comparten esquinas; el que llega después
   cede o se apila, nunca se superpone. Lo vigila
   `verifyFloatingSurfacesDoNotOverlap` en `npm run qa`.
5. **La ayuda se revela; no se apila ni se borra.** Una pista de campo vive en un
   globo que aparece al apuntar o al enfocar, con `opacity`, nunca con `display`
   ni `visibility`: sigue en el árbol de accesibilidad porque
   `aria-describedby` la referencia. Un error no es una pista y no se recoge.

## Lo que este sistema no hace

- **No dibuja volumen.** Ninguna pieza declara su propia fuente de luz. La única
  excepción es la figura isométrica de la bienvenida, que no es interfaz sino un
  dibujo, y lleva su luz entera en `graphics/isometricPortal.ts`.
- **No usa el acento como luz.** Sin halos, sin brillos, sin degradados
  construidos sobre el color de acción. El acento rellena; no modela. La regla
  vale también para los consumidores, no sólo para los tokens: `tokens.test.ts`
  recorre `styles.css`, `material.css`, `ui.css` y `phase1.css` buscando rampas
  construidas sobre el acento, que es donde se habían quedado dos auroras de la
  identidad anterior sin que ningún gate las viera.
- **No colorea por variedad.** Un mosaico de icono, una flecha o una insignia
  llevan color sólo cuando ese color significa algo: acción (acento), estado
  (advertencia, error) o dominio técnico (cargas, diagramas, reacciones — §3 de
  `tokens.css`, que es la codificación del lienzo). Todo lo demás es monocromo.
- **No rotula en versalitas.** Una etiqueta pequeña se distingue por ser gris y
  semibold, no por gritar en mayúsculas trackeadas.
- **No baja de 10 px.** Por debajo no hay tipografía, hay textura.
- **No deja un token sin consumidor.** Un token que nadie lee no reserva un
  significado: sólo viaja en el chunk de entrada. Lo mismo vale para una clase
  CSS y para una clave de traducción.

## Iconografía

Seis escalones y ninguno más: **14** (leyenda) · **16** (fila y control) ·
**18** (barra de herramientas) · **20** (acción principal y cabecera) · **22** y
**28** (figura). Antes convivían catorce tamaños distintos entre 12 y 28 px,
elegidos a ojo uno por uno: 13 y 14 no significan cosas distintas, sólo dicen
que nadie llevaba la cuenta.

## Los gates

Ninguno se relaja para dejar pasar un cambio. Si un contrato deja de valer, se
reescribe el gate explicando por qué — que es exactamente lo que se hizo al
retirar la identidad anterior.

| Archivo | Qué vigila |
|---|---|
| `tokens.test.ts` | Contraste por apariencia, apariencia oscura escrita a mano, ausencia de materia esculpida. |
| `surfaceGeometry.test.ts` | Radios por rol, elevación monótona, filete de medio píxel, ningún control que se eleve. |
| `material.test.ts` | Los seis niveles, el material translúcido con su respaldo opaco, el pulsado como relleno. |
| `typography.test.ts` | Cara del sistema primero, escala de escritorio, ninguna cara editorial. |
| `npm run qa` | Los mismos contratos, compuestos por el navegador de verdad (149 checks), más los solapes de superficie flotante y la ayuda revelada del inspector. |

## Cómo añadir algo

1. Busca el rol que ya existe. Casi siempre existe.
2. Si no existe, añádelo en la capa que le corresponde y **con un consumidor**.
3. Consume roles, nunca literales ni primitivas.
4. Si tu pieza necesita una sombra, pregúntate de qué está despegada. Si la
   respuesta es «de nada», no necesita una sombra.
5. Ejecuta `npm run verify` y `npm run qa`.
