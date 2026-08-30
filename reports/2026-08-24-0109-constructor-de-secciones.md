# El constructor de secciones, dentro del Inspector

**Fecha:** 2026-08-24 01:09
**Agente:** Claude Code
**Rama:** claude/upgrade-integral-mejoras-lpa0pt

## Qué cambió

`src/data/sectionBuilder.ts` existía desde la primera tanda y estaba validado
contra el catálogo entero, pero no había forma de pedirlo desde la aplicación:
era el primero de los cinco pendientes que el reporte anterior
(`2026-08-23-2345`) dejó escritos. Esta tanda le da superficie.

Dar una sección a un miembro tenía exactamente dos caminos: elegir un perfil
del catálogo, o escribir A e I a mano. Lo de en medio —«un cajón de 300×200 y
8 mm»— no tenía sitio, y calcularlo aparte para teclear dos números es
justamente donde se cuela un error de exponente.

Ahora el Inspector tiene un plegable **«Construir sección»** debajo del selector
de perfil comercial: se elige forma, se escriben las cotas, y el área, las dos
inercias, los módulos elástico y plástico y los radios de giro salen de la
geometría, con la sección dibujada mientras se escribe.

### Arranca del perfil que ya está elegido, y por la misma puerta que lo valida

Abrir el constructor con un W12x26 puesto no arranca en blanco: arranca en
309,88 mm de canto y 5,842 mm de alma. La traducción perfil → forma es
`shapeOfStandardSection`, y **es la misma función con la que el catálogo valida
las fórmulas**: hasta ahora vivía como una copia privada dentro de
`sectionBuilder.test.ts`, donde el gate comprobaba una traducción que no usaba
nadie más. Se movió al módulo y el test la importa. Dos copias podrían
divergir, y sólo una de las dos estaría bajo el gate del catálogo.

### Milímetros, no metros: una cantidad de unidad nueva

El alma de un IPE 300 son 7,1 mm. En la cantidad `length` del sistema kN-m se
teclearía **0,0071**, y en kip-ft **0,0233**. Esa es exactamente la clase de
número en la que un cero de más pasa inadvertido, y pedírselo a alguien que
está describiendo una sección era el camino corto a un modelo mal escrito.

`sectionDimension` es una cantidad de presentación pura —el constructor calcula
en unidades base, como todo lo demás— que elige por sistema la unidad en la que
un catálogo real publica sus dimensiones: mm, mm, cm, in. Sigue el precedente
de `sectionModulus`, que ya existía con la misma condición escrita en su
comentario. El gate no comprueba un viaje de ida y vuelta —eso se cumple con
cualquier factor— sino que **los dos factores de cada sistema son consistentes
entre sí**: 1000 mm son un metro y 12 in son un pie.

### La duplicación aparente de las reglas, y el gate que la ata

`buildSection` ya rechaza las geometrías imposibles, pero lo hace lanzando un
`Error` **en español**, y esta aplicación se lee también en inglés. Un `catch`
que pintara ese texto pondría castellano en una interfaz inglesa; un mensaje
genérico —«la geometría no es válida»— no diría cuál de las cinco cosas está
mal.

`sectionBuilderIssue` vuelve a enunciar las restricciones para poder nombrarlas
en los dos idiomas. La copia sería peligrosa si pudiera desviarse en silencio,
así que no puede: el gate recorre una malla de dimensiones por forma —diez
valores por cota, cruzando cero, negativo, no finito y las fronteras
geométricas— y exige la **equivalencia en los dos sentidos**: hay motivo si y
sólo si `buildSection` lanza. En el panel, la autoridad sigue siendo el
constructor: si se niega, no se aplica nada, opine lo que opine la enumeración.

### Lo que escribe, y lo que dice que no guarda

Escribe **A e I**, por `member.update` —la misma puerta que un valor tecleado—
y por eso degrada la identidad a «personalizada» sin ningún trato especial. Una
sección descrita a mano no es un perfil del catálogo; escribir un `sectionId`
sería inventar una identidad que ningún catálogo respalda.

La descripción **no se guarda**: el modelo no tiene dónde ponerla, y dárselo es
tocar el tipo del miembro, la persistencia, el diff y la memoria — su propia
tanda. La consecuencia se dice en el panel antes de aplicar, en vez de dejarla
como sorpresa: tras aplicar, el visor vuelve a la rectangular equivalente,
porque A e I es todo lo que queda escrito.

### El eje de flexión se elige

`MemberModel.I` es la inercia del plano de flexión, y el preset del catálogo
aplica siempre la fuerte. Una columna montada con el alma en el otro sentido
flecta con Iy, y hasta hoy la única manera de decirlo era teclear el número. Se
enseñan las dos inercias y se aplica una; cuál, lo dice la persona.

### Reutiliza el dibujo que ya existía

La vista previa no estrena contorno: usa `SectionShape` y `sectionShapeLayout`,
los mismos que el visor de sección del Inspector, alimentados con las cotas
descritas en vez de con A e I. El constructor describe seis formas y el catálogo
tiene seis tipos: son las mismas seis.

## Por qué

Porque un motor validado que no se puede pedir sigue sin existir para quien usa
la aplicación. Es el mismo argumento de la tanda anterior, aplicado al primero
de los pendientes que aquélla dejó nombrados.

## Archivos tocados

**Frontera protegida** (autorizada por el usuario en esta sesión; línea base
refrescada con `--update`, 49 archivos):

- `src/engine/units.ts` — cantidad `sectionDimension` en los cuatro sistemas.
- `src/data/sectionBuilder.ts` — `shapeOfStandardSection` exportada.

**Resto:**

- `src/features/inspector/sectionBuilderForm.ts` *(nuevo)* — modelo puro del
  formulario: formas, cotas por forma, semilla desde el catálogo, motivos y
  geometría de la vista previa.
- `src/features/inspector/SectionBuilderPanel.tsx` *(nuevo)* — el panel.
- `src/features/inspector/InspectorPrimitives.tsx` — `PhysicalNumberField` sube
  aquí desde `InspectorProperties` (ahora tiene dos consumidores) y se añade
  `InspectorDisclosure`, el plegable que «Propiedades avanzadas» ya tenía
  enterrado en su propio componente.
- `src/features/inspector/InspectorProperties.tsx` — cableado y
  `applyBuiltSection`.
- `src/features/inspector/inspectorPreferences.ts` — el plegable nuevo persiste
  su estado como los otros cuatro.
- `src/styles/31-section-builder.css` *(nuevo)* + `src/styles.css` — tramo 31,
  al final por el mismo motivo que el 30: clases nuevas que nadie pisa.
- `src/i18n/es/inspector.ts`, `src/i18n/en/inspector.ts` — 33 claves.
- `qa.mjs` — recorrido `sectionBuilder()` con navegador real.
- Gates: `sectionBuilderForm.test.ts` *(nuevo)*, `SectionBuilderPanel.test.tsx`
  *(nuevo)*, `units.test.ts`, `sectionBuilder.test.ts`, `Inspector.test.tsx`,
  `inspectorPreferences.test.ts`.

## Cómo verificar

```bash
npm run verify
npm run qa      # PLAYWRIGHT_CHANNEL=chromium PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
npm run verify:space3d
node scripts/validate-ci.mjs
```

Leído de esta ejecución:

- `npm run verify` — **exit=0**. **252 archivos / 2605 pruebas** (8 omitidas),
  frente a las 2573 con las que empezó la tanda. «Frontera protegida intacta:
  49 archivos verificados». Carga inicial 770 349 bytes / 195 843 gzip
  (+3 829 / +844 gzip).
- `npm run qa` — **exit=0**, **180 checks** (13 nuevos), ninguno en `false`,
  cero consola y cero errores de página. Medido sobre M1 del pórtico de ejemplo
  con un W12x26 puesto: semilla **309,88 mm** de canto; tras describir un canto
  de 400 mm con ala de 20 mm, **A = 8,697·10⁻³ m²** e **I = 2,610·10⁻⁴ m⁴** en
  el proyecto persistido, con `sectionOrigin: 'custom'` y el modelo resolviendo.
- `npm run verify:space3d` — **exit=0**.
- `node scripts/validate-ci.mjs` — **exit=0**.

### Gates nuevos, probados en rojo

| Se deshace | Qué falla |
|---|---|
| una restricción geométrica en `sectionBuilderIssue` y no en `buildSection` | la malla de equivalencia, nombrando la cota y el valor |
| que el eje elegido mande sobre la inercia aplicada | 1 prueba del panel |
| que cambiar de forma conserve las cotas escritas | 1 |
| escribir sólo A y no I al aplicar | `qa` en `sectionBuilderWritesAreaAndInertiaToTheModel` |

## Dos cosas que salieron por el camino

**Dos regiones anidadas con el mismo nombre.** El panel se etiquetaba a sí mismo
con «Construir sección» y el cuerpo del plegable ya es una región etiquetada por
su disparador. Lo destapó el QA, que se negó a resolver el locator por
ambigüedad —el navegador ve dos regiones donde hay una cosa—. Se retiró la
etiqueta del panel y quedó un check que afirma que hay **una**, no dos.

**Un `fill` de Playwright que concatenaba en vez de reemplazar.** Al recibir el
foco, el campo numérico del Inspector reescribe su texto con la precisión
completa del valor guardado; `fill` enfoca y rellena en el mismo paso, así que
esa reescritura caía encima de lo ya puesto y pedir «200» sobre un ala de
9,652 mm dejaba `9.652000000000001200`. No es un defecto del producto —una
persona enfoca, ve el número y escribe encima—, pero sí una trampa para
cualquier automatización futura sobre estos campos: **enfocar antes, rellenar
después**. Queda como helper con la razón escrita en `qa.mjs`.

Y un tercero, menor, que enseñó la captura del propio QA: tras aplicar, la línea
de cambio dibujaba una flecha entre dos números idénticos. Ahora ese estado dice
que la sección ya está aplicada y no ofrece volver a aplicarla — lo que de paso
comprueba que el número que viajó al modelo es exactamente el calculado.

## Pendiente / siguiente paso

De la lista de la tanda anterior quedan cuatro, en el mismo orden de valor:

1. **Versiones y diff** en Project Hub (`projectVersions.ts`, `projectDiff.ts`).
2. **Guardar en disco y compartir** (`saveBytes`, `buildShareLink`).
3. **Diálogo de la propuesta de IA**, con el diff y la confirmación.
4. **Partición de `StructuralCanvas.tsx`** (~2 350 líneas).

Y esta tanda añade uno propio, nombrado y no resuelto: **la descripción de una
sección construida no se persiste**. Guardarla haría que el visor dibujara la
forma real en vez de la rectangular equivalente y que la memoria pudiera
declararla, pero exige sitio en el tipo del miembro, en la persistencia, en el
diff y en el PDF. Siguen abiertos, de antes, que el certificado y los estudios
no entran en la memoria PDF y que P-Delta con barras de signo restringido avisa
en vez de componer.
