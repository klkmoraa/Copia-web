# AG-008

# Cobertura de Pruebas Visuales Automatizadas de Diagramas N-V-M con Playwright Visual Regression

# En evaluación

# 2026-08-05

# Testing / QA

# Resumen ejecutivo

Propone integrar capturas de pantalla de referencia (*Visual Snapshot Testing*) en los scripts de QA de Playwright (`qa.mjs`, `qa-webkit.mjs`) para comparar pixel a pixel los diagramas vectoriales de esfuerzos $N, V, M$, la forma deformada y las cotas del lienzo canvas. Esto prevendrá regresiones invisibles en el renderizado gráfico durante futuros refactors.

# Problema

Actualmente los scripts de QA verifican la presencia de elementos en el DOM y respuestas del solver, pero no comparan diferencias sutiles en el trazado de curvas o colores de diagramas.

# Evidencia

- `qa.mjs` y `qa-webkit.mjs`: Scripts Playwright existentes en la raíz.

# Objetivo

1. Incorporar `toHaveScreenshot()` en los tests de Playwright para vistas clave de canvas.
2. Detectar regresiones visuales o de contraste cromático de forma automática en CI/CD.

# Complejidad

**Media**.

# Prioridad

**Media**.

---

# PROMPT PARA CLAUDE CODE

Lee e implementa la propuesta ubicada en:

`Antigravity-propuestas/aprobadas/AG-008-visual-regression-testing-playwright.md`

Valida la propuesta contra el código real antes de modificar archivos.
Agrega comparaciones visuales de pantalla en los scripts de QA de Playwright.

Ejecuta lint, tests y `npm run qa`.
