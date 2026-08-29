# Reporte de entrega: la memoria imprime cálculos reales, no fórmulas genéricas

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/pdfs-calculos-reales-5ebh2j`
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se pidió

El usuario pidió que los PDF dejen de mostrar fórmulas y letras. Quiere ver el cálculo real: la
fórmula ya sustituida con los números del proyecto, las multiplicaciones y las sumas que de verdad
se hicieron, tramo por tramo. Explícitamente: eliminar cualquier fórmula que sea sólo explicación.

## 2. Qué imprimía la memoria antes

Cada sección del documento declaraba su relación en símbolos y ahí se quedaba:

| Dónde | Qué se imprimía |
|---|---|
| Portada ejecutiva | `ΣF_x = 0`, `ΣF_y = 0`, `ΣM_O = 0`, `r = ‖residuo‖/‖acciones‖` |
| Páginas N, V, M | Tarjeta «Relación fundamental»: `dN/dx = -p(x)`, `dV/dx = q(x)`, `dM/dx = V(x)` |
| Página de procedimiento | «Ecuación clave» = `explanation[i].equations[0]`, la relación genérica del motor |
| Anexo, sección 5 | Las cinco a siete ecuaciones simbólicas de cada paso (`L = √(ΔX²+ΔY²)`, `dθ/dx = M/EI`, `k̄aa = Kaa − Kab Kbb⁻¹ Kba`…) |
| Sección 5 con método elegido | Bloques como `EI y″(x) = M(x)`, `w*(x) = M(x)/EI`, `Δ = Σ (nᵢNᵢLᵢ)/(AᵢEᵢ)`, la ecuación de Clapeyron en letras |

Todas ellas son ciertas de cualquier estructura y no dicen nada de ésta.

## 3. Qué imprime ahora

Un módulo nuevo, `src/utils/pdf/pdfSubstitution.ts`, construye la **misma** relación ya efectuada
con los números del proyecto, y las secciones consumen eso en lugar del símbolo. Ejemplos reales
sobre la práctica tipo Hibbeler (viga de 8 m, 5 kN/m repartida y 20 kN puntual a 3 m):

- Geometría: `ΔX = 8 − 0 = 8 m`, `L = √(8² + 0²) = 8 m`, `c = 8/8 = 1`.
- Cargas: la rotación a ejes locales, el intervalo `a = 0 · 8 = 0 m`, `b = 1 · 8 = 8 m` y la
  resultante `W = ½(q_a + q_b)(b − a)` con sus cuatro cifras.
- Rigidez: `EA/L = 2e+8 · 0.01 / 8 = 250000 kN/m`, y `12EI/L³`, `6EI/L²`, `4EI/L`, `2EI/L`
  desarrollados igual.
- Diagramas: `V(s) = 32.5 − 5 s → V(0) = 32.5, V(3) = 17.5 kN`, y donde el cortante cruza el cero,
  la estación como el cociente que la produce (`V = 0 → s = a₀/a₁ = … m → M = … kN·m`).
- Equilibrio: `ΣF_y = -60 + 32.5 + 27.5 = 0 kN` — la acción aplicada y cada reacción, sumadas.
- Páginas N, V, M: la tarjeta lleva la pendiente medida (`dV/ds = -5 kN/m`) y los tres pasos de
  «cómo se construye» reportan cifras (`Se parte de V(0) = 32.5 kN`, `Cierra en V(3 m) = 17.5 kN`).
- Tres Momentos: la ecuación de Clapeyron con las luces, rigideces, primeros momentos y momentos
  de apoyo de esta viga, una por apoyo interior.
- Trabajo virtual: la suma barra por barra, `(n)(N)(L)/((A)(E)) + … = Δ`.
- Kani: `ΣK` del nudo más cargado y cada `μ = −½ · Kᵢⱼ/ΣKᵢ` con su valor.
- Doble integración, viga conjugada y Castigliano: los bloques simbólicos desaparecen; las
  expresiones por tramo, que ya llevaban coeficientes reales, quedan como único desarrollo.

Un paso sin nada que sustituir **no imprime ecuación alguna**: volver al símbolo sería
exactamente lo que se quitó.

## 4. Las dos reglas que hacen fiable la sustitución

1. **La aritmética impresa cierra.** Los operandos de un mismo producto se convierten con un par
   fuerza–longitud coherente (`dimensionalValue`), nunca con los factores por magnitud: `E` en MPa
   junto a `A` en m² y `L` en m no da `EA/L` en ninguna unidad. En `kip-ft` la memoria escribe `E`
   en `kip/ft²` para que el lector pueda repetir la multiplicación en una calculadora.
2. **Nada se inventa.** Las sumas de equilibrio se reconstruyen aquí (resultante aplicada más cada
   reacción, momentos respecto del punto de reducción del propio motor) y se comparan contra la
   cifra que publicó el motor: si no coinciden dentro de `1e-8` de la carga, la expansión se
   descarta y sólo queda el valor de cierre. Lo mismo hace la ecuación de Clapeyron —se imprime
   sólo si los dos miembros cierran sobre los momentos ya resueltos— y la suma del trabajo virtual.
   El ruido numérico sigue colapsando a `0` contra la magnitud gobernante de su familia, como el
   resto del documento.

## 5. Frontera protegida

`src/engine/**`, `src/data/**` y `src/types.ts` quedan **byte a byte idénticos**: la sustitución
lee el modelo, el resultado y la traza educativa que el motor ya publica, y hace su aritmética en
la capa de dibujo. `npm run verify:protected` lo confirma (50 archivos verificados).

Las `equations` simbólicas del motor siguen existiendo y siguen alimentando la vista *Aprender* de
la interfaz; lo que cambió es que la memoria dejó de imprimirlas.

## 6. Verificación ejecutada

`npm run verify` completo, en verde: lint · documentación (10 documentos) · frontera protegida (50
archivos) · pruebas (308 ficheros, 2936 pasadas, 8 saltadas) · build · presupuesto de rendimiento ·
chunk de entrada.

Gate propio nuevo (`src/utils/pdf/pdfSubstitution.test.ts`, 7 pruebas). Mira las cadenas y no la
página, porque una ecuación mostrada se dibuja como geometría vectorial y no deja texto extraíble:

- La geometría sale con las coordenadas reales y ninguna ecuación conserva `Xⱼ`, `ΔX²` ni `(x)`.
- `EA/L` y `12EI/L³` se imprimen como el producto completo con sus tres operandos.
- El extremo del momento se localiza resolviendo `V = 0` con los coeficientes del tramo, y no se
  reclama estación alguna en un tramo que nunca cruza el cero.
- `ΣF_y = -60 + 32.5 + 27.5 = 0 kN`.
- Con una reacción falseada la expansión desaparece y queda `ΣF_y = 0 kN`: el documento no muestra
  una suma que sus propios números no satisfacen.
- La pendiente reportada es la medida (`dV/ds = -5 kN/m`), y ningún paso conserva `q(x)`, `p(x)`
  ni `V(x)`.
- En `kip-ft` el producto sigue siendo coherente y cierra en `kip/ft`.

`calculationPdf.test.ts` se actualizó donde afirmaba lo contrario de lo pedido: donde exigía
«RELACIÓN FUNDAMENTAL» y las explicaciones genéricas de cada magnitud, ahora exige la pendiente
real y los tres pasos con cifras; y la comprobación del puntero a «Cargas de miembro» pasa a
buscar en todo el documento, porque las sustituciones de cada carga lo empujan a la página
siguiente.

## 7. Lo que esta entrega no hace

- **No toca la vista *Aprender*** de la interfaz, que sigue mostrando las ecuaciones simbólicas del
  motor. El encargo era sobre los PDF.
- **No sustituye `K` ni `C` ensambladas** dentro del paso de rigidez: son sumas sobre todos los
  miembros y un sistema completo, y reconstruirlas en la capa de dibujo arriesgaría un número mal
  calculado en un documento que alguien firma. El anexo sigue apuntando a «6. Traza educativa y
  matrices», donde ya están con sus valores reales.
- **Limita el desarrollo a los tres primeros miembros o cargas** de cada paso, y a ocho términos en
  la suma del trabajo virtual: más allá, la página deja de leerse. El resto de las cifras sigue
  íntegro en las tablas del anexo y en el adjunto JSON.
- `npm run qa` sigue sin poder ejecutarse en este entorno (pide el canal `chrome`), así que no
  cuenta como verificación de esta fase.
