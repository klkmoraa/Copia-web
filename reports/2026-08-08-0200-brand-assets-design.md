# Diseño de activos de marca protegidos

**Fecha:** 2026-08-08 02:00
**Agente:** Codex
**Rama:** main

## Qué cambió

Se documentó el diseño aprobado para incorporar el brandbook Clay y el logotipo en una carpeta raíz `brand/`. El diseño incluye copias byte a byte, un manifiesto SHA-256, una política de actualización y revisión mediante `CODEOWNERS`.

## Por qué

El usuario autorizó la opción de protección recomendada para que los activos oficiales sean localizables y detectables si se modifican accidentalmente, sin tocar el motor ni la aplicación.

## Archivos tocados

- `docs/superpowers/specs/2026-08-08-brand-assets-design.md` — especificación de alcance, estructura, protección y verificación.
- `reports/2026-08-08-0200-brand-assets-design.md` — este reporte de diseño.

## Cómo verificar

- Leer la especificación y comprobar que limita el alcance a `brand/` y `.github/CODEOWNERS`.
- Ejecutar `git diff --check`.

## Pendiente / siguiente paso

Revisar la especificación antes de copiar los activos y crear la protección del repositorio.
