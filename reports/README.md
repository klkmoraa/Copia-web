# Reportes, handoffs y evidencia de ejecución

**Clasificación del directorio:** `AUDIT/TEMPORARY`

Los archivos bajo `reports/**` registran qué se ejecutó, observó o entregó en una fecha concreta. Sirven para auditoría, trazabilidad entre agentes y reconstrucción de decisiones; nunca son fuente de verdad vigente sobre capacidades, arquitectura, calidad o certificación.

Reglas de uso:

- Contrastar cualquier afirmación con el código, las pruebas y los gates actuales.
- No usar un reporte de fase, una captura o un conteo antiguo como prueba de implementación presente.
- No reescribir ni borrar reportes históricos para hacerlos coincidir con el producto actual.
- Crear un solo reporte coherente por tarea relevante y enlazar la documentación canónica cuando corresponda.
- Tratar `reports/evidence/**` como evidencia visual o instrumental de su ejecución, no como especificación.

La jerarquía y clasificación completas viven en [docs/README.md](../docs/README.md). El estado breve del producto vive en el [README principal](../README.md).
