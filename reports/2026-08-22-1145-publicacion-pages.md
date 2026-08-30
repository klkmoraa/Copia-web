# Publicación del rediseño en GitHub Pages

**Fecha:** 2026-08-22 11:45
**Agente:** Claude Code
**Rama:** `main` (fast-forward desde `claude/apple-style-redesign-6ebf0r`)

## Qué cambió

`main` avanza de `799b712` a `2bbe011` con los dos commits del rediseño de la
fase 2, lo que dispara `pages.yml` y republica el sitio. Además:

- **El brandbook se publica.** `brand/brandbook.html` pasa a ser un segundo punto
  de entrada del build (`rollupOptions.input` en `vite.config.ts`), así que sale
  en `dist/brand/brandbook.html` y es alcanzable desde el sitio.
- **La URL está documentada.** `README.md` gana una sección «Sitio publicado» y
  `brand/README.md` enlaza el brandbook publicado.

## Por qué

### Corrección al reporte anterior

`reports/2026-08-22-0715-rediseno-identidad-sistema.md` dejaba dos pendientes
descritos como acciones que sólo podía hacer el propietario del repositorio:
cambiar la fuente de Pages a «GitHub Actions» y llevar `pages.yml` a `main`.

**Los dos ya estaban hechos cuando se escribió**, y el reporte se quedó
desactualizado en el mismo commit que lo introdujo:

- `pages.yml` entró en `main` con `c851409`.
- La ejecución `32559044193` del workflow **GitHub Pages** terminó en verde a las
  07:14 UTC sobre `main@799b712`, incluido su job `Publicar`
  (`actions/deploy-pages@v4`). Ese paso no puede pasar si la fuente de Pages no es
  «GitHub Actions», así que la configuración estaba resuelta.

El bloqueo real no era ninguna de las dos cosas: era que `main` no había avanzado.
El workflow dispara con `on: push: branches: [main]`, y el sitio seguía sirviendo
la fase 1. Queda anotado aquí porque una lista de pendientes falsa le cuesta más
tiempo al otro agente que no tener ninguna.

### Por qué el brandbook entra por el build y no por una copia

Copiarlo a `dist/` **no funciona**, y no por un detalle de estilo:
`src/design-system/fonts.css` declara sus caras con URL absoluta
(`url('/fonts/inter-latin-variable.woff2')`). Bajo la subruta de Pages
(`/Copia-web/`) eso resuelve a la raíz del dominio y da 404: un brandbook que
habla de tipografía renderizado en la cara de reserva.

La app no sufre ese problema porque **Vite ya reescribe** esas URL al construir —
en `dist/assets/index-*.css` la declaración sale como `url(../fonts/…)`—. Darle el
brandbook a Vite usa esa misma máquina; un paso de copia con `sed` en el workflow
la reproduciría a mano y además crearía una segunda definición de qué se publica.

La clave del input **debe** llamarse `index`: Rollup nombra el chunk de entrada por
su clave y `qa.mjs` localiza los archivos de producción con `/^index-.*\.js$/` y
`/^index-.*\.css$/`. Con cualquier otra clave el gate de navegador moriría
buscando un archivo inexistente. Está escrito en el comentario del propio
`vite.config.ts` para que no se pierda.

## Archivos tocados

- `vite.config.ts` — segundo punto de entrada para el brandbook, con la razón y la
  restricción del nombre de la clave en comentario.
- `brand/brandbook.html` — su comentario de cabecera decía que `vite preview` no lo
  sirve. Era cierto y ha dejado de serlo con este cambio: se corrige en vez de
  dejar una instrucción falsa dentro del propio archivo.
- `README.md` — sección «Sitio publicado»: la URL, qué la publica y qué se sube.
- `brand/README.md` — enlace al brandbook publicado; y su conteo de checks pasa de
  145 a 149, que se había quedado atrás al añadirse los gates de solape y de ayuda
  revelada.

## Cómo verificar

Antes de tocar `main`, en local:

```bash
npm run verify        # 2239 pruebas, build, presupuesto — verde
npm run validate:ci   # 3 workflows sin problemas — verde
npm run qa            # 149 checks, 0 errores de consola — verde
```

Y cuatro comprobaciones específicas del cambio de entrada, que `npm run verify` no
cubre:

1. `dist/index.html` y `dist/brand/brandbook.html` existen los dos. ✔
2. `dist/assets/` sigue emitiendo `index-*.js` e `index-*.css` — el contrato de
   `qa.mjs`. ✔ (`index-BVnvH7iJ.js`, `index-CPr4Xrlo.css`)
3. El CSS del brandbook referencia las fuentes con ruta relativa:
   `url(../fonts/inter-latin-variable.woff2)`. ✔
4. El brandbook servido desde `dist/` en Chromium real: Inter y JetBrains Mono
   cargadas de verdad (`document.fonts.check` en `true`, las dos familias en
   `document.fonts` con estado `loaded`), 14 secciones, cero peticiones fallidas. ✔

El fast-forward se hizo con `git merge --ff-only`, a propósito: si `main` hubiera
avanzado entre medias el comando falla en vez de fabricar un merge commit
silencioso.

En el servidor, sobre `2bbe011`:

- **GitHub Pages** — run `32571128678`, **conclusión `success`**. Los dos jobs en
  verde: `Construir el sitio` y `Publicar` (`actions/deploy-pages@v4`, terminado a
  las 11:45:56 UTC). El sitio está republicado con el rediseño.
- **Gate rápido** — run `32571128684`. Al escribir este reporte iba por el paso de
  pruebas, con lint, documentación canónica, comprobación de tipos y frontera
  matemática protegida ya en verde. Se deja dicho así, en curso, en vez de
  afirmar un resultado que todavía no existía: los mismos pasos habían pasado en
  local antes del fast-forward (`npm run verify`, 2239 pruebas), pero eso no es lo
  mismo que haberlos visto pasar en el runner.

  Si ese run terminara en rojo, el arreglo va a `main` directamente: es la rama
  publicada y un fallo ahí ya está servido.

## Pendiente / siguiente paso

- **`npm run qa:webkit` sigue sin ejecutarse.** WebKit no está instalado en el
  entorno de esta sesión y su descarga falla (`Failed to download WebKit 26.5`).
  Es la única superficie de verificación del rediseño que no está cubierta.
- **La comprobación visual del sitio publicado es de quien lea esto.** El proxy de
  salida de esta sesión bloquea `klkmoraa.github.io` (`EGRESS_BLOCKED`), así que lo
  que se afirma aquí es la conclusión de los jobs de Actions, no una captura de la
  página en vivo. Vale la pena abrir la raíz y `/brand/brandbook.html`.
