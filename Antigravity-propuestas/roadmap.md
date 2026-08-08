# Roadmap Tecnológico y Secuencia de Implementación — Antigravity

Este roadmap establece la secuencia óptima para implementar las propuestas de mejora en **structureCo**, minimizando el riesgo de regresiones en la frontera matemática protegida y maximizando el impacto en la experiencia del usuario y la mantenibilidad.

---

## Fases del Roadmap

```text
[FASE 1: Fundamentos de UX & Frontend]
  ├── AG-004: UX/UI Responsive y Paneles Táctiles — ✅ Implementada
  └── AG-001: Rediseño de Estado Global y Desacoplamiento de Canvas — ✅ Implementada
         |
         v
[FASE 2: Rendimiento Visual y Generación de Expedientes]
  ├── AG-002: Optimización SVG & Snapping R-Tree — ✅ Implementada
  └── AG-003: Refactorización Declarativa del Módulo PDF — ✅ Implementada
         |
         v
[FASE 3: Escalabilidad del Motor y Funcionalidades Profesionales]
  ├── AG-005: Solucionador de Matriz Dispersa (Sparse LDLT/Cholesky) — ✅ Implementada
  ├── AG-011: Perfilado del Análisis Completo para Localizar Cuellos de Botella — ✅ Implementada
  ├── AG-013: Generación Diferida (Lazy Loading) de Trazas Educativas `educationTrace` — ✅ Implementada
  ├── AG-009: Presets de Materiales y Perfiles Estructurales AISC / Eurocódigo — ✅ Implementada
  └── AG-014: Plan Maestro Consolidado de UX, Modo Aula y PDF — ✅ Implementada
         |
         v
[FASE 4: Refinamiento Premium y WOW Effect]
  └── AG-015: Refactorización Premium del Sistema de Diseño (WOW UX/UI) — ✅ Implementada
```

---

## Detalle por Fase Actual

- **AG-015 (Fase 4 - Premium Design)** — ✅ Implementada 2026-08-06. Dirección visual **"Mesa de dibujo"**: paleta v3 (neutros de grafito, esmeralda, segundo tono cian), escala tipográfica de display, capa de materia tokenizada (vidrio, anillos, halos, gradientes) y pantalla de bienvenida reescrita alrededor de una pieza de firma que dibuja un pórtico biempotrado con su diagrama de momentos. Reporte: `reports/2026-08-06-0036-ag015-premium-ui.md`.
  - **Divergencia respecto a lo anticipado en este roadmap:** no se incorporaron Inter ni JetBrains como fuentes descargadas. La decisión **D-010** (`docs/ux-redesign/DECISIONS.md`) prohíbe `@font-face` y CDN en esta app local-first. En su lugar se usan las familias variables con tamaño óptico ya presentes en el sistema (`Segoe UI Variable Display`/`Text`, `SF Pro Display`/`Text`), que dan el salto tipográfico sin descargar nada. Si se quiere Inter de verdad habría que revisar D-010 primero.
  - Glassmorphism y microanimaciones sí entraron, pero tokenizados y con `prefers-reduced-motion` / `prefers-reduced-transparency` respetados.
  - Queda abierto: el techo de rendimiento se re-baseó (ver reporte) y el core de animación sigue en el chunk de entrada.
