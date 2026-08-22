# CRI-93 · Evidencia de medición de rendimiento

**Clasificación:** `AUDIT/TEMPORARY` — evidencia instrumental de una ejecución concreta.

Contenido:

- `chromium-container-run*.json` — salida cruda de
  `node scripts/measure-datasheet-performance.mjs`, una por ejecución completa.
  Cada archivo trae el entorno leído del navegador, el tamaño del modelo, las
  muestras individuales de cada métrica y el resumen (mínimo, mediana, p95,
  máximo).
- El informe interpretado, con presupuesto y decisión, vive en
  `reports/2026-08-19-2300-cri-93-medicion-rendimiento.md`.

**Aviso obligatorio:** estas ejecuciones son `container-headless`. NO son la
medición en dispositivo físico que CRI-93 exige; el propio JSON lo declara en
`measurementKind` y en `warning`.
