# Limitaciones conocidas

structureCo es un analizador educativo 2D lineal. Antes de usar un resultado en
una decisión real:

1. Comprueba unidades, geometría, apoyos, ejes locales, liberaciones y signos.
2. Revisa equilibrio global, cierre por miembro, compatibilidad y residuos.
3. Repite los casos críticos mediante cálculo manual o una herramienta
   independiente.
4. Confirma que la teoría de viga y las propiedades representan el elemento real.
5. Atiende las advertencias de mecanismo, hiperestaticidad, condicionamiento y
   violación de pequeñas deformaciones.

## Alcance físico

El motor resuelve análisis estático lineal-elástico, de primer orden y pequeñas
deformaciones. No están implementados:

- P–Delta, pandeo, grandes desplazamientos o no linealidad geométrica;
- plasticidad, rótulas plásticas, daño o no linealidad del material;
- cables, elementos solo a tensión/compresión, contacto o apoyos unilaterales;
- análisis dinámico, modal, espectral, historia de tiempo o generación sísmica;
- trenes móviles con cargas distribuidas o carga viva interior/exterior;
- envolventes móviles calculadas automáticamente para todos los cortes;
- placas, cascarones, sólidos, panel zones deformables o diseño normativo.

Por tanto, una matriz estable en primer orden no demuestra estabilidad frente a
pandeo ni capacidad última.

Como filtro de coherencia, la aplicación advierte cuando el desplazamiento
relativo entre extremos de algún miembro supera `0.05 L`, cuando la deformada
interior se separa de la cuerda más de `0.05 L`, o cuando un giro nodal o interior
supera `0.1 rad`. Incluir los máximos interiores evita aprobar, por ejemplo, una
viga empotrada en ambos extremos cuyos nodos permanecen inmóviles pero cuya flecha
central es enorme. La advertencia no corrige la solución ni sustituye un análisis
P-Delta o geométricamente no lineal; obliga a revisar primero propiedades y
unidades.

## Modo Aula y propiedades automáticas

El modo **Aula · diagramas** permite trabajar solo con nodos, miembros, apoyos,
liberaciones y cargas. No elimina las propiedades del modelo: oculta los campos y
usa los valores automáticos existentes.

- En estructuras isostáticas, reacciones y esfuerzos `N`, `V`, `M` se obtienen
  por equilibrio y no dependen de `E`, `A` o `I`.
- En estructuras hiperestáticas, el reparto de fuerzas sí depende de las
  rigideces asumidas. La aplicación muestra una advertencia, pero no puede deducir
  el material o la sección real a partir de la geometría.
- Las deformaciones físicas no se presentan como resultado principal del modo
  Aula porque requieren propiedades representativas.

El modo Aula es apropiado para ejercicios de equilibrio y diagramas; no convierte
un modelo incompleto en un proyecto de diseño.

## Topología geométrica

La interfaz reutiliza nodos coincidentes compatibles y divide automáticamente un
miembro deformable cuando se crea o desplaza sobre él un nodo activo o un apoyo.
La misma normalización se ejecuta antes del análisis para reparar proyectos
antiguos como el de un apoyo dibujado sobre una viga pero no conectado a ella. La
operación conserva las cargas y puede deshacerse desde el historial.

No se fusionan automáticamente nodos con apoyos incompatibles ni conexiones
ambiguas. Los cruces geométricos entre miembros siguen desconectados si no existe
un nodo en la intersección, y una zona rígida no se divide implícitamente. Estos
casos se reportan como errores de topología para evitar cambiar silenciosamente
la intención estructural del usuario.

## Teorías de viga, conexiones y efectos iniciales

- Euler–Bernoulli desprecia deformación por cortante. Timoshenko la incluye con
  `G·As`; el usuario debe proporcionar un `As` efectivo coherente con la sección y
  su factor de corrección.
- Los miembros son prismáticos: `E`, `G`, `A`, `As` e `I` son constantes por
  elemento. Un cambio de sección requiere dividir el miembro.
- Las conexiones semirrígidas son resortes rotacionales concentrados en los
  extremos. No representan por sí mismas placas, pernos, deslizamiento, panel
  zones ni una ley momento–rotación no lineal.
- Las zonas rígidas son offsets colineales. No modelan excentricidades arbitrarias
  fuera del eje ni deformación propia de la zona.
- Una barra de armadura es un elemento de dos fuerzas. Si su peso propio tiene
  componente transversal, el motor lo rechaza en lugar de descartarlo en silencio;
  debe discretizarse en paneles y aplicarse como cargas nodales equivalentes.
- Temperatura, gradiente térmico, deformación axial inicial y curvatura inicial
  se superponen linealmente. No existe conducción térmica, dependencia de
  propiedades con la temperatura, fluencia, retracción ni presfuerzo por tendón.
- Los asentamientos solo pueden imponerse en grados restringidos compatibles con
  el apoyo. No modelan la rigidez del suelo salvo que el usuario agregue resortes.

## Diagramas, deformadas y envolventes

Los diagramas `N`, `V` y `M` son polinomios exactos por tramo para el elemento y
las cargas admitidas: cargas distribuidas constantes o lineales, fuerzas
puntuales y momentos puntuales. “Exacto” no significa exactitud física universal.

Las deformadas `u`, `v` y `θ` se integran analíticamente por tramo, incluidos los
términos de deformación inicial y, en Timoshenko, de cortante. Su dibujo se adapta
para visualización, mientras los valores y puntos críticos proceden de los
polinomios. Una escala amplificada no representa geometría deformada de grandes
desplazamientos.

Las envolventes comparan los casos y combinaciones lineales definidos. No
generan automáticamente combinaciones normativas ni una trayectoria de carga
móvil; sus factores, signos y escenarios siguen siendo responsabilidad del
usuario. El módulo de influencia es independiente: elimina las cargas estáticas,
desplaza una carga vertical unitaria sobre una cadena abierta de miembros frame
y obtiene `N`, `V` o `M` en un corte. El tren móvil admite por ahora únicamente
ejes concentrados positivos y un factor de impacto estático.

Una envolvente solo admite escenarios clasificados `reliable` o `limited`. Los
escenarios fallidos o poco confiables se conservan en la lista con su causa, pero
no aportan valores, y la envolvente queda marcada `complete: false`. Una
envolvente incompleta sigue siendo válida para los escenarios que contiene: no
representa el conjunto solicitado y no debe leerse como si lo hiciera.

Una línea de influencia que no alcanza su tolerancia de ajuste tras el límite de
subdivisión se rechaza y no se entrega: en ese caso no hay línea degradada que
consultar, solo el diagnóstico del rechazo.

## Precisión y tamaño de modelo

El ensamblaje utiliza matrices densas. La resolución del sistema aumentado emplea
una factorización dispersa cuando las restricciones del modelo lo permiten —apoyos
alineados a los ejes— y vuelve a la factorización densa en el resto de los casos
(vínculos rígidos, apoyos deslizantes inclinados) y siempre que el bloque reducido
deje de ser definido positivo. El análisis principal y la comparación de escenarios
se ejecutan en Web Workers para no bloquear la interfaz.

La vía dispersa acelera la factorización del sistema lineal, no el análisis completo:
medido sobre una viga continua de 300 vanos (980 incógnitas), la factorización baja de
180 ms a 36 ms y la resolución completa de 303 ms a 143 ms, sobre un análisis total de
unos 2,9 s. El resto del coste está fuera del solucionador lineal. El consumo de memoria
del ensamblaje sigue creciendo con el cuadrado del número de grados de libertad, por lo
que no se promete escalabilidad para modelos grandes.

Geometrías extremadamente pequeñas, rigideces separadas por muchos órdenes de
magnitud, resortes casi rígidos o sistemas próximos a un mecanismo pueden degradar
la precisión. El equilibrado, refinamiento iterativo, residuo, condición estimada
y cota de error ayudan a detectar el problema, pero no vuelven confiable un modelo
mal condicionado.

Que un análisis termine con `success = true` no implica que sus cifras puedan
usarse. Cada resultado publica `reliability` con tres respuestas separadas —cálculo
terminado, resultado utilizable y nivel de confianza— derivadas de diez
comprobaciones numéricas independientes descritas en `MATHEMATICAL_SPEC.md` §11.2.
Los umbrales son diagnósticos numéricos: acotan el error aritmético de la solución,
no la validez física del modelo, y un nivel `reliable` nunca certifica que la
idealización estructural sea correcta.

Las filas redundantes y compatibles de apoyos y vínculos rígidos se reducen antes
de resolver, y una estructura estabilizada exclusivamente por resortes positivos
es válida. Las restricciones redundantes con valores prescritos contradictorios
siguen siendo un error deliberado.

## Persistencia, idioma y plataforma

El guardado es local al navegador. Se mantiene respaldo y recuperación, pero
limpiar datos del sitio o usar almacenamiento privado puede eliminar proyectos;
exporta JSON para una copia independiente.

La interfaz principal existe en español e inglés, aunque nombres introducidos por
el usuario y parte del contenido técnico no se traducen automáticamente. La QA
automatizada se concentra en Chromium; Safari/iOS, Firefox y dispositivos táctiles
reales requieren validación adicional antes de un uso de misión crítica.

Las plantillas de combinaciones son editables y deben comprobarse contra la norma
vigente. La aplicación combina efectos calculados; no certifica que una
combinación sea reglamentaria ni sustituye la revisión profesional.
