# structureCo 0.8.1 — Estado canónico

**Modo:** trabajo exclusivamente local. Ver [LOCAL_MODE.md](LOCAL_MODE.md).
**GitHub:** NO UTILIZADO.
**Rama:** `main` · **Commit base:** `3564505`
**Versión en `package.json` al iniciar:** 0.8.0. **Versión actual:** 0.8.1 (bump en S20).

Estados válidos: `NOT_STARTED` · `IN_PROGRESS` · `BLOCKED` · `COMPLETE` · `NOT_NEEDED`.

Un slice solo pasa a `COMPLETE` con: implementación + pruebas ejecutadas + build + evidencia +
revisión del diff + verificación de la frontera protegida + reporte + commit local.

| ID | Slice | Estado | Propietario | Dependencias | Commit local | Pruebas | Evidencia | Bloqueos |
|----|-------|--------|-------------|--------------|--------------|---------|-----------|----------|
| S01 | Baseline y protección | COMPLETE | Opus 5 | — | `b6cfde7`, `be02366` | 67 archivos / 388 pruebas en verde | `PROTECTED_BASELINE.sha256`, [reporte](../../../reports/2026-08-02-1150-s01-baseline-y-proteccion.md) | — |
| S02 | Especificación de diseño | COMPLETE | Opus 5 | S01 | `8f9cb73` | 76 archivos / 515 pruebas | [DESIGN_AUDIT.md](DESIGN_AUDIT.md), [reporte](../../../reports/2026-08-02-1410-s02-s03-tokens-y-contraste.md) | — |
| S03 | Fundamentos del sistema de diseño | COMPLETE | Opus 5 | S02 | `8f9cb73` | contraste medido en ambos temas | 38 → 0 literales de color; 6/6 parejas AA | — |
| S04 | Navegación y shell | COMPLETE | Opus 5 | S03 | `1752ac1` | 77 archivos / 521 pruebas | bus de comandos tipado, [reporte](../../../reports/2026-08-02-1418-s04-bus-de-comandos.md) | — |
| S05 | Canvas e interacción | COMPLETE (auditado) | Sonnet 5 | S03 | — | sin cambios de código | [reporte conjunto](../../../reports/2026-08-02-1500-s05-s08-auditoria-canvas-inspector-resultados-aula.md) | — |
| S06 | Inspector y formularios | COMPLETE (auditado) | Sonnet 5 | S03 | — | sin cambios de código | verificado vía manejador de React real (blur nativo no fiable en pestaña de fondo) | — |
| S07 | Resultados | COMPLETE (auditado) | Sonnet 5 | S03 | — | sin cambios de código | avisos, corrección guiada y exportación CSV verificados | — |
| S08 | Mentor/Aula | COMPLETE (auditado) | Sonnet 5 | S03 | — | sin cambios de código | recorrido de 6 etapas verificado contra §16 | — |
| S09 | Seguridad de importaciones | COMPLETE | Opus 5 | S01 | `fdb0ab5` | 69 archivos / 439 pruebas en verde (+51) | corpus adversarial en `portableSecurity.test.ts`, [reporte](../../../reports/2026-08-02-1205-s09-seguridad-de-importaciones.md) | — |
| S10 | Experiencia de importación | COMPLETE | Sonnet 5 | S09 | `550cec4` | 78 archivos / 530 pruebas | cancelación de inspección + guarda anti-carrera, [reporte](../../../reports/2026-08-02-1516-s10-experiencia-de-importacion.md) | — |
| S11 | Política numérica | COMPLETE | Opus 5 | S01 | `5992cfc` | 71 archivos / 467 pruebas en verde (+28) | verificación funcional en navegador, [reporte](../../../reports/2026-08-02-1220-s11-politica-numerica.md) | — |
| S12 | SVG | COMPLETE | Opus 5 | S11 | `f068e33` | 73 archivos / 487 pruebas en verde (+20) | medición antes/después en la app real, [reporte](../../../reports/2026-08-02-1230-s12-s13-fidelidad-svg-png.md) | — |
| S13 | PNG | COMPLETE | Opus 5 | S12 | `f068e33` | incluidas arriba | rasterizado 2000×1280 verificado, [reporte](../../../reports/2026-08-02-1230-s12-s13-fidelidad-svg-png.md) | — |
| S14 | PDF | COMPLETE | Opus 5 | S11 | `72752b7` | 74 archivos / 495 pruebas | [reporte](../../../reports/2026-08-02-1248-s14-pdf-editorial.md) | pendiente autorización sobre ruido del motor |
| S15 | Casos analíticos e invariantes | COMPLETE | Opus 5 | S01 | `a5b7566` | 75 archivos / 507 pruebas | [VERIFICATION_POLICY.md](VERIFICATION_POLICY.md), [reporte](../../../reports/2026-08-02-1255-s15-invariantes.md) | — |
| S16 | Rendimiento | COMPLETE | Opus 5 | S01 | `226a66f` | 76 archivos / 513 pruebas | [PERFORMANCE.md](PERFORMANCE.md), [reporte](../../../reports/2026-08-02-1400-s16-rendimiento.md) | — |
| S17 | Accesibilidad y responsive | COMPLETE (auditado) | Sonnet 5 | S04–S08 | — | sin cambios de código | 8 viewports sin overflow, [reporte](../../../reports/2026-08-02-1530-s17-accesibilidad-y-responsive.md) | — |
| S18 | CI preparado localmente | COMPLETE | Sonnet 5 | S15 | `321cca2` | 78 archivos / 530 pruebas + qa/qa:webkit en verde | [CI.md](CI.md), [reporte](../../../reports/2026-08-02-1615-s18-ci-preparado-localmente.md) | — |
| S19 | Documentación | COMPLETE | Sonnet 5 | todos | `c186d80` | 78 archivos / 530 pruebas | README, FRONTEND.md, PORTABLE_EXPEDIENTS.md y CHANGELOG consolidados, [reporte](../../../reports/2026-08-02-1905-s19-documentacion.md) | — |
| S20 | Certificación y versión | COMPLETE | Sonnet 5 | todos | `f6c6f9e` | 78 archivos / 530 pruebas, instalación limpia | qa + qa:webkit en verde, `package.json` en 0.8.1, [reporte](../../../reports/2026-08-02-1915-s20-certificacion-y-version.md) | — |

## Frontera matemática protegida

22 archivos **fuente** con hash SHA-256 registrado en `PROTECTED_BASELINE.sha256`:
`src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx`, `src/types.ts`.

Los archivos de prueba dentro de esas carpetas quedan excluidos a propósito: añadir una prueba
nunca cambia la matemática, y exigir un `--update` por cada prueba nueva acostumbraría a
ejecutarlo, que es como se cuela una modificación real del solver.
Ver [VERIFICATION_POLICY.md](VERIFICATION_POLICY.md).

Verificación:

```bash
node scripts/check-protected-baseline.mjs
```

## Limitaciones registradas al iniciar

- No se pudo confirmar la versión de Claude Code: el ejecutable `claude` no está en el `PATH`
  del shell de esta sesión. El modelo activo sí está confirmado: Opus 5 (`claude-opus-5`).
- Las referencias visuales oficiales (`01-instrumento-precision-structureco.pdf` …
  `05-mesa-modular-structureco.pdf`, 33 capturas, 5 boards y 15 conceptos) existen **solo dentro
  de carpetas de respaldo ignoradas por git**
  (`structureCo-backup-redesign-20260802-002717/output/design-exploration/…`). No están versionadas.
- `structureCo_mockups_canva_10_paginas.pdf` **no se encontró** en el proyecto.
- Las skills `structureco-project-guardian`, `-engine-safety`, `-ux-responsive`,
  `-classroom-mode`, `-documentation-handoff` y `-release-certification` que `AGENTS.md`
  menciona **no existen** en el repositorio; `.gitignore` las lista como tooling externo.
  La única skill presente es `change-report`.
