# Brand Assets Protection Design

> **HISTORICAL** — Diseño de incorporación conservado. La autoridad vigente de identidad visual está en [brand/README.md](../../../brand/README.md).

**Clasificación:** `HISTORICAL`

**Fecha:** 2026-08-08  
**Estado:** Aprobado por el usuario  
**Alcance:** Activos de marca y gobernanza del repositorio

## Objetivo

Incorporar el brandbook Clay y su logotipo como activos oficiales, versionados y fáciles de localizar, preservando exactamente los bytes entregados y reduciendo el riesgo de modificaciones accidentales.

## Diseño aprobado

Se creará una carpeta raíz `brand/` con estos archivos:

- `brand/brandbook-clay.html`: copia exacta de `1-brandbook-clay.html`.
- `brand/logo.svg`: copia exacta del SVG adjunto; solo se normaliza el nombre de archivo para que sea descriptivo.
- `brand/README.md`: propósito, procedencia, regla de no modificación sin autorización explícita y procedimiento para actualizar los hashes.
- `brand/manifest.json`: manifiesto versionado con tamaño y SHA-256 de cada activo protegido.

Se añadirá `.github/CODEOWNERS` con una regla para `brand/**` asignada a `@klkmoraa`. Esta regla hace visible que cualquier cambio en los activos debe pasar por revisión del propietario cuando la protección de la rama de GitHub requiera revisión de Code Owners.

## Límites

- No se modificará `src/`, `public/`, el solver, los workers, la persistencia, los contratos de resultados ni las dependencias.
- No se cambiará la versión `0.8.2` del paquete.
- No se alterará el contenido del HTML ni del SVG para “adaptarlo” a la aplicación.
- No se añadirán credenciales, tokens ni URLs privadas al manifiesto o al reporte.

## Protección y verificación

La protección tendrá dos capas complementarias:

1. El manifiesto SHA-256 permitirá detectar cualquier cambio byte a byte mediante una comparación posterior.
2. `CODEOWNERS` documentará y dirigirá la revisión de cambios sobre `brand/**` al propietario del repositorio.

La validación de la implementación comprobará los hashes de los adjuntos contra los archivos copiados, que el manifiesto sea JSON válido, que no haya errores de espacios en el diff y que no aparezcan patrones de secretos. También se ejecutarán las verificaciones relacionadas del proyecto antes del commit final.

## Entrega Git

Se generará el reporte obligatorio en `reports/YYYY-MM-DD-HHmm-brand-assets.md`, se commitearán el diseño, los activos, la protección y el reporte, y se hará push explícito a `origin/main` como solicitó el usuario.
