# Fase 4: dependencias y gates

> **HISTORICAL** — Esta matriz conserva el corte de Fase 4. Para el estado vigente consulta el [mapa de arquitectura](README.md), el contrato [S3D-1](structureco-space-3d-s3d1.md) y los gates ejecutables.

**Clasificación:** `HISTORICAL`

**Fecha de corte:** 2026-08-09
**Base:** `6233286806f7029936e52d98fe3a8e53825b2a94` + cambios Fase 4 verificados antes del commit local
**Regla:** un documento histórico o pre-RFC demuestra diseño, no implementación ni certificación.

## Estados

- `PASA`: evidencia ejecutable actual y gate satisfecho para el alcance indicado.
- `PASA INFORMATIVO`: la evidencia se ejecuta y se reporta, pero no impone un techo bloqueante.
- `PARCIAL`: existe una parte verificable, pero faltan controles o alcance requerido.
- `NO EXISTE`: no hay implementación actual.
- `NO PASA`: el gate requiere evidencia que no existe o falló.
- `REQUIERE INVESTIGACIÓN`: falta una decisión basada en fuentes o mediciones.

## Matriz

| ID | Capacidad / dependencia | Evidencia actual | Estado | Responsable del siguiente gate | Siguiente evidencia |
|---|---|---|---|---|---|
| F4-BASE-2D | Frontera matemática 2D | `npm.cmd run verify:protected`: 29 archivos intactos; `npm.cmd run verify` completo | PASA | mantenedor del solver | conservar baseline sin actualizar |
| F4-3D-VIEW | Visor `(x,y,0)` no autoritativo | **Retirado del producto.** Space 3D es la única superficie 3D; el módulo `src/features/experimental3d` ya no existe | SUSTITUIDO por S3D-1 | producto | ninguna: la capacidad la cubre `F4-3D-MODEL` |
| F4-3D-MODEL | `AnalysisSpace`, `z`, 6 GDL y propiedades 3D | `src/space3d/model` con contratos discriminados, límites y validación fail-closed | PASA para S3D-1 | arquitectura estructural | ampliar sólo con ADR para S3D-2 |
| F4-3D-NUM | Formulación/ensamblaje 3D | Elemento 12×12, ensamblaje y solver; 5 casos manuales con derivación cerrada, invariantes y guardas de mutación comprobadas provocando el fallo | PASA para S3D-1 | ingeniería numérica | mantener el corpus al ampliar el alcance |
| F4-3D-ORACLE | Validación independiente | OpenSees 3.8.0 y PyNite 3.0.0 ejecutados sobre los 5 casos: coinciden a precisión de máquina (peor discrepancia `4,2e-12` sobre `66,4 kN·m`). Frame3DD sigue `NOT_RUN` por ejecutable inalcanzable | PASA con dos oráculos independientes | validación estructural | añadir Frame3DD cuando haya binario o toolchain |
| F4-3D-DATA | Persistencia/portable 3D | Códec estricto con allowlist, almacenamiento con copia de seguridad y claves propias por proyecto de origen; el portable 2D sigue sin conocer 3D | PASA para S3D-1 | arquitectura de datos | migración entre versiones de esquema cuando exista la segunda |
| F4-3D-WORKER | Protocolo/capacidad 3D | Protocolo versionado propio, worker aislado, cancelación real y capacidad medida 150/300 con `verify:space3d` | PASA para S3D-1 | plataforma | revisar la política si sube el techo de capacidad |
| F4-3D-A11Y | Semántica y fallback de la superficie | Resumen semántico permanente junto al lienzo, teclado, foco visible, touch 44 px, 390×844, temas y reducción de movimiento comprobados en navegador | PASA para el alcance probado | accesibilidad | prueba manual con tecnología de asistencia antes de afirmarla |
| F4-CMD | Comandos reversibles | `ProjectCommand`, compile/apply y undo actuales | PASA para subcapacidad existente | arquitectura de comandos | ampliar sólo tras schema/evals de IA |
| F4-ANCHOR | Procedencia de explicaciones | Resolver interno de anchors sobre resultados almacenados | PARCIAL | arquitectura de resultados | snapshot/versionado/portable oficial |
| F4-AI-SCHEMA | `CommandProposal` cerrado | JSON Schema normativo en pre-RFC | NO EXISTE en producto | seguridad de aplicación | implementación local y tests negativos |
| F4-AI-BROKER | Broker servidor DeepSeek | Arquitectura propuesta; sin servicio, SDK o secreto | NO EXISTE | plataforma + seguridad | threat model, servicio y kill switch |
| F4-AI-EVAL | Corpus adversarial y métricas | Criterios definidos; harness ausente | NO EXISTE | seguridad + QA | evals reproducibles con cero escapes |
| F4-AI-VENDOR | Privacidad, retención y coste | Documentación técnica consultada | REQUIERE INVESTIGACIÓN | legal/privacidad + operaciones | evaluación contractual y de datos |
| F4-OPS-BUNDLE | Medición de carga inicial | 711 442 bytes / 188 963 gzip; visor 553 398 bytes, `eager:false`; Three.js ausente del entry; `verify:perf` conserva la medición sin techo duro | PASA INFORMATIVO | frontend performance | vigilar la métrica y reintroducir un techo sólo mediante una decisión explícita |
| F4-OPS-RELEASE | CI/release reproducible | Verificación local completa; F4 no publicada por alcance | PARCIAL | release engineering | publicación sólo con autorización explícita |

## Evidencia de cierre experimental

- Pruebas focalizadas: 8 archivos, 50 pruebas aprobadas.
- Suite completa: 119 archivos, 811 aprobadas y 3 omitidas de 814.
- Build: aprobado mediante `npm.cmd run verify`; rendimiento: medición registrada por `verify:perf` sin techo bloqueante.
- Navegador real: 1440×900 y 390×844; claro/oscuro; español/inglés; poblado/vacío; controles de cámara; pérdida y reintento de WebGL.
- Evidencia visual: `reports/evidence/2026-08-09-fase-4/`.
- Alcance de accesibilidad: se comprobó DOM accesible, teclado, foco, touch y movimiento reducido; no se afirma compatibilidad con lector de pantalla no probado.

## Dependencias y orden

```text
Visor experimental F4
  -> baseline protegida intacta
  -> tests de adaptador/ciclo de vida/navegación
  -> build y chunk lazy
  -> QA visual y accesible

Motor 3D futuro
  -> ADR de contratos
  -> derivación y oráculos
  -> tipos/versionado/workers
  -> prototipo experimental
  -> capacidad y UX completa
  -> gate de producción

IA futura
  -> schema + threat model
  -> validadores/conversión local
  -> preview + snapshot binding
  -> broker + privacidad
  -> corpus adversarial + kill switch
  -> experimento limitado
  -> gate de producción
```

## Decisión de fase

- **Visor 3D:** `IMPLEMENTADO EXPERIMENTAL / NO AUTORITATIVO`.
- **Análisis estructural 3D:** `NO IMPLEMENTADO / GATE NO PASA`.
- **IA:** `PRE-RFC COMPLETO / PRODUCTO NO IMPLEMENTADO`.
- Ningún gate de esta matriz autoriza modificar solver, datos persistidos o conectar un proveedor.
