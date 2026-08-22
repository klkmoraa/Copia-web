# Activos oficiales de marca

- `brandbook.html` — **Brandbook canónico**. No transcribe la paleta: importa
  `src/design-system/tokens.css` y pinta cada muestra con `var(--sc-…)`, así que
  un brandbook y un producto que discrepen es imposible por construcción. Lo
  único escrito a mano son las decisiones y su porqué.
- `logo.svg` — la marca: un pórtico de dos montantes, dintel y terreno, con los
  nudos dibujados como los dibuja el lienzo del producto.
- `manifest.json` — tamaños y hashes SHA-256 para detectar cambios byte a byte.

## Qué manda

`src/design-system/tokens.css` es la fuente única de color, forma, materia y
tipografía, y [`src/design-system/README.md`](../src/design-system/README.md)
explica por qué el sistema es como es. El Brandbook lee los tokens; no los
duplica. Si los dos discreparan, el que está mal sería el Brandbook — pero no
puede discrepar, porque no guarda valores propios.

Los contratos los verifican `tokens.test.ts`, `surfaceGeometry.test.ts`,
`material.test.ts` y `typography.test.ts` en cada ejecución de la suite, más los
145 checks de `npm run qa` en un navegador real.

## Regla de protección

No modifiques ni reemplaces estos archivos sin autorización explícita del
propietario del repositorio. Todo cambio en `brand/**` debe actualizar
`manifest.json` en la misma revisión y explicar la procedencia y el motivo.

`.github/CODEOWNERS` dirige los cambios de esta carpeta a `@klkmoraa`. La
exigencia efectiva de revisión depende de que la rama de GitHub tenga habilitada
la revisión obligatoria de Code Owners.

## Verificación local

```powershell
Get-FileHash -Algorithm SHA256 "brand\brandbook.html", "brand\logo.svg"
```

Los valores esperados están en `manifest.json`. Para abrir el Brandbook hace
falta un servidor estático desde la raíz —vive fuera de `public/` y carga los
tokens por ruta relativa—:

```powershell
npx serve .   # http://localhost:3000/brand/brandbook.html
```
