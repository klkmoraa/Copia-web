# Upgrade integral: nueve subsistemas nuevos, del motor a la frontera de la IA

**Fecha:** 2026-08-23 22:19
**Agente:** Claude Code
**Rama:** claude/upgrade-integral-mejoras-lpa0pt

## Qué cambió

El rediseño visual quedó cerrado el 23 de agosto. Esta tanda deja de pulir lo
que ya se ve y añade **lo que el producto todavía no podía hacer**. Diez
commits, nueve subsistemas.

El usuario autorizó explícitamente tocar la frontera matemática protegida y las
dependencias, cosa que `AGENTS.md` prohíbe por defecto. La línea base se
refrescó con cada commit que tocó el motor, y cada commit explica qué archivo
protegido cambió y por qué. **No se añadió ninguna dependencia**: el eigensolver
es propio, `fflate` ya estaba y el validador de esquema se escribió a mano
porque el pre-RFC exige revalidar `additionalProperties:false` en local.

### El motor aprende tres cosas que no sabía

**Pandeo elástico lineal** (`buckling.ts`). Resuelve `(K + λ·Kg)·φ = 0` y
publica el factor crítico de carga y sus modos. Medio motor ya estaba escrito
—`geometricStiffness(L, N)` es la misma matriz que ensambla P-Delta—; faltaba el
resolvedor de autovalores, que `math.ts` no tenía.

La decisión que sostiene el resto: **no se resuelve en la forma en que se
escribe**. La iteración de subespacio habitual exige que la matriz de la derecha
sea definida positiva; en modal lo es, en pandeo **no** —`−Kg` es indefinida en
cuanto una barra está traccionada y otra comprimida, que es el caso normal de un
pórtico—. Con la factorización de Cholesky de `K` el problema pasa a ser
estándar y simétrico, donde una matriz indefinida no molesta a nadie, y el
autovalor pequeño de la izquierda es el grande de la derecha, que es hacia donde
converge sola la iteración.

Las restricciones cinemáticas se eliminan por espacio nulo, no por penalización:
un apoyo fijo **desaparece** del problema en vez de volverse muy rígido.

**Análisis modal** (`mass.ts`, `modal.ts`). Sale casi gratis porque el
resolvedor se escribió para el caso difícil. La masa no se pide aparte: sale de
`density × A`, los mismos dos campos del peso propio. Un modelo sin densidad no
tiene masa **y se dice**. Dos formulaciones —consistente y concentrada— porque
juntas acotan la solución por los dos lados, y eso está afirmado como contrato.

**Barras de sólo tracción y sólo compresión** (`activeSet.ts`). Cables,
tirantes, puntales. Una barra inactiva **se quita** del modelo, no se ablanda:
dejarla con rigidez muy pequeña mete un número arbitrario que contamina el
condicionamiento y produce fuerzas residuales en una barra que se supone
descolgada. Y la reactivación mira el **alargamiento**, no la fuerza, porque una
barra que no está en el modelo no tiene fuerza que mirar.

### Confianza, geometría, historia

**Certificado numérico** (`certificate.ts`). `reliability.ts` clasifica lo que
el propio solver midió al resolver; su límite es que lo reporta la misma
maquinaria que produjo el resultado, y un sistema mal montado se resuelve
estupendamente. Esto son cuatro preguntas que se contestan **volviendo a
resolver**: equilibrio global, linealidad, reciprocidad de Maxwell-Betti y
refinamiento h. Ninguna dice que el modelo sea correcto: dicen que la aritmética
se sostiene, y eso está escrito en la cabecera para que nadie lo lea como lo que
no es.

**Constructor de secciones** (`sectionBuilder.ts`). Un núcleo geométrico sobre
rectángulos con signo, no seis juegos de fórmulas: el cajón es el exterior menos
el interior, la U es la doble T con el alma en el borde, y `Zx` sale de una
bisección del eje que parte el área, igual para todas las formas.

**Diff estructural y versiones nombradas** (`projectDiff.ts`,
`projectVersions.ts`). El diff tiene tolerancia numérica **cero** por defecto:
un diff miente si esconde algo. Las versiones no estrenan almacén — una versión
nombrada es una recuperación con etiqueta, misma ruta de restauración ya
probada.

### La frontera de la IA, sin IA

**`src/ai/**`** implementa toda la mitad verificable del pre-RFC: esquema
cerrado v1, validador local, allowlist, unidades, compilación sobre un clon,
diff semántico y confirmación ligada a `proposalId + snapshotHash`. **Cero red**,
y hay un gate que recorre el directorio y falla si aparece `fetch`,
`XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon` o una URL.

Un proveedor devuelve `unknown` a propósito: tiparlo como `CommandProposalV1`
afirmaría en el sistema de tipos algo que sólo se puede comprobar en ejecución,
y TypeScript se borra al compilar.

### Arranque, archivos y fondo

**El catálogo inglés sale de la carga inicial.** `catalogs.ts` eran 4122 líneas
con los dos idiomas dentro, y como `useI18n` lo importa, ambos viajaban en
`index-*.js`. La carga inicial baja de **869 603 / 223 061 gzip** a
**761 022 / 193 640 gzip**.

**Archivos de verdad**: File System Access con reserva intacta a descarga,
`file_handlers` para `.structureco` con la cola de lanzamiento atendida antes de
montar React, y compartir el modelo comprimido en el **fragmento** de la URL —no
en la query, porque lo que va detrás de `#` no se envía al servidor ni aparece
en sus registros.

**Del lienzo salen 98 líneas**: los tipos de interacción, las constantes de
identidad estable y los mapas de etiquetas, que es todo lo que no cierra sobre
el estado del componente.

## Por qué

Porque el producto llevaba tiempo creciendo en superficie y no en capacidad. Un
usuario podía saber cuánto se deforma su estructura, no a qué carga deja de
sostenerse; podía guardar un proyecto, no compararlo con el de ayer; y el
repositorio tenía escrito desde agosto un contrato de seguridad para la IA que
nadie había implementado ni siquiera en la parte que no necesita una IA.

## Cómo verificar

```bash
npm run verify          # lint · docs · frontera protegida · pruebas · build · presupuesto · chunk
npm run qa              # checks compuestos con Chromium real
npm run verify:space3d
npm run validate:ci
```

Leído de esta ejecución, no supuesto:

- `npm run verify` — **exit=0**. **245 archivos / 2506 pruebas** (8 omitidas),
  frente a las 2283 con las que empezó la tanda. «Frontera protegida intacta: 47
  archivos verificados», **sin** `--update` en la comprobación final. Carga
  inicial 761 022 bytes / 193 640 gzip.
- `npm run qa` — **exit=0**, **158 checks**, ninguno en `false`, cero mensajes de
  consola y cero errores de página.
- `npm run verify:space3d` — **exit=0**. «Capacidad Space 3D aprobada: 150 nudos
  / 300 barras».
- `node scripts/validate-ci.mjs` — **exit=0**, 3 workflows sin problemas.

**Nota de entorno:** este contenedor no tiene Chrome de canal, que es lo que
`qa.mjs` pide por defecto. Se ejecutó con el Chromium de Playwright mediante
`PLAYWRIGHT_CHANNEL` y `PLAYWRIGHT_EXECUTABLE_PATH`, que el propio script ya
admite. Es una diferencia de entorno, no del producto.

### Gates nuevos, cada uno probado en rojo

| Gate | Se deshace | Qué falla |
|---|---|---|
| `check-entry-chunk.mjs` | un `import` estático de `catalogEn` | señala `index-*.js` por su nombre |
| Columnas de Euler | el signo de `Kg` | los cuatro casos, la convergencia y los modos: 8 pruebas |
| Columnas de Euler | el promediado del estado axial | 6 pruebas |
| Frecuencias propias | la conversión kg → Mg | 6 de 16 |
| Masa participante | la normalización de la masa modal | 1 |
| Conjunto activo | el criterio de signo admisible | 4 |
| Conjunto activo | quitar de verdad la barra descolgada | 2 |
| Certificado | asimetría del 0.01 % en un término de rigidez | el certificado entero |
| Constructor de secciones | `/12` → `/8` en la inercia propia | 53 |
| Constructor de secciones | el término de Steiner | 40 |
| Constructor de secciones | el eje plástico en tercios | 50 |

## Pendiente / siguiente paso

**Lo importante de este reporte.** Los nueve subsistemas están en el motor y en
`data`, con sus gates. **Casi ninguno tiene todavía superficie de usuario.** Es
decir: el pandeo se calcula y se prueba, pero no hay un botón que lo pida ni una
tarjeta que lo enseñe.

Lo que falta, por orden de valor:

1. **Resultados de pandeo y modal**: pedir el análisis desde la paleta o la
   Cinta, listar los modos y dibujar la forma sobre el lienzo reutilizando la
   ruta de la deformada. Incluye llevar `kind` a `AnalysisWorkerRequest` para
   que no bloqueen el hilo principal.
2. **Certificado numérico**: tarjeta junto a `NumericQualityCard` y entrada en
   la memoria PDF.
3. **Constructor de secciones**: formulario en el Inspector escribiendo con
   `sectionOrigin: 'custom'`.
4. **Versiones y diff**: lista en Project Hub y comparación con el estado actual.
5. **Guardar/compartir**: botones que llamen a `saveBytes` y `buildShareLink`, y
   que la pantalla de inicio reclame el archivo del buzón de lanzamiento.
6. **Propuesta de IA**: diálogo que enseñe el diff y pida la confirmación.
7. **Cables**: exponer `axialBehavior` en el Inspector y el datasheet, y llamar
   a `analyzeProjectWithActiveSet` desde `ProjectContext`.
8. **Partición del lienzo**: quedan ~2350 líneas de cuerpo de componente. Es
   extracción de hooks, y necesita su propia pasada con los gates del lienzo
   entre extracción y extracción.

Nada de esto está bloqueado: son superficies sobre contratos que ya existen y
ya están probados.
