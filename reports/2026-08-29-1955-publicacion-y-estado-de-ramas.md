# Reporte de entrega: publicación en Pages y estado real de las ramas

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/pdf-reportlab-migration-79ofmk` (cuarta vuelta, sobre `f5bb17b`)

---

## 1. Qué se pidió

> «Haz push y commit y actualiza gh page de todos estos cambios y lo que no hemos hecho.
> Creo que aún no están arriba los 12 métodos, tampoco; siguen en otra rama.»

Tres cosas: publicar, y dos dudas sobre **dónde está** cada trabajo. Esta vuelta establece los
hechos y verifica una condición que nadie había probado. **Publicar no se ha podido**: el
despliegue desde una rama está bloqueado por el propio repositorio, y §3 dice exactamente por
qué y qué hace falta.

## 2. Los 12 métodos sí están arriba

La duda era razonable —hay 17 ramas `claude/*` vivas— pero el registro dice otra cosa.
`SOLUTION_METHODS` en `src/analysis-methods/methodRegistry.ts` declara **doce**:

```
matrix-stiffness      double-integration    conjugate-beam        three-moment
hardy-cross           virtual-work          method-of-sections    method-of-joints
portal-method         cantilever-method     castigliano-truss     kani-frame
```

Los doce están en `main`, **byte a byte iguales** a los de esta rama y a los de las ramas donde
se escribieron. Las dos que los traían ya están fusionadas:

```
origin/claude/next-analysis-method-4f2j07   fusionada en main
origin/claude/pdfs-calculos-reales-5ebh2j   fusionada en main
origin/claude/pdf-diagrams-improvements-2vopp2  fusionada en main
```

Y Pages ya los servía: el despliegue del 29/08 a las 13:14 UTC publicó `5134657`, que es el tip
de `main`. Así que lo que **no** estaba arriba no eran los métodos —era la migración a
ReportLab, que son los tres commits de esta rama.

## 3. Lo que sí faltaba, y por qué no se ha podido publicar

Pages publica desde `main` en cada push, y esta rama no está fusionada. El sitio sirve todo
menos las tres vueltas de ReportLab.

El flujo declara `workflow_dispatch` y su comentario prometía publicar «desde cualquier rama
sin tener que fusionar». **Eso es falso**, y se comprobó lanzándolo:

```
run 33272080948   rama claude/pdf-reportlab-migration-79ofmk
  Construir el sitio   success   (npm ci, build, artefacto subido — 34 s)
  Publicar             failure   (1 s)
```

El `build` pasa entero: construye con los 13 MB de intérprete dentro y sube el artefacto. Es
`deploy` el que muere en un segundo, porque el entorno `github-pages` del repositorio restringe
qué ramas pueden desplegar —por omisión, sólo la rama por defecto—. El historial no deja lugar a
dudas: de los cinco despliegues manuales que existen, **los dos desde `main` están en verde y
los tres desde una rama fallaron ahí mismo**.

Así que el comentario del flujo se corrige en este commit: decía lo contrario de lo que hace, y
es la clase de comentario que hace perder una tarde.

**El sitio sigue, por tanto, sin la migración a ReportLab.** Hay dos formas de cambiarlo, y las
dos son decisión del autor:

1. Añadir la rama en Settings → Environments → `github-pages` → «Deployment branches and tags»,
   y relanzar el despliegue manual. Publica sin fusionar.
2. Fusionar la rama en `main`, que publica sola en el push.

No se hace ninguna de las dos aquí: la primera es un ajuste del repositorio, y la segunda es un
push a `main`, que no se hace sin que se pida.

## 3.1 La condición que nadie había probado, y que sí está verificada

Antes de intentar publicar había una condición sin probar, específica de Pages: **la subruta**.
Netlify sirve en la raíz de un dominio; Pages sirve en `/Copia-web/`. Desde 0.8.4 el informe
carga un intérprete de Python de 13 MB desde `assets/pyodide/`, y si esas rutas no sobrevivieran
al prefijo, el informe fallaría **sólo en Pages** — con todos los gates en verde, porque
`qa:calculation-report` sirve desde la raíz.

Se probó de verdad: `dist/` servido como árbol estático plano bajo `/Copia-web/`, sin *fallback*
de SPA (Pages no lo tiene; el `netlify.toml` sí) y con los tipos MIME que da Pages.

```
la aplicación arranca bajo subruta                 OK
la vista previa pinta páginas bajo subruta         OK   12 páginas
el PDF descargado es real                          OK   38 017 B
cada archivo del intérprete se sirvió (200)        OK   los 5
ningún 404 en toda la sesión                       OK
sin errores de consola                             OK
```

Funciona porque los activos se resuelven con `new URL('./pyodide/', import.meta.url)`, que se
ancla al *chunk* emitido y no a la raíz del sitio. Era la respuesta esperada, pero no estaba
comprobada, y es el tipo de fallo que sólo aparece en el despliegue. Cuando la publicación se
desbloquee, esta parte ya no es una incógnita.

Tamaños, contra los límites de Pages (100 MB por archivo, 1 GB por sitio): 29 MB de sitio, y el
archivo mayor es `pyodide.asm.wasm` con 8,6 MB.

## 4. Lo que no se ha hecho

Inventario honesto, para que no se confunda «publicado» con «terminado»:

| Pendiente | Por qué sigue pendiente |
|---|---|
| **El sitio no tiene la migración a ReportLab.** | El despliegue manual desde una rama lo bloquea el entorno `github-pages`. Requiere o el ajuste del repositorio o una fusión a `main`; las dos son decisión del autor. |
| Esta rama no está en `main`. | Fusionar es decisión del autor, y abrir un PR requiere que se pida. |
| La nota «punto de inflexión a 50 % de la altura» cuelga del nudo base de la columna, no de la rótula que nombra. | Es decisión de contenido —qué señala el dibujo—, no de renderizado. Sigue ofrecida. |
| El siguiente push a `main` republica `main`. | Es el comportamiento del flujo, no un defecto: mientras esta rama no se fusione, cualquier publicación vuelve a dejar el sitio sin ReportLab. |
| Pages no reescribe rutas a `index.html`. | Preexistente, ajeno a este trabajo: un enlace profundo da 404 en Pages y no en Netlify. No se toca aquí porque no es de esta tarea. |

## 5. Verificación

```
árbol de trabajo limpio; f5bb17b ya estaba en origin
build                          29 MB de dist, mayor archivo 8,6 MB
subruta /Copia-web/            6 comprobaciones en verde (arriba)
despliegue manual              build en verde, deploy BLOQUEADO por el entorno
```

No se cambió código de producto en esta vuelta —sólo un comentario de flujo y este reporte—,
así que `verify` sigue siendo el de `f5bb17b`: 315 archivos, 3015 pruebas, 8 omitidas, 0 fallos.

## 6. Lo que este cambio no hace

- No toca código de producto, ni la frontera protegida, ni la UI, ni el branding: corrige un
  comentario de `.github/workflows/pages.yml` y añade este reporte.
- No fusiona nada, no abre ningún PR y no cambia ningún ajuste del repositorio.
- **No deja el sitio actualizado**, que es lo que se pidió: está bloqueado, y arriba está por qué
  y qué hace falta para desbloquearlo.
