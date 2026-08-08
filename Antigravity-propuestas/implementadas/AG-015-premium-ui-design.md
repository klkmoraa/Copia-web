# AG-015 — Rediseño Premium Autónomo del Sistema de UI (WOW Effect)

# Estado: Implementada | Fecha: 2026-08-05 | Implementada: 2026-08-06 | Área: Frontend / UX / UI

> Implementada por Claude Code el 2026-08-06.
> Reporte: `reports/2026-08-06-0036-ag015-premium-ui.md`
> Dirección visual resultante: **"Mesa de dibujo"** (paleta v3). Ver `docs/design-system/PALETTE.md` y `TYPOGRAPHY.md`.

# Resumen ejecutivo
Transformar la apariencia de **structureCo** desde un diseño meramente funcional hacia un acabado estético de primer nivel ("WOW Effect") mediante una completa reestructuración de la paleta de colores, tipografías y diseño general. El agente a cargo tiene autonomía total para investigar, proponer e implementar las decisiones de diseño, respetando siempre la esencia técnica de la aplicación y la usabilidad responsive.

# Problema
La interfaz actual funciona, pero carece de refinamiento visual premium y de micro-interacciones modernas. La pantalla de inicio (Welcome Screen) en particular necesita una mejora visual importante para causar una mejor primera impresión.

# Solución propuesta
Se delega la responsabilidad total de la reestructuración del diseño a Claude Opus 5. 
El agente debe hacer uso extensivo de **Sub-Agentes** (`invoke_subagent`), **Superpowers** y **Plugins de Diseño** para explorar el código actual, proponer un nuevo lenguaje de diseño y refactorizar masivamente los tokens CSS y componentes visuales, con foco especial en la **Pantalla de Inicio**.

---

# PROMPT PARA CLAUDE CODE

Lee e implementa la propuesta ubicada en:

Antigravity-propuestas/aprobadas/AG-015-premium-ui-design.md

Instrucciones de ejecución:
1. Valida la propuesta contra el código real antes de modificar archivos.
2. ACTIVACIÓN OBLIGATORIA DE SUPERPOWERS, AGENTES Y PLUGINS:
   - Activa todos tus Superpowers (`using-superpowers`, `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `verification-before-completion`, `systematic-debugging`).
   - Aplica rigurosamente tus plugins de UI (`frontend-design`, `ui-theme-designer`, `code-simplifier`, `typescript-lsp`, `security-guidance`).
   - **Uso de Agentes**: Utiliza extensivamente `invoke_subagent` (Sub-agentes) para paralelizar tareas, como explorar la UI actual, generar paletas de colores complejas, reescribir tokens y mejorar la Pantalla de Inicio.
3. MISIÓN DE DISEÑO AUTÓNOMO (WOW EFFECT):
   - El objetivo es crear un diseño ABSOLUTAMENTE PREMIUM.
   - **Tú propones los cambios**. No te limitaremos con directivas específicas de diseño. Realiza una **completa reestructuración de la paleta de colores, tipografía, sombreado y efectos (ej. glassmorphism, microanimaciones)**.
   - Mejora drásticamente la **Pantalla de Inicio (Welcome Screen)**.
   - Mantén intacta la esencia técnica y profesional de la aplicación, así como su arquitectura responsive y la frontera matemática del motor.
4. LIBERTAD ARQUITECTÓNICA ABSOLUTA:
   - Eres Claude Opus 5. Tienes completa autonomía técnica. Reescribe libremente `tokens.css`, `styles.css` y cualquier archivo de componente React necesario para lograr el rediseño más elegante posible. Confío plenamente en tu buen gusto.
5. VERIFICACIÓN: Ejecuta `npm run verify` asegurando 100% de éxito en tests, types y build.

Al terminar:
- Genera el reporte completo en `reports/YYYY-MM-DD-HHmm-ag015-premium-ui.md` explicando tus decisiones de diseño.
- Mueve este documento a `Antigravity-propuestas/implementadas/AG-015-premium-ui-design.md`.
