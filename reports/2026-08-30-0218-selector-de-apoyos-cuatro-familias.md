# Reporte de entrega: el selector de apoyos, rehecho sobre el prototipo de Figma

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/agregar-apoyos-x624gs`
**Commits:** segunda vuelta, sobre `5b430ea` (ver el commit que acompaña este reporte)

---

## 1. Qué se pidió

> «No me gustó cómo lo pusiste, acomódalo más o menos así.»

Con cinco capturas del prototipo **StructureCo · Sistema de Apoyos Clay** en Figma: un
selector de escritorio, una hoja inferior de móvil y una tabla «Biblioteca · Todos los apoyos».

La primera vuelta (`5b430ea`) había implementado las capas del PDF de investigación —tipo base,
luego orientación— pero con una composición propia: `fieldset` numerados 01/02 y fichas de
grados de libertad diminutas. El prototipo dice otra cosa, y la dice mejor.

## 2. Qué pedía el prototipo, y qué se hizo con cada cosa

| Del prototipo | Qué se hizo |
|---|---|
| Pestañas `Básicos · Guiados · Elásticos · Avanzado` | Implementadas con el `Tabs` del Design System (recorrido con flechas incluido). La pestaña abierta es la del apoyo vigente. |
| Mosaicos de icono grande + nombre + `Ux ✕ · Uy ✕ · Rz ✓` | Implementados, con la leyenda `✓ libre / ✕ restringido` fija arriba. |
| Panel de detalle con nombre, símbolo grande y campos | Implementado. Sigue **al foco**, no al tipo: pulsar «Resorte Y» abre su campo mientras el nudo sigue siendo un articulado. |
| `Orientación visual`: Auto · 0° · 90° · 180° · 270° | Implementada para articulado y empotramiento, con la frase del prototipo palabra por palabra. |
| Tabla «Biblioteca · Todos los apoyos» | Implementada como diálogo, desde el botón «Ver todos los apoyos y restricciones» de la hoja móvil. |
| Sección «Conexiones · no son apoyos externos» | En la biblioteca, informativa: no son apoyos al terreno y no se aplican desde ahí. |
| Recuadro «Regla de orientación» | Al pie de la biblioteca. |
| `Tip: para rodillos, el ángulo representa la normal física` | Al pie del selector. |
| Hoja inferior de móvil | **No** se hizo. Ver §6. |

## 3. Tres cosas del prototipo que cambiaron el modelo mental, no sólo el layout

### 3.1 Una guía restringe también el giro

El PDF de la primera vuelta decía «Guía horizontal — Uy restringido / Ux libre / **Rz libre**».
El prototipo dice `Ux ✓ · Uy ✕ · **Rz ✕**`. El prototipo tiene razón: un apoyo guiado es el
patín que corre por un carril sin poder voltearse, y con el giro libre volvería a ser
exactamente un rodillo escrito a mano. Las dos guías pasan a escribir `restrainR = true`, y una
prueba lo fija.

### 3.2 El giro de un empotramiento nunca fue física, y ahora se dice

El recuadro «Regla de orientación» separa dos cosas que el código ya trataba distinto sin
contarlo:

```
Empotrado / articulado   Giro = sólo presentación visual.
Rodillo                  Ángulo = normal física de restricción.
```

Es verdad en este motor: `assembleKinematicConstraints` usa `angleDeg` **sólo** en la rama del
rodillo (`cos θ·ux + sen θ·uy = 0`); para `fixed` y `pin` monta las mismas ecuaciones lo traiga
o no. Pero `CanvasGeometryLayer` sí gira sus símbolos con ese campo. Es decir: el
comportamiento que el prototipo describe ya existía, y no había ningún control que lo ofreciera
ni ninguna frase que lo explicara.

Ahora hay las dos: los pasos Auto/0/90/180/270 escriben `angleDeg`, y debajo va la frase del
prototipo. **Auto borra el campo** en lugar de guardar un cero: dibujan igual, pero sólo la
ausencia dice que nadie eligió una orientación.

**La trampa que esto abría, y cómo se cierra.** Con un solo campo para dos significados,
cambiar de empotramiento a rodillo convertiría en silencio una decisión de presentación en una
restricción física. El prototipo lo vio y recomienda «`symbolAngleDeg` separado de `angleDeg`»
— que exigiría tocar `src/types.ts`, frontera protegida. Sin partir el campo, `applySupportPreset`
cierra el agujero por el otro lado: **el ángulo sólo se hereda entre tipos que lo entienden
igual**. Un rodillo hereda de un rodillo; un articulado y un empotramiento se pasan su giro
visual entre ellos; entre las dos familias, nunca. Hay una prueba por cada una de esas tres
reglas.

### 3.3 Los resortes son una familia, no un apartado escondido

El prototipo los pone como mosaicos, en su propia pestaña. Es la lectura correcta de la regla
del PDF —«no ponerlos junto a Libre, Articulado, Rodillo y Empotrado»—: la separación es la
pestaña, no el destierro. Así que **los resortes se mudaron** de «Propiedades avanzadas» al
selector, con su símbolo y con el campo de dirección de `kNormal`. No quedó una segunda copia
en avanzadas: dos sitios para editar el mismo campo es la forma más fiable de que uno acabe
mintiendo. El bloqueo del modo Aula se mudó con ellos.

Ninguna tarjeta elástica escribe un número. El solver suma `k` directo a la diagonal de la
matriz, así que una rigidez inventada por la interfaz sería una rigidez inventada en el
resultado: la tarjeta abre el campo, el valor lo pone quien sabe cuánto vale.

## 4. Lo que el prototipo daba por hecho y este motor no tiene

La biblioteca del prototipo incluye **Sólo compresión, Sólo tensión, Tope con holgura y
Fricción**. En este repositorio no existen: no hay `NodeLink` en `src/types.ts`, ni entidad de
vínculo, ni lazo de conjunto activo en el nudo. (El contacto unilateral que sí existe es axial
y vive en la barra, `member.axialBehavior`.)

En la vuelta anterior se decidió no dibujarlas. Con el prototipo delante, la decisión cambia:
**se enseñan, y se declara que no están.** Aparecen en la pestaña Avanzado y en la biblioteca,
en trazo discontinuo, sin poder pulsarse, con la etiqueta «No disponible en este motor» y una
frase que dice por qué. Un catálogo que sólo enseña lo disponible deja al estudiante creyendo
que lo que falta no existe; una tarjeta que se puede pulsar y no hace nada es peor todavía.

Que no se puedan aplicar no es una decisión de CSS: es un dato. Cada una lleva
`kind: 'unavailable'` y una prueba comprueba que **ninguna declara un tipo, unas restricciones
ni unas rigideces**, y que pasarlas por `applySupportPreset` devuelve el apoyo intacto.

## 5. Qué NO cambió

- **La frontera protegida, byte a byte.** `npm run verify:protected` → *«Frontera protegida
  intacta: 50 archivos verificados.»* No hay un `SupportType` nuevo, ni un campo nuevo, ni una
  ecuación nueva. Todo lo que el selector escribe ya existía en `SupportDefinition`.
- **Los resultados.** Ningún proyecto existente cambia de análisis.
- **Dónde se editan los asientos.** Siguen en Propiedades avanzadas, por caso de carga; la
  pestaña Avanzado los cuenta y dice dónde están, sin duplicar el editor.

## 6. Lo que queda

| Pendiente | Por qué |
|---|---|
| Hoja inferior de móvil | El prototipo la dibuja como superficie propia. El selector actual ya responde en el ancho del Inspector, pero una hoja de dos niveles es otra superficie con su propio disparador y su gestión de foco. Se puede hacer; no entra en «acomódalo». |
| El selector como modal sobre el lienzo | El prototipo lo dibuja flotando sobre el modelo. Aquí vive en el Inspector, que es donde el producto pone las propiedades de lo seleccionado; moverlo sería una decisión de arquitectura, no de composición. |
| Contacto no lineal en el nudo | Entidad de vínculo en el modelo **y** lazo de conjunto activo. Toca la frontera protegida: requiere autorización explícita. |
| `symbolAngleDeg` separado de `angleDeg` | La recomendación del propio prototipo. Es un campo nuevo en `src/types.ts`. Mientras tanto, la regla de herencia de §3.2 evita el daño que la separación evitaría. |

## 7. Verificación ejecutada

```
npm run lint                  → 0 avisos nuevos
npm run verify:docs           → documentos clasificados, enlaces válidos
npm run verify:protected      → frontera intacta, 50 archivos
npm test                      → suite completa en verde
npm run build                 → correcto
npm run verify:perf           → dentro de presupuesto
npm run verify:entry          → chunk de entrada limpio
npm run verify:browser-bundle → sin construcciones exclusivas de Node
```

Evidencia visual: capturas en claro y oscuro de las cuatro pestañas, del panel de detalle con
orientación visual, de la familia elástica con su campo de rigidez, de las condiciones no
disponibles y de la biblioteca completa; tomadas sobre el `dist/` construido, en Chromium a
1500×980 y `deviceScaleFactor: 2`.

Dos correcciones salieron de mirar las capturas y no el código: los símbolos girados se salían
de su tarjeta a 45° —se recolocan por su centro ya girado—, y las fichas de grados de libertad
repetían en la biblioteca lo que la línea de notación ya decía, con distinto vocabulario en el
rodillo. Se quedó una sola.

---

## Referencias

- Prototipo: **StructureCo · Sistema de Apoyos Clay** (Figma), cinco capturas adjuntas por el usuario.
- Investigación previa: `structureCoSupportSelectorResearch.pdf` v0.3.
- Primera vuelta: [`2026-08-30-0036-selector-de-apoyos-por-capas.md`](2026-08-30-0036-selector-de-apoyos-por-capas.md).
- Frontera y flujo de trabajo: [`AGENTS.md`](../AGENTS.md).
