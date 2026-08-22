# Activos oficiales de marca

Esta carpeta es la fuente versionada de los activos de identidad de structureCo:

- `brandbook.html` — **Brandbook canónico**. No transcribe la paleta: importa
  `src/design-system/tokens.css` y pinta cada muestra con `var(--sc-…)`, así que un
  brandbook y un producto que discrepen es imposible por construcción. Lo único escrito a
  mano son las decisiones y su porqué.
- `brandbook-clay.html` — **superseded**. Documenta la identidad de arcilla
  (marfil, menta/esmeralda, sombras de doble luz) que el producto retiró. Se conserva sin
  tocar como evidencia histórica y porque el gate de color de `validation/cri-91/` lo lee
  como entrada. **No es autoridad de nada.**
- `logo.svg` — la marca: un pórtico de dos montantes, dintel y terreno, con los nudos
  dibujados como los dibuja el lienzo del producto.
- `manifest.json` — tamaños y hashes SHA-256 para detectar cambios byte a byte.

## Qué manda

`src/design-system/tokens.css` es la fuente única de color, forma, materia y tipografía.
El Brandbook la lee; no la duplica. Si los dos discreparan, el que está mal es el
Brandbook — pero no puede discrepar, porque no guarda valores propios.

Los contratos del sistema los verifican en cada ejecución de la suite:

| Archivo | Qué vigila |
|---|---|
| `src/design-system/tokens.test.ts` | Contraste de cada rol contra los dos fondos de su apariencia, apariencia oscura escrita a mano, ausencia de materia de arcilla. |
| `src/design-system/surfaceGeometry.test.ts` | Escala de radios por rol, elevación monótona, filete de medio píxel, ningún control que se eleve bajo el puntero. |
| `src/design-system/material.test.ts` | Los seis niveles, el material translúcido con su respaldo opaco, el pulsado como relleno. |
| `src/design-system/typography.test.ts` | Cara del sistema primero, escala de escritorio, ninguna cara editorial. |

## Regla de protección

No modifiques ni reemplaces estos archivos sin autorización explícita del propietario del
repositorio. Todo cambio en `brand/**` debe conservar o actualizar `manifest.json` como
parte de la misma revisión, y debe explicar la procedencia y el motivo de la sustitución.

`.github/CODEOWNERS` dirige los cambios de esta carpeta a `@klkmoraa`. La exigencia efectiva
de revisión depende de que la rama de GitHub tenga habilitada la revisión obligatoria de
Code Owners.

## Verificación local

Desde la raíz del repositorio, compara los hashes registrados con:

```powershell
Get-FileHash -Algorithm SHA256 "brand\brandbook.html", "brand\brandbook-clay.html", "brand\logo.svg"
```

Los valores esperados están en `manifest.json`. Para abrir el Brandbook hace falta un
servidor estático desde la raíz —vive fuera de `public/` y carga los tokens por ruta
relativa—:

```powershell
npx serve .   # http://localhost:3000/brand/brandbook.html
```
