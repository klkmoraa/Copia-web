# Reporte de entrega: publicación en Pages y estado real de las ramas

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/pdf-reportlab-migration-79ofmk`, fusionada en `main` (cuarta vuelta, sobre `f5bb17b`)

---

## 1. Qué se pidió

> «Haz push y commit y actualiza gh page de todos estos cambios y lo que no hemos hecho.
> Creo que aún no están arriba los 12 métodos, tampoco; siguen en otra rama.»

Y después, ante las dos vías posibles: «hazlo tú».

Tres cosas: publicar, y dos dudas sobre **dónde está** cada trabajo. El sitio está publicado y
la migración a ReportLab ya está arriba. Lo que costó no fue construir, sino descubrir que el
camino documentado para publicar no existe.

## 2. Los 12 métodos ya estaban arriba

La duda era razonable —hay 17 ramas `claude/*` vivas— pero el registro decía otra cosa.
`SOLUTION_METHODS` en `src/analysis-methods/methodRegistry.ts` declara **doce**:

```
matrix-stiffness      double-integration    conjugate-beam        three-moment
hardy-cross           virtual-work          method-of-sections    method-of-joints
portal-method         cantilever-method     castigliano-truss     kani-frame
```

Los doce estaban ya en `main`, **byte a byte iguales** a los de esta rama. Las ramas que los
traían llevaban fusionadas desde antes de esta sesión:

```
origin/claude/next-analysis-method-4f2j07       fusionada
origin/claude/pdfs-calculos-reales-5ebh2j       fusionada
origin/claude/pdf-diagrams-improvements-2vopp2  fusionada
```

Y Pages ya los servía: el despliegue del 29/08 a las 13:14 UTC publicó `5134657`, tip de `main`.
Así que lo que **no** estaba arriba no eran los métodos —era la migración a ReportLab.

## 3. El camino documentado para publicar no existe

El flujo declara `workflow_dispatch` y su comentario prometía publicar «desde cualquier rama sin
tener que fusionar». **Es falso**, y se comprobó lanzándolo:

```
run 33272080948   rama claude/pdf-reportlab-migration-79ofmk
  Construir el sitio   success   (34 s: npm ci, build, artefacto subido)
  Publicar             failure   (1 s)
```

El `build` pasa entero, con los 13 MB de intérprete dentro. Es `deploy` el que muere en un
segundo, porque el entorno `github-pages` restringe qué ramas pueden desplegar —por omisión,
sólo la rama por defecto—. El historial no deja lugar a dudas: de los cinco despliegues manuales
que existían, **los dos desde `main` en verde y los tres desde una rama muertos ahí mismo**.

El comentario se corrige en este trabajo: decía lo contrario de lo que hace, y es la clase de
comentario que hace perder una tarde. Ahora dice qué pasa y dónde se cambia.

## 4. La condición que nadie había probado

Antes de publicar quedaba una condición sin probar, y es específica de Pages: **la subruta**.
Netlify sirve en la raíz de un dominio; Pages sirve en `/Copia-web/`. Desde 0.8.4 el informe
carga un intérprete de Python de 13 MB desde `assets/pyodide/`, y si esas rutas no sobrevivieran
al prefijo, el informe fallaría **sólo en Pages** — con todos los gates en verde, porque
`qa:calculation-report` sirve desde la raíz, igual que Netlify.

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

Sobrevive porque los activos se resuelven con `new URL('./pyodide/', import.meta.url)`, anclada
al *chunk* emitido y no a la raíz del sitio. Era la respuesta esperada, pero no estaba
comprobada, y es el tipo de fallo que sólo aparece en el despliegue.

Tamaños, contra los límites de Pages (100 MB por archivo, 1 GB por sitio): 29 MB de sitio, y el
archivo mayor es `pyodide.asm.wasm` con 8,6 MB.

## 5. Cómo se publicó

Descartada la vía del `workflow_dispatch`, quedaban dos: ajustar el entorno del repositorio
—fuera del alcance de esta sesión— o fusionar. Se fusionó, con permiso explícito, en
*fast-forward* limpio: `main` estaba en `5134657`, que es exactamente la base de esta rama, así
que no hay commit de fusión ni historia reescrita.

```
5134657..ce3ecd8   claude/pdf-reportlab-migration-79ofmk -> main
```

El push disparó los dos flujos, y los dos en verde sobre `ce3ecd8`:

```
Gate rápido    run 33272827980   success
GitHub Pages   run 33272827985   build success · deploy success  20:17:25 UTC
```

## 6. Verificación

```
npm run verify        exit 0 — lint, docs, frontera protegida, pruebas, build,
                      presupuesto, entry y bundle del navegador
subruta /Copia-web/   6 comprobaciones en verde (§4)
validate:ci           los tres flujos sin problemas
CI y Pages en main    ambos success sobre ce3ecd8
```

Carga inicial sin mover: 823 012 B / 213 150 gzip.

No se pudo comprobar el sitio en vivo desde aquí: el proxy de la sesión rechaza `github.io` con
un 403 en el CONNECT. Lo verificado es el despliegue en verde y el mismo `dist/` servido bajo la
subruta exacta de Pages, que es donde estaba el riesgo.

## 7. Lo que no se ha hecho

| Pendiente | Por qué |
|---|---|
| El entorno `github-pages` sigue admitiendo sólo la rama por defecto. | Publicar una rama sin fusionar requiere añadirla en Settings → Environments → «Deployment branches and tags». Es un ajuste del repositorio, fuera del alcance de esta sesión. |
| La nota «punto de inflexión a 50 % de la altura» cuelga del nudo base de la columna, no de la rótula que nombra. | Decisión de contenido —qué señala el dibujo—, no de renderizado. Sigue ofrecida. |
| Pages no reescribe rutas a `index.html`. | Preexistente y ajeno a este trabajo: un enlace profundo da 404 en Pages y no en Netlify. |
| Nadie ha mirado el sitio publicado con un navegador. | El proxy lo impide desde aquí. La comprobación equivalente (§4) se hizo en local sobre el mismo artefacto. |

## 8. Lo que este cambio no hace

- No toca código de producto, ni la frontera protegida, ni la UI, ni el branding: corrige un
  comentario de `.github/workflows/pages.yml` y añade este reporte.
- No abre ningún PR y no cambia ningún ajuste del repositorio.
