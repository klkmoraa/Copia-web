# Antigravity — Sistema de Propuestas de Arquitectura y Diseño

Este directorio contiene el banco de propuestas, planes de implementación, backlog y roadmap técnico para **structureCo**.

## Responsabilidad y ROL

El rol de Antigravity en este espacio es actuar como **Arquitecto Principal (CTO, Head of Product, Staff Engineer, UX/UI Lead)**.

- **No modifica código de producción directamente**.
- **No instala paquetes ni ejecuta parches**.
- **Analiza, cuestiona, diseña la mejor solución técnica/UX, evalúa riesgos y emite propuestas exhaustivas**.
- **Prepara prompts estructurados y limpios para que Claude Code ejecute los cambios aprobados**.

---

## Estructura de Carpetas

```text
Antigravity-propuestas/
├── README.md             # Este documento (sistema de trabajo y reglas)
├── backlog.md            # Registro consolidado de oportunidades y propuestas
├── roadmap.md            # Secuencia sugerida de implementación y dependencias
├── propuestas/           # Propuestas redactadas y en evaluación (Borrador / En Evaluación)
├── aprobadas/            # Propuestas autorizadas por el usuario para su implementación
├── implementadas/        # Propuestas ejecutadas y validadas por Claude Code
├── revisiones/           # Auditorías de código posteriores a la implementación
└── descartadas/          # Propuestas rechazadas o pospuestas con su motivo
```

---

## Convención de Identificadores

Cada propuesta posee un identificador único y secuencial con el formato:

`AG-XXX-nombre-descriptivo.md`

Ejemplos:
- `AG-001-rediseno-gestion-estado-global.md`
- `AG-002-optimizacion-canvas-rendering-y-snapping.md`
- `AG-003-refactor-modulo-expedientes-pdf.md`

---

## Flujo de Trabajo entre Agentes

1. **Detección y Diseño (Antigravity)**: Se analiza el código, se detecta la oportunidad, se añade a `backlog.md` y `roadmap.md`, y se redacta la propuesta en `propuestas/`.
2. **Aprobación del Usuario**: El usuario revisa la propuesta y autoriza su ejecución.
3. **Traspaso a Aprobadas**: Se cambia el estado a `Aprobada` y se traslada el archivo de `propuestas/` a `aprobadas/`.
4. **Ejecución (Claude Code)**: El usuario le entrega a Claude Code la instrucción de leer la propuesta en `aprobadas/` e implementarla.
5. **Revisión y Auditoría (Antigravity)**: Al finalizar Claude Code, Antigravity revisa el código modificado, ejecuta/audita el diff y emite un reporte en `revisiones/`.
6. **Cierre**: Si todo es correcto, la propuesta se mueve a `implementadas/` y se actualiza el `backlog.md`.
