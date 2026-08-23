# Pandeo, modos, certificado y cables: de calculables a usables

**Fecha:** 2026-08-23 23:45
**Agente:** Claude Code
**Rama:** claude/upgrade-integral-mejoras-lpa0pt

## Qué cambió

El reporte anterior (`2026-08-23-2219`) cerró nueve subsistemas en el motor y
dejó escrito el problema en su propio apartado de pendientes: **casi ninguno
tenía superficie de usuario**. El pandeo se calculaba y se probaba, y no había
forma de pedirlo desde la aplicación.

Esta tanda cierra esa brecha para los tres de más valor. Seis commits.

### Los estudios se piden, y por eso tienen su propio camino

Pandeo, modos de vibración y certificado numérico **no** entran en `analyze()`.
Meterlos ahí habría multiplicado el coste de cada análisis interactivo de todos
los modelos por unas lecturas que la mayoría no va a mirar: el pandeo levanta un
problema de autovalores y el certificado cuesta cuatro resoluciones extra.

La forma no se inventó: es la de `useScenarioAnalysis`, que ya resolvió este
mismo problema para la comparación de escenarios. Un dominio `studies` en el
sobre de workers que ya existía, un worker por petición, cancelación por
`requestId` y reserva síncrona cuando no hay `Worker`.

Un solo dominio para los tres porque desde fuera son la misma cosa, con la carga
útil discriminada por `kind` y la respuesta etiquetada con él: el llamador no
puede recibir el resultado de un estudio que no pidió. La combinación viaja por
su **id** y se resuelve dentro del manejador — mandar el objeto entero
permitiría pedir un estudio bajo una combinación que no está en el proyecto.

**Dos relojes de invalidación, no uno.** El modelo que cambia tira los tres; un
modo de un modelo que cambió no es un modo de este modelo. Cambiar de
combinación caduca pandeo y certificado —los dos dependen de la carga— y **deja
los modos**, que no dependen de ninguna: tirarlos sería descartar algo que sigue
siendo cierto.

### Los cables, alcanzables

`analyzeProjectAuto` —el punto único de despacho, que llaman `ProjectContext` y
el worker— enruta la rama de primer orden por `analyzeProjectWithActiveSet`
**sin condicional**: esa función ya delega en `analyzeProject` sin tocar nada
cuando ningún miembro declara `axialBehavior`.

La pregunta que decidía si esto era seguro no era «¿los cables funcionan?» sino
«¿los modelos que NO tienen cables siguen dando exactamente lo mismo?». Es la
primera prueba del archivo nuevo, comparando desplazamientos, resultados de nudo,
de miembro y equilibrio contra la ruta directa.

**P-Delta y el conjunto activo no componen todavía, y se dice.** Un modelo con
las dos cosas se resuelve con P-Delta y suma una incidencia declarando que la
restricción de signo no se aplicó. Callarlo devolvería barras trabajando a
compresión que el usuario declaró incapaces de hacerlo.

### Pandeo y modos en «Datos», con su modo dibujado

Dos pestañas en la misma tira, en una familia `stability` que va después de la
deformada —porque también son formas— y antes de las herramientas de estudio
—porque siguen siendo lecturas del modelo—.

**Un modo no se dibuja como la deformada.** Aquella interpola con
`result.deformation`, puntos que el solver produce a lo largo de cada miembro;
un modo sólo trae `ux`, `uy` y `rz` por nudo. Unir nudos con rectas daría un
dibujo que miente sobre la curvatura, que es precisamente lo que distingue un
primer modo de un segundo. `modeShapePath.ts` los interpola con las **mismas
funciones de forma cúbicas del elemento de viga**, con el giro multiplicado por
la longitud, y la amplitud sale del tamaño del modelo y no de `deformedScale`
—un modo es adimensional—.

El límite de lo que el número significa viaja **con el número** y está desde
antes de calcular: un λcr elástico sin φ ni imperfecciones no es una
verificación. Misma disciplina que el índice elástico η.

### El certificado, con su límite pintado

La cabecera de `certificate.ts` avisa de que un modelo equivocado y bien resuelto
sale con las cuatro comprobaciones en verde. **Esa frase está ahora en la
tarjeta**, y antes de calcular, no sólo con el resultado delante: es exactamente
lo que alguien podría malinterpretar al ver cuatro visto buenos.

## Por qué

Porque una capacidad que no se puede pedir no es una capacidad, es una promesa.

## Dos defectos que encontraron sus propias redes

**El modo desaparecía justo cuando se iba a mirar.** `StabilityView` limpiaba
`modeShapeState` al desmontarse, y cerrar «Datos» —que es modal, y que es
exactamente lo que hace una persona para ver el dibujo— desmonta la vista. Lo
cazó el **QA de navegador**, no las pruebas de jsdom, porque sólo allí se cierra
la superficie de verdad. La limpieza se movió a `invalidateAnalysis`, junto a la
línea de influencia, que es donde pertenece.

**Volver a «tracción y compresión» no borraba nada.** `member.update` aplica los
cambios con un spread, donde una clave ausente significa «sin tocar», así que
hacer `delete` dejaba la restricción puesta para siempre. Lo destapó la prueba
del Inspector escrita para ese caso concreto.

Y un tercero, de mi propio proceso: el `git checkout` con el que restauré un
archivo tras probar un gate en rojo **revirtió el arreglo del modo**. Lo cazó la
prueba de jsdom que había escrito justo para eso, en la ejecución de `verify` del
cierre. Queda anotado porque el patrón —probar en rojo con `checkout` de por
medio— puede repetirlo cualquiera.

## Cómo verificar

```bash
npm run verify
npm run qa      # PLAYWRIGHT_CHANNEL=chromium PLAYWRIGHT_EXECUTABLE_PATH=... (este contenedor no tiene Chrome de canal)
npm run verify:space3d
npm run validate:ci
```

Leído de esta ejecución:

- `npm run verify` — **exit=0**. **250 archivos / 2573 pruebas** (8 omitidas),
  frente a las 2506 con las que empezó la tanda. «Frontera protegida intacta: 49
  archivos verificados». Carga inicial 766 520 bytes / 194 999 gzip (+5 498 /
  +1 359 gzip por las superficies nuevas).
- `npm run qa` — **exit=0**, **167 checks** (9 nuevos), ninguno en `false`, cero
  consola y cero errores de página. Medido en el pórtico de ejemplo: **λcr =
  2.56**, 3 modos, **3 trazas dibujadas** sobre el lienzo, 4 comprobaciones del
  certificado.
- `npm run verify:space3d` — **exit=0**.
- `node scripts/validate-ci.mjs` — **exit=0**.

### Gates reescritos a propósito

| Gate | Qué afirmaba | Qué afirma |
|---|---|---|
| `dataSurface.test.ts` | ocho lecturas, cuatro familias | diez y cinco, con la razón escrita en el propio test |
| `ResultsContent.test.tsx` | las flechas cruzan de Forma a Estudio | cruzan **atravesando** Pandeo y Modos, sin pararse en ninguna frontera |

### Gates nuevos, cada uno probado en rojo

| Se deshace | Qué falla |
|---|---|
| que la combinación tire también los modos | 1 prueba del hook |
| la firma en las dependencias del efecto | 1 |
| el enrutado por conjunto activo | 2 |
| el aviso de P-Delta | 1 |
| el `delete` en vez de `undefined` en el Inspector | 1 |
| la longitud en el término de giro de Hermite | 1 |
| muestrear sólo los dos extremos (unir nudo con nudo) | 5, incluida la del lienzo que mide la desviación respecto de la recta |
| descartar las incidencias del estudio | 1 |
| el párrafo del límite del certificado | 2 |
| que la materia opine sobre el veredicto | 1 |
| cortar la publicación del modo | `qa` aborta esperando `.mode-shape-layer` |
| quitar la familia `stability` | `qa` aborta esperando la pestaña «Pandeo» |

## Pendiente / siguiente paso

Lo que sigue sin superficie, por orden de valor:

1. **Constructor de secciones** en el Inspector, escribiendo con
   `sectionOrigin: 'custom'`.
2. **Versiones y diff** en Project Hub, con la comparación contra el estado
   actual.
3. **Guardar en disco y compartir**: botones que llamen a `saveBytes` y
   `buildShareLink`, y que la pantalla de inicio reclame el archivo del buzón de
   lanzamiento.
4. **Diálogo de la propuesta de IA**, que enseñe el diff y pida la confirmación.
5. **Partición del cuerpo de `StructuralCanvas.tsx`**: quedan ~2 350 líneas de
   extracción de hooks, con su propia pasada.

Dos cosas que este trabajo dejó nombradas y no resueltas: el certificado y los
estudios no entran en la memoria PDF, y **P-Delta con barras de signo
restringido** sigue sin componer — hoy avisa, y componerlos exige decidir qué
iteración manda y demostrar que converge.
