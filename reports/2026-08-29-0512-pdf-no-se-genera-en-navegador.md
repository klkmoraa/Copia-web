# Reporte de entrega: la memoria no se generaba en el navegador

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/pdfs-calculos-reales-5ebh2j`
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se reportó

«En el page no deja bajar el PDF y no sale la vista previa.»

## 2. Reproducción

Se levantó el `dist` construido con `vite preview` y se condujo Chromium hasta el diálogo de
exportación. El diálogo abría, pero en lugar de páginas mostraba **«No se pudo generar el
expediente»** y cero canvas. La consola no decía nada: el `catch` del diálogo se tragaba el
error entero.

Instrumentando ese `catch` apareció la causa:

```
ReferenceError: require is not defined
```

## 3. Causa raíz

`mathjax-full/js/components/version.js` resuelve su versión así:

```js
exports.VERSION = (typeof PACKAGE_VERSION === 'undefined'
  ? (function () { const load = eval('require'); const dirname = eval('__dirname'); … })()
  : PACKAGE_VERSION);
```

La rama de reserva se **evalúa al cargar el módulo**, y `mathjax.js` —que arrastra cualquier
otro módulo de MathJax— la importa. En un módulo ESM del navegador `require` no existe, así que
**importar MathJax lanzaba**, y con ello caía toda la composición del documento: sin bytes no
hay vista previa y no hay descarga.

Dos cosas explican que llegara a producción:

1. **Las 2 900 pruebas corren en Node**, donde `require` sí existe y el mismo código funciona.
   Ninguna prueba podía verlo.
2. **El error se perdía.** El diálogo distingue bien los dos fallos posibles —no poder componer
   y no poder dibujar— pero descartaba la causa en ambos, así que en producción sólo quedaba
   una frase genérica.

El build ya avisaba (`[EVAL] Use of direct eval function is strongly discouraged`, ocho veces),
pero era un aviso entre otros y nada fallaba por él.

## 4. La corrección

**`vite.config.ts` define `PACKAGE_VERSION`** con la versión que declara el `package.json` de
`mathjax-full`. Es lo que hacen los propios builds por componentes de MathJax: el ternario toma
el literal, la rama del `eval` queda inalcanzable y el minificador la borra. Los ocho avisos de
`eval` del build desaparecen con ella.

**El diálogo ya no se traga la causa.** Los dos `catch` registran el error real con
`console.error` y un mensaje que dice cuál de las dos etapas falló, sin cambiar lo que lee el
usuario.

## 5. El gate que faltaba

`scripts/check-browser-bundle.mjs` (nuevo, en `npm run verify` detrás de `verify:entry`) recorre
cada `.js` de `dist/` y falla si encuentra construcciones que sólo existen en Node —
`eval('require')`, `eval('__dirname')`. Es la clase de defecto que una prueba unitaria en Node no
puede ver y un gate sobre el artefacto construido sí.

Se comprobó en las dos direcciones, que es lo único que hace creíble a un gate nuevo:

- Con el `define` retirado y `dist/` reconstruido de cero, el gate **falla** y nombra el archivo
  (`assets/portableFile-*.js`).
- Con el `define` puesto, pasa: 83 archivos limpios.

Un detalle que casi lo deja inútil: el minificador reescribe `eval('require')` como
``eval(`require`)``. El primer patrón sólo aceptaba comilla simple y doble y daba por limpio
justo el artefacto que se publica; ahora acepta las tres comillas.

## 6. Verificación de extremo a extremo

Con el `dist` corregido, conducido en Chromium sobre el proyecto «Pórtico de ejemplo»:

- El diálogo abre sin error y rasteriza **22 canvas para 22 páginas**.
- «Descargar» emite el archivo: `portico-de-ejemplo-memoria-calculo.pdf`, 678 495 bytes.
- Ni un `pageerror` ni un `console.error` en toda la sesión.

`npm run verify` completo, en verde: lint · documentación · frontera protegida · pruebas (310
ficheros, 2960 pasadas) · build · presupuesto · chunk de entrada · **bundle del navegador**.

## 7. De paso

Las etiquetas del diálogo seguían describiendo el documento anterior («Anexo técnico», «Traza
educativa y matrices», «La página ejecutiva… van siempre»). Se actualizaron en español e inglés
al documento rediseñado: «Modelo, resultados y traza», «Matrices del sistema resuelto», «El
resumen del análisis y el adjunto reimportable van siempre».

## 8. Lo que este arreglo no hace

- **No toca `src/engine/**`** ni ninguna cifra: es configuración de build, diagnóstico y un gate.
- **No cambia la versión de `mathjax-full`.** El `eval` sigue en la dependencia; lo que se hace
  es dejar su rama inalcanzable, que es el contrato que la propia librería ofrece.
- `npm run qa` sigue sin poder ejecutarse tal cual en este entorno (pide el canal `chrome`); la
  reproducción se hizo con el Chromium empaquetado, apuntando `executablePath` a mano.
