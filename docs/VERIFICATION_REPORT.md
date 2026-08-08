# structureCo — Informe de verificación

**Fecha:** 2026-07-14  
**Motor:** análisis estructural 2D lineal — versión 0.7.0  
**Comandos reproducibles:** `npm run verify` y `npm run qa`

## Criterio de cierre

El cierre 0.7.0 obtuvo:

- lint y build Vite aprobados;
- 227 de 227 pruebas aprobadas en 39 archivos;
- QA Chromium de escritorio y móvil aprobada;
- consola y `pageErrors` vacíos durante la QA.

Los comandos de cabecera permiten reproducir el resultado; si se añaden pruebas,
su salida pasa a ser la fuente vigente del conteo.

## Benchmarks estructurales

| Caso | Comprobación |
|---|---|
| Viga simple con carga puntual central | `RA=RB=P/2`, `Mmax=PL/4`, momentos liberados nulos |
| Viga simple con carga uniforme | `RA=RB=wL/2`, `Mmax=wL²/8` |
| Voladizo con carga puntual | `V=P`, `M=PL`, `δ=PL³/(3EI)`, `θ=PL²/(2EI)` |
| Voladizo con carga uniforme | `V=wL`, `M=wL²/2`, `δ=wL⁴/(8EI)`, `θ=wL³/(6EI)` |
| Viga empotrada–empotrada con UDL | `Mextremo=−wL²/12`, `Mcentro=+wL²/24` |
| Carga triangular o parcial | resultante, centroide, reacciones y máximo analítico |
| Momento concentrado | salto exacto de `M(x)` y reacciones opuestas |
| Miembro inclinado | transformación global/local y conservación de resultante |
| Armadura triangular | fuerzas conocidas y clasificación tensión/compresión |
| Resorte axial | compatibilidad y reparto barra–resorte |
| Liberación de momento | fuerza del grado liberado numéricamente nula |
| Vínculo rígido | compatibilidad exacta y transferencia de momento |
| Superposición | combinación igual a suma factorizada de casos completos |
| Articulación interna | equivalencia con liberaciones explícitas y equilibrio |
| Zona rígida colineal | compatibilidad de caras, longitud flexible y respuesta analítica |
| División de miembro | invariancia de reacciones/diagramas y remapeo de cargas |

Los casos históricos se mantienen como regresiones contra soluciones analíticas
y relaciones de equilibrio. La validez del motor no depende de afirmar
equivalencia con otro producto.

## Cobertura avanzada de 0.7.0

| Caso | Comprobación |
|---|---|
| Asentamiento axial prescrito | desplazamiento impuesto, reacción analítica y residuo `CU−g` |
| Traslación rígida común | asentamientos compatibles con fuerza axial nula |
| Expansión térmica libre | alargamiento `αΔT·L` sin reacción |
| Expansión térmica restringida | fuerza `EAαΔT` con signos consistentes |
| Curvatura inicial libre | rotación y forma compatibles sin carga mecánica |
| Voladizo Timoshenko | flecha de flexión más término `PL/(GAs)` |
| Conexión semirrígida | flexibilidad de la viga más flexibilidad `1/kθ` |
| Deformada de viga simple con UDL | máximo interior y compatibilidad de extremos |
| Envolvente de escenarios | contención, factores negativos e intersección gobernante interior |
| Trazabilidad educativa | matrices y vectores coinciden con el análisis real |
| Línea de influencia de viga simple | `ψM(L/2)=L/4`, salto unitario de `ψV` y cargas estáticas excluidas |
| Tren de ejes concentrados | superposición con impacto y extremos por raíces, sin malla de posiciones |
| Energía de deformación | integración de `N²/2EA`, `M²/2EI`, `V²/2GAs` y resortes |
| Casos límite de resortes | `kθ=0`, resorte nodal `kr` y cifras confiables acotadas a IEEE-754 |

## Solución numérica

- Ensamblaje del sistema aumentado `[K Cᵀ; C 0][U;λ]=[F;g]`.
- Equilibrado diagonal simétrico.
- Factorización LU con pivoteo parcial escalado.
- Refinamiento iterativo y residuo lineal relativo.
- Estimación de condición `κ₁` mediante iteraciones de Hager.
- Cota aproximada de error hacia delante y estimación de dígitos confiables.
- Condensación sin formar explícitamente `Kbb⁻¹` para liberaciones y conexiones.
- Recuperación de rango, nulidad y vector del espacio nulo para mecanismos.
- Residuo físico de equilibrio y residuo independiente de compatibilidad `CU−g`.

La matriz local de marco, la transformación y la conservación de energía se
contrastan además con formulaciones académicas publicadas:

- Purdue CE474, *Frame Element Stiffness Matrix Derivation*: https://engineering.purdue.edu/~ce474/Docs/FRAME%20ELEMENT%20STIFFNESS%20MATRIX%20DERIVATION%20_FULL_.pdf
- Duke CEE421L, *The Matrix Stiffness Method for 2D Frames*: https://people.duke.edu/~hpgavin/cee421/frame-method.pdf

## Diagramas, deformadas y envolventes

Las pruebas comprueban:

- `dN/dx=−px`, `dV/dx=py` y `dM/dx=V` coeficiente por coeficiente;
- continuidad y saltos izquierdo/derecho de fuerzas y momentos;
- raíces y extremos interiores de los polinomios;
- conversión exacta de polinomio cúbico a Bézier cúbico;
- integración por tramo de `u(x)`, `v(x)` y `θ(x)`;
- cierre de compatibilidad contra los desplazamientos nodales;
- intersecciones de escenarios y conservación del caso o combinación gobernante
  en las envolventes mínima y máxima de `N`, `V` y `M`.

El corte educativo usa el mismo modelo local de cargas que el ensamblaje e
informa los residuos de `ΣFx`, `ΣFy` y `ΣM`.

## Restricciones, efectos iniciales y conexiones

- Los asentamientos por caso se superponen con los factores de la combinación y
  se rechazan en grados incompatibles con el apoyo.
- Temperatura uniforme, gradiente térmico, deformación axial inicial y curvatura
  se convierten en acciones nodales equivalentes antes de condensar conexiones.
- La formulación Timoshenko recupera Euler–Bernoulli cuando `GAs` tiende a
  infinito y reproduce el término analítico de deformación por cortante.
- Las conexiones semirrígidas se comprueban contra la flexibilidad cerrada del
  resorte rotacional y sus límites rígido y liberado.

## Explorador educativo y modo Aula

El explorador consume la traza emitida por el mismo solucionador; React no
recalcula matrices. Se verifica la correspondencia de grados de libertad,
transformación, rigidez local/condensada/global, cargas, desplazamientos y
esfuerzos de extremo.

El modo Aula oculta propiedades avanzadas sin usar un motor paralelo. La QA debe
confirmar que:

- permite modelar con geometría, miembros, apoyos, liberaciones y cargas;
- presenta reacciones y diagramas `N–V–M`;
- no solicita material, temperatura ni efectos iniciales;
- advierte que un modelo hiperestático depende de las rigideces automáticas;
- permite regresar al modo Completo sin perder el modelo.

## Persistencia, validación y unidades

La suite incluye migración al esquema `v5`, rechazo de payloads inválidos,
respaldo/recuperación y propagación de asentamientos y efectos iniciales al copiar,
pegar, dividir o eliminar objetos.

Se verifican conversiones de ida y vuelta para longitud, fuerza, momento, carga
lineal, módulo elástico, área, inercia, resortes y densidad en kN–m, N–mm, kgf–m
y kip–ft.

La validación cubre referencias inexistentes, nodos casi coincidentes, longitud
cero, propiedades no finitas, cargas intermedias incompatibles con armaduras,
proyecciones nulas, desplazamientos prescritos incompatibles y estructuras sin
restricciones suficientes.

## QA de interfaz 0.7.0

El recorrido de interfaz incluye:

- entrada desde bienvenida, modelado, selección y análisis;
- diagramas, corte interactivo, envolventes y deformada `u/v/θ`;
- selector Aula/Completo en escritorio y móvil;
- explorador del método de rigidez con etapas Modelo, GDL, Elemento, Ensamblaje y
  Verificación;
- pan con botón central o Espacio, toque con un dedo y pellizco con dos dedos;
- unidades, tema, idioma, inspector y menú móvil;
- mecanismo visible, nodos dominantes y diagnóstico de nulidad;
- viewport de escritorio y `430 × 932` sin desbordamiento horizontal;
- ausencia de overlays del framework y errores o advertencias de consola.
- flujo Aula desde plantilla, análisis oculto, predicción y revelado;
- resumen global, localización de extremos y comparación de escenarios;
- selección CAD ventana/cruce, filtros y entrada rápida por coordenadas;
- análisis principal y escenarios ejecutados en Web Workers.
- línea de influencia `N–V–M`, cursor vinculado al lienzo y tren móvil ejecutados
  en Web Worker con fallback local;

## Lo que este informe no demuestra

- No certifica uso profesional ni sustituye una validación independiente.
- No cubre P–Delta, grandes desplazamientos, plasticidad, cables o elementos solo
  a tensión, dinámica, sismo, trenes móviles con carga distribuida ni diseño
  normativo.
- No demuestra escalabilidad dispersa: el solucionador actual es denso, aunque se
  ejecuta en Web Worker para preservar la respuesta de la interfaz.
- No garantiza modelos arbitrariamente mal condicionados.

Cada nueva formulación debe incorporar antes un benchmark cerrado o una
comparación independiente reproducible.
