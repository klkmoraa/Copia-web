# Cierre de CRI-81 + CRI-82: integración a `main` y publicación

**Fecha:** 2026-08-14 16:30
**Agente:** Claude Code
**Rama:** `main`

## Qué cambió

Se integró la rama `feature/cri-41-structural-datasheet` a `main` y se republicó
GitHub Pages con el build reconstruido desde `main`. No hubo cambios funcionales:
esta operación sólo integra y publica lo que CRI-81 y CRI-82 ya habían dejado
verificado.

El merge fue **fast-forward**: `main` estaba en `ef141ca` y era ancestro directo
de la rama, así que no hizo falta commit de merge y el historial queda lineal.
No se usó force push en ningún punto.

## Por qué

CRI-41 se entregó en dos fases —CRI-81, la hoja de datos de sólo lectura, y
CRI-82, el editor visual— y ambas estaban listas y verificadas en la rama. Este
cierre las lleva a `main` y a la URL pública.

## Archivos tocados

Ninguno del producto. Las operaciones fueron:

- `main` — avanzado por fast-forward de `ef141ca` a `dc9b7c6` (13 commits).
- `origin/main` — actualizado a `dc9b7c6`.
- `origin/gh-pages` — nuevo commit `d9a1572`
  (`deploy: publish main dc9b7c63... to GitHub Pages`) con el árbol completo de
  `dist/` más `.nojekyll`.

La publicación se hizo desde un worktree temporal de `gh-pages` en el directorio
de scratch, no en el árbol del proyecto, y el worktree se retiró al terminar.

**Dos directorios sin seguimiento quedaron intactos a propósito:**
`validation/topbar-repeat-after/` y `validation/topbar-repeat-before/`. Son
capturas de QA anteriores a esta sesión, ajenas a CRI-81/82, y no bloquean nada.

## Cómo verificar

```bash
git ls-remote origin refs/heads/main refs/heads/gh-pages
```

- `main` → `dc9b7c630b7bec654cd449b24f71a5bc0c9a9c49`
- `gh-pages` → `d9a157243a4bac20164677ff524341987ece3a9c`

```bash
gh api repos/klkmoraa/structureco/pages/builds/latest --jq '.status, .commit'
```

`built` para `d9a1572`, sin error. La build tardó 19 s.

La URL pública responde y sirve **este** build, no una copia cacheada: los
assets con hash que referencia el `index.html` publicado coinciden uno a uno con
los de `dist/` local, y el chunk nuevo del datasheet se sirve correctamente.

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://klkmoraa.github.io/structureco/
curl -s -o /dev/null -w "%{http_code}\n" https://klkmoraa.github.io/structureco/assets/DatasheetPanel-DEgvI-mq.js
```

Ambos `200`; el chunk del datasheet pesa 50 038 bytes.

## Pendiente / siguiente paso

Nada pendiente de este cierre. La rama `feature/cri-41-structural-datasheet`
sigue existiendo en el remoto; borrarla es opcional y no se hizo porque no se
pidió.

Los dos apuntes técnicos que CRI-82 dejó abiertos siguen vigentes y están en su
propio reporte
(`reports/2026-08-14-0145-cri-82-datasheet-editor.md`): la ausencia de
instantánea de obsolescencia en `updateProject`, y que ampliar `NodeBulkChanges`
con `x` e `y` sería un ticket propio si alguna vez se quisiera la semántica
completa de comando para las coordenadas.
