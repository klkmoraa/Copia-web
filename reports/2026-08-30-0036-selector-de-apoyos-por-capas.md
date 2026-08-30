# Reporte de entrega: el selector de apoyos, por capas

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/agregar-apoyos-x624gs`
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se pidió

> «Quiero agregar estos apoyos. Tienes total libertad de hacer todo, yo te adjunto mi idea, tú
> ejecútala como gustes. Cuando acabes actualizas el gh page para verla.»

Adjunto: `structureCoSupportSelectorResearch.pdf`, trece páginas de investigación con una tesis
explícita en la portada:

> «La respuesta no es agregar 20 botones. El selector debe diferenciar entre una condición de
> borde real, una orientación visual, una rigidez y un comportamiento no lineal.»

Y cinco capas propuestas: **01 Base** (5 tipos reales) · **02 Dirección** (presets de rodillo) ·
**03 Rigidez** (spring) · **04 Contacto** (NodeLink) · **05 Interna** (rótulas y releases).

## 2. Qué había, medido contra la propuesta

El apoyo se elegía con **un `<select>` de cinco entradas** dentro de «Propiedades frecuentes»:

```tsx
<SelectField label="Apoyo" value={selectedNode.support.type} …>
  <option value="none">Libre</option><option value="pin">Articulado</option>
  <option value="roller">Rodillo orientable</option><option value="fixed">Empotramiento</option>
  <option value="custom">Personalizado</option>
</SelectField>
```

Tres consecuencias concretas:

| Síntoma | Por qué pasaba |
|---|---|
| «Rodillo de suelo» y «rodillo de muro» parecían no existir. | Son el mismo `type` con distinto `angleDeg`, y el desplegable no tiene forma de decirlo. |
| El campo `Normal` aparecía sin explicar qué es una normal. | Era un número suelto detrás del desplegable, sin preset que lo aterrizara. |
| Una guía —un carro que sólo impide el movimiento vertical— exigía saberse de memoria que se hace con `custom` + `restrainY`. | La matriz Ux/Uy/Rz aparecía vacía, sin punto de partida. |

Y una cuarta, que no estaba en la propuesta y salió al leer el motor: **`spring.angleDeg`
existía en el modelo, el solver lo usaba para orientar `kNormal`, y ninguna superficie lo
enseñaba.** Un rodillo tumbado a 30° con un resorte normal lo aplicaba a 90° por omisión, y no
había manera de verlo ni de corregirlo.

## 3. Lo que la propuesta daba por hecho y no es cierto en este repositorio

La tabla de la página 3 del PDF marca `NodeLink` como **«Ya existe»** para contacto lineal,
sólo-compresión, sólo-tensión, tope con holgura y fricción.

```
$ grep -rn "NodeLink\|nodeLink" src --include=*.ts --include=*.tsx
(sin resultados)
```

No existe: ni el tipo, ni el campo, ni el ensamblaje. `src/types.ts` declara cinco
`SupportType` y `SupportDefinition` no tiene ninguna relación con otro nodo. El contacto
unilateral **sí** existe, pero en la barra (`member.axialBehavior`, resuelto iterando el
conjunto activo en `activeSet.ts`), no en el nudo.

Así que **la capa 04 no se implementó, y tampoco se dibujó apagada.** Una tarjeta «Sólo
compresión» que no puede hacer nada promete física inexistente, y `AGENTS.md` es explícito:
un reporte o una especificación no prueban que algo esté implementado. Lo que se entrega son
las capas que el motor sí sostiene. La 04 queda descrita aquí, en §7, como lo que es: trabajo
de motor pendiente.

## 4. Qué se hizo

### 4.1 El catálogo, separado de la pintura

`src/features/inspector/supportCatalog.ts` — lógica pura, sin React. Declara los presets de
las tres capas implementables y las funciones que los aplican y los reconocen:

| Capa | Presets | Qué escribe cada uno |
|---|---|---|
| 01 · Condición de borde | Libre · Articulado · Rodillo · Empotramiento · Personalizado | `type` |
| 02a · Dirección del rodillo | Suelo · Muro · Inclinado | `angleDeg = 90 / 0 / 45` |
| 02b · Guías | Guía horizontal · Guía vertical | `restrainY` / `restrainX` |

La regla que lo sostiene está en una prueba, no en un comentario:

```ts
it('no declara ningún tipo fuera de los cinco que existen', () => {
  const declared = new Set([...BASE, ...DIRECTION, ...GUIDE].map((preset) => preset.type));
  expect([...declared].sort()).toEqual(['custom', 'fixed', 'none', 'pin', 'roller']);
});
```

`describeSupportDof` es la copia legible de `assembleKinematicConstraints`: un rodillo se
declara en su normal y su tangencial, **no** en Ux y Uy, porque el solver monta para él una
sola ecuación `cos θ·ux + sen θ·uy = 0`. Otra prueba fija esa correspondencia fila a fila.

### 4.2 El selector

`SupportPicker.tsx` — la capa 02 sólo aparece cuando el tipo elegido la admite. Un
empotramiento no enseña nada más porque no hay nada que ajustar; un rodillo abre sus tres
presets y el campo `Normal`; un personalizado abre las dos guías y la matriz Ux/Uy/Rz.

Cada tarjeta lleva **tres cosas, siempre**: el nombre, el campo del modelo que escribe
(`type = roller`, `angleDeg = 45`, `restrainY = true`, sin traducir) y sus grados de libertad.
Que las tres tarjetas de dirección digan `angleDeg = …` y ninguna diga `type = …` es lo que
hace evidente, sin explicárselo a nadie, que suelo, muro e inclinado no son tipos distintos.

Los controles son `input[type=radio]` de verdad. Un `div[role="radiogroup"]` habría obligado a
reimplementar a mano el recorrido con flechas y el anuncio «2 de 5»; el aspecto de tarjeta lo
pone el CSS sobre la etiqueta.

### 4.3 Los símbolos, los mismos que el lienzo

`SupportGlyph.tsx` reproduce las coordenadas de `CanvasGeometryLayer` a la misma escala. Un
rodillo se dibuja girado `angleDeg − 90`, como en el modelo, así que el preset «Muro» se ve
tumbado **antes** de pulsarlo.

El encuadre costó una segunda vuelta. El apoyo cuelga por debajo del nudo, así que girarlo
alrededor del nudo lo saca de la caja: a 45° la placa rayada se salía de la tarjeta y a 0° se
comía a la vecina —se vio en la captura, no en el código—. Cada símbolo declara su centro y el
grupo se recoloca por el **centro ya girado**, con `viewBox` cuadrado porque cualquiera de los
dos ejes puede tocarle al giro.

Los tipos que el solver no orienta —articulado, empotrado, personalizado— se dibujan siempre
rectos aunque el modelo traiga un `angleDeg`. El lienzo sí los gira; el solver no lo usa.
Girarlos en el selector prometería una orientación que el análisis no tiene en cuenta.

### 4.4 La capa 03, donde le toca

La rigidez **no** entra en el selector: se anuncia. Cuando hay resortes con valor, el selector
dice cuáles (`Rigidez elástica activa (ky, kNormal)`) y remite a Propiedades avanzadas. Es la
distinción de la portada del PDF: una rigidez es una relación fuerza-desplazamiento, no un
pictograma de apoyo.

Y ahí, en Propiedades avanzadas, se añade el campo que faltaba: **`Dirección de k normal`**,
visible sólo cuando hay `kNormal`. Con un aviso cuando discrepa de la normal del rodillo:

> El resorte normal actúa a 90.00° y la normal del rodillo está a 30.00°. Son campos distintos
> y el análisis usa cada uno por su lado.

No es un error del modelo —el solver hace exactamente eso— pero tampoco es lo que nadie
escribió a propósito.

### 4.5 Contraste

La primera versión de las fichas de grado de libertad usaba
`--sc-color-structure-support` de fondo con `--sc-color-on-signal` de texto. En modo noche eso
es **gris claro sobre blanco**: se vio en la captura en oscuro. La ficha restringida se invierte
ahora contra `--sc-color-text-primary`, que es el único par garantizado en los dos temas sin
inventar un rol, y la libre lleva trazo discontinuo para no depender sólo del color.

## 5. Qué NO cambió

- **La frontera protegida, byte a byte.** `npm run verify:protected` → *«Frontera protegida
  intacta: 50 archivos verificados.»* Ni `src/engine/**`, ni `src/types.ts`, ni el solver. No
  hay un `SupportType` nuevo, ni un campo nuevo, ni una ecuación nueva.
- **Los resultados.** Ningún proyecto existente cambia de análisis. Lo único que cambia de
  comportamiento al editar es que pulsar la tarjeta «Personalizado» estando ya en
  personalizado **conserva** las casillas marcadas, donde el desplegable las borraba. Llegar a
  personalizado desde otro tipo sigue dando las tres libres, como antes.
- **La regla de limpieza.** Cambiar de tipo conserva `spring` y descarta `prescribed`, igual
  que hacía el desplegable: el solver rechaza un asentamiento sobre un grado de libertad que
  el apoyo nuevo ya no restringe.

## 6. Verificación ejecutada

```
npm run lint                → 0 avisos nuevos
npm run verify:docs         → 10 documentos clasificados, enlaces válidos
npm run verify:protected    → frontera intacta, 50 archivos
npm test                    → 317 archivos, 3 048 en verde y 8 saltadas; 33 nuevas
npm run build               → correcto
npm run verify:perf         → 830 964 B / 214 750 gzip
npm run verify:entry        → chunk de entrada limpio
npm run verify:browser-bundle → 89 archivos, sin construcciones de Node
```

Un gate lo cazó por el camino y merece constar: `numericPolicy.test.ts` rechazó dos `.toFixed(2)`
que se habían colado en el selector y en el aviso del resorte. Ahora pasan por `formatFixed`,
que es la única puerta de presentación numérica del producto.

Evidencia visual: capturas en claro y oscuro del selector con los cinco tipos base, con la capa
de dirección abierta en «Inclinado» y con las guías; tomadas sobre el `dist/` construido, en
Chromium a 1440×950 y `deviceScaleFactor: 2`.

## 7. Lo que queda, y qué haría falta

| Pendiente | Qué requiere |
|---|---|
| Capa 04 · contacto en el nudo (sólo-compresión, sólo-tensión, tope, fricción) | Una entidad de vínculo en el modelo **y** un lazo de conjunto activo en el nudo, como el que ya existe para barras en `activeSet.ts`. Es trabajo de motor y toca la frontera protegida: necesita autorización explícita. |
| Presets de asentamiento en el selector | El asentamiento por caso ya existe y se edita en Propiedades avanzadas. Subirlo a una tarjeta obligaría a elegir caso de carga dentro del selector, que es exactamente la mezcla de capas que la propuesta pide evitar. |
| `damper`, `isolator`, multilineal, goma | El propio PDF los marca «No proponer aún». Siguen sin proponerse. |

---

## Referencias

- Investigación adjunta: `structureCoSupportSelectorResearch.pdf`, v0.3 (13 páginas), con
  SkyCiv, Dlubal RFEM 6, CSI SAP2000, SCIA y OpenSees como fuentes consultadas.
- Frontera y flujo de trabajo: [`AGENTS.md`](../AGENTS.md).
- Sistema de diseño: [`src/design-system/README.md`](../src/design-system/README.md).
