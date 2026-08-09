# Selectores del TopBar y Menú de Exportación con Glassmorphism

**Fecha:** 2026-08-08 19:35
**Agente:** Antigravity
**Rama:** main

## Qué cambió

- Se modernizaron los **Selectores de Contexto del TopBar** (`.compact-select`) con cápsulas *Clay* individuales y el **Menú de Exportación** con *glassmorphism* de $16\text{px}$ y botones de $\ge 42\text{px}$.
- Se certificó la inviolabilidad de los 29 archivos del motor matemático.

## Cómo verificar

```bash
node scripts/check-protected-baseline.mjs
```

Resultado: Frontera protegida intacta (29 archivos verificados).
