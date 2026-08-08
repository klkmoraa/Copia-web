# Tokens visuales

Este archivo conserva el punto de entrada histórico creado en Fase 2. La fuente de verdad actual es `src/styles/tokens.css` y la especificación completa de Fase 4 está dividida en:

- [Sistema de tokens](./DESIGN_TOKENS.md)
- [Color y accesibilidad](./COLOR_ACCESSIBILITY.md)
- [Inventario de iconografía](./ICON_INVENTORY.md)
- [Especificación de motion](./MOTION_SPEC.md)

## Política de compatibilidad

Los aliases heredados (`--accent`, `--surface`, `--text`, `--force`, etc.) apuntan a roles `--sc-*`; no contienen una segunda paleta. Permanecen disponibles hasta que cada superficie migre de forma verificada.

La Fase 4 no hace un rewrite global. Consolida los fundamentos compartidos y prohíbe introducir nuevos valores mágicos cuando ya existe un token semántico equivalente.
