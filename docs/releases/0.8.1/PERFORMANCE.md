# Rendimiento de structureCo 0.8.1 — medición y presupuestos

Todas las cifras de este documento se **midieron**, no se estimaron. Reproducción:

```bash
npm run build && node scripts/measure-performance.mjs
```

```bash
npx vitest run src/engine/performance.test.ts
```

Máquina de medición: Windows 11, Node 24.18.0. Las cifras absolutas dependen del equipo;
lo que debe conservarse entre máquinas son las **relaciones** y el orden de magnitud.

## 1. Composición del bundle

Build de producción real (`dist/`):

| Recurso | Bytes | gzip | Carga |
|---|---:|---:|---|
| `pdf.worker-*.mjs` | 2 366 081 | 500 805 | diferida |
| `pdf-*.js` (PDF.js) | 479 842 | 143 495 | diferida |
| `es-*.js` (pdf-lib + pako) | 428 290 | 177 541 | diferida |
| `WorkspaceShell-*.js` | 255 385 | 67 240 | diferida |
| `index-*.js` | 218 437 | 68 480 | **inicial** |
| `index-*.css` | 177 759 | 31 258 | **inicial** |
| `useI18n-*.js` | 125 925 | 37 724 | **inicial** |
| `influence.worker-*.js` | 90 909 | 29 437 | diferida |
| `scenarios.worker-*.js` | 81 760 | 26 393 | diferida |
| `solver-*.js` | 81 674 | 26 381 | diferida |
| `analysis.worker-*.js` | 81 588 | 26 295 | diferida |

- **Carga inicial declarada:** 556 000 bytes, 148 531 gzip.
- **Total en `dist/`:** 4 594 947 bytes.

El chunk `es-*.js` **no es un catálogo de idioma** pese al nombre: contiene `pdf-lib` y
`pako`, y el hash del empaquetador coincidió con ese prefijo. Se verificó inspeccionando su
contenido.

### Carga real observada en el navegador

Servido desde el build de producción (`vite preview`, http://localhost:4173):

| Medida | Valor |
|---|---:|
| Recursos JS/CSS descargados al inicio | 11 |
| Transferido al inicio | 245 kB |
| `DOMContentLoaded` | 144 ms |
| `load` | 146 ms |
| Heap tras la carga | 4 MB |

Ni PDF.js, ni pdf-lib, ni `pdf.worker`, ni los workers de influencia y escenarios se
descargan al arrancar. La carga diferida **funciona y está comprobada**, no supuesta.

## 2. Rendimiento del solver

Viga continua con carga distribuida en todos los vanos, un apoyo cada cuatro nodos.
Segunda ejecución de cada tamaño, para no medir el calentamiento del JIT.

| Vanos | Miembros | GDL | Tiempo | Factor respecto al anterior |
|---:|---:|---:|---:|---|
| 10 | 10 | 33 | 25,9 ms | — |
| 25 | 25 | 78 | 41,3 ms | 1,6× para 2,5× de tamaño |
| 50 | 50 | 153 | 91,8 ms | 2,2× para 2,0× |
| 100 | 100 | 303 | 261,3 ms | 2,8× para 2,0× |
| 200 | 200 | 603 | 786,1 ms | 3,0× para 2,0× |
| 300 | 300 | 903 | 2 379,3 ms | 3,0× para 1,5× |
| 500 | 500 | 1 503 | 8 245,0 ms | 3,5× para 1,67× |

### Lectura honesta de la curva

Duplicar el tamaño multiplica el tiempo por ~2,8–3,0 en el rango medio, y el crecimiento se
acelera por encima de 300 miembros. El exponente empírico pasa de ≈1,5 en modelos pequeños a
≈2,45 entre 300 y 500 vanos.

Es coherente con una factorización densa. **No se promete escalabilidad más allá de lo medido.**

### Vía dispersa (0.8.2)

Medido sobre la viga continua de 300 vanos (980 incógnitas en el sistema aumentado), en la
misma máquina y con la misma metodología:

| Etapa | Densa | Dispersa |
|---|---:|---:|
| Factorización | 180 ms | 36 ms |
| `solveLinearSystem` completo | 303 ms | 143 ms |
| Análisis completo (`analyzeProject`) | ~3 060 ms | ~2 900 ms |

La factorización es unas 5 veces más rápida y la resolución completa algo más del doble.
El análisis completo apenas cambia: **el sistema lineal era el 10 % del tiempo y ahora es
el 4,5 %**. El coste dominante a este tamaño está fuera del solucionador lineal, de modo que
acelerarlo más no acelera la aplicación. Identificar ese coste es trabajo aparte y no se
ha medido aquí.

La estimación de condición coincide con la de la vía densa hasta la decimotercera cifra
(1 293 831,434578906 frente a 1 293 831,434578983), por lo que la clasificación de
confiabilidad no cambia de vía a vía.

## 3. Presupuestos declarados

Los presupuestos están comprobados en `src/engine/performance.test.ts` y son deliberadamente
holgados —unas 10 veces la medición— porque existen para detectar un cambio de clase de
complejidad, no para vigilar milisegundos.

| Presupuesto | Medido | Límite | Estado |
|---|---:|---:|---|
| Análisis de 10 miembros | 26 ms | 500 ms | ✅ |
| Análisis de 100 miembros | 261 ms | 3 000 ms | ✅ |
| Análisis de 300 miembros | 2 379 ms | 20 000 ms | ✅ |
| Factor de 100 → 200 miembros | 3,0× | < 8× | ✅ |
| Envolvente de 2 escenarios, 100 miembros | 459 ms | 2 000 ms | ✅ |
| Muestras de diagrama por miembro | < 200 | < 200 | ✅ |
| Carga inicial (gzip) | 148,5 kB | 250 kB | ✅ |
| `DOMContentLoaded` en build de producción | 144 ms | 1 000 ms | ✅ |
| Tarea larga más larga observada | 123 ms | 400 ms | ✅ |

## 4. Capacidad recomendada

Con base en lo medido, y **sin extrapolar**:

| Tamaño de modelo | Comportamiento |
|---|---|
| Hasta 100 miembros | interactivo; el análisis se percibe inmediato |
| 100 – 300 miembros | usable; el análisis tarda entre 0,3 y 2,4 s |
| 300 – 500 miembros | aceptable pero perceptible; hasta 8 s |
| Más de 500 miembros | **no medido y no soportado en 0.8.1** |

## 5. Límites de importación y exportación

Definidos en `src/utils/fileGuards.ts` y comprobados en `fileGuards.test.ts` y
`portableSecurity.test.ts`:

| Recurso | Límite |
|---|---:|
| PDF | 25 MB |
| `.structureco` | 40 MB |
| JSON | 20 MB |
| Entradas por paquete | 32 |
| Descomprimido por entrada | 64 MB |
| Descomprimido total | 128 MB |
| Relación de compresión | 120:1 |
| Páginas de PDF inspeccionadas | 120 |
| Píxeles de rasterización PNG | 64 000 000 |

## 6. Riesgos y limitaciones conocidas

- **`unzipSync` es síncrono.** Un `.structureco` legítimo cercano al límite de 40 MB bloquea
  el hilo principal durante la descompresión. Los presupuestos de S09 acotan el daño, pero la
  descompresión sigue sin estar en un worker. Registrado, no corregido en 0.8.1.
- **Ambos catálogos de idioma se cargan al inicio** (`useI18n-*.js`, 37,7 kB gzip). Cargar sólo
  el idioma activo ahorraría alrededor de la mitad, pero cambia el comportamiento de `useI18n`
  y de las pruebas de paridad ES/EN. No se hizo en este slice.
- **`index-*.css` pesa 178 kB** (31 kB gzip) y proviene en su mayoría de `src/styles.css`, de
  181 kB. Depurarlo pertenece al trabajo de sistema de diseño, no a rendimiento.
- **La suite de pruebas tarda ~55 s.** Antes de S01 no terminaba en 15 minutos porque
  recolectaba las copias de respaldo; ahora mide sólo el producto.
- **No se midió en hardware móvil real.** Todas las cifras proceden de escritorio. No se
  declara ningún resultado de dispositivo físico.
- **No se midió tiempo de exportación de PDF en el navegador.** El generador está cubierto por
  pruebas de corrección, no de tiempo.
