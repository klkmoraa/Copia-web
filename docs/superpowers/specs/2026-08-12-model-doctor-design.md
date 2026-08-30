# Model Doctor — diseño de ingeniería

**Clasificación:** `HISTORICAL`

> **HISTORICAL** — Diseño ejecutado; conserva decisiones y evidencia de su momento, no certifica el estado actual por sí solo.

**Baseline:** `2cef4d65862f0c057bb618f7c80a25756c8c1ecb` (`main`)

## Objetivo

Model Doctor es una superficie preventiva del Workspace 2D que traduce los diagnósticos existentes en findings accionables antes de analizar. No introduce validadores, solver, schema ni persistencia alternos.

## Enfoques evaluados

1. **Adapter + surface lazy + reparación preparada (elegido).** Mantiene `validateProject` y `repairProjectTopology` como autoridades, comparte sólo la resolución de targets con Results y usa un comando topológico específico para historial/undo.
2. **Reutilizar `IssuesView` dentro de Results.** Se descartó porque requiere `analysis`, arrastra dependencias de resultados y no ofrece preview ni una experiencia preflight autónoma.
3. **Nuevo store/validador del Doctor.** Se descartó porque duplicaría dominio, estado y costes de arranque.

## Arquitectura

```text
WorkspaceShell
├─ launchers secundarios → workspace command open-model-doctor
├─ ModelDoctorSurface (lazy, Drawer modal)
│  ├─ modelDoctorDiagnostics → validateProject
│  ├─ issueTarget → selection + focus-object
│  └─ topologyRepairPreview → prepared topology.repair
└─ ProjectContext
   └─ executePreparedTopologyRepair → one history intent + invalidation

topology.repair
├─ repairProjectTopology(draft)
├─ forward/inverse patches
├─ TopologyRepairReport
└─ exact source/repaired snapshot guards
```

## Contrato de diagnóstico

Cada `ValidationIssue` se adapta sin modificar el tipo global a un finding determinista con ID visible estable, severidad `critical|warning|suggestion`, categoría, explicación original, impacto específico de su familia, acción/herramienta sugerida, objetos afectados, target localizable, reparabilidad y reconocimiento permitido. `error|warning|info` se mapea respectivamente a `critical|warning|suggestion`.

Las categorías son `geometry`, `topology`, `properties`, `supports`, `loads`, `references` y `configuration`. La clasificación se basa en los IDs y datos ya emitidos; no reproduce las condiciones numéricas de validación.

## Localización

Una función pura neutral resuelve `objectKind/objectId` contra el proyecto para `node`, `member`, `nodalLoad` y `memberLoad`. Results y Model Doctor consumen la misma función. Model Doctor selecciona y emite el comando existente `focus-object`; cierra el Drawer para devolver el canvas al usuario. Una referencia que no tiene geometría resoluble se declara no localizable.

## Preview y reparación

El preview clona el proyecto, ejecuta una vez `repairProjectTopology`, compila patches forward/inverse y conserva:

- snapshot fuente exacto;
- snapshot reparado exacto;
- `TopologyRepairReport`;
- merges y splits;
- remapeos de cargas, prescribed displacements e initial effects;
- cambios de releases, resortes y offsets observables en los miembros resultantes.

Preview no publica cambios. Apply usa el artefacto preparado; compara el snapshot fuente completo, aplica el patch ya mostrado y confirma el snapshot reparado. Si cualquier parte del proyecto cambió, rechaza atómicamente y exige regenerar. No existe un bus genérico de patches para la UI.

## Historial

Aplicar un preview válido crea una sola entrada mediante la frontera reversible existente e invalida analysis. Undo restaura el snapshot fuente completo; redo restaura el snapshot reparado completo. Abrir/cerrar, localizar, explicar, reconocer y previsualizar son estado de presentación y no generan historia ni invalidación.

## UX y responsive

El launcher vive como primera acción de `Más → Análisis` y como comando de Command Palette; no se añade un control permanente a TopBar. La surface usa el Drawer del design system: derecha en desktop/tablet y bottom sheet en phone. Preview es un paso interno, no un modal anidado. El fondo se vuelve `inert` y `aria-hidden`, Escape cierra, el foco queda atrapado y vuelve al launcher. El contenido usa tokens Clay existentes y scroll interno.

## Testing

Cada milestone sigue RED → implementación mínima → focal GREEN → evaluación adversarial. Las pruebas cubren adapter, targets, UI, preview/apply, stale global, atomicidad, orden exacto, undo/redo, invalidación, convivencia con `analyze()`, browser real, responsive, Day/Night, teclado y performance/lazy loading.

## Deliberadamente fuera de alcance

No se cambia `validateProject`, `repairProjectTopology`, matemática/ensamblaje del solver, mecanismos por null-space, worker protocol, schema, migraciones, persistencia, formatos, Results general, PDF ni Space 3D. La implementación final extrajo la decisión estática existente de grounding para compartirla con el preflight, sin crear un detector de mecanismos. El QA general descubrió y caracterizó un bug táctil adyacente del Canvas: en selección, el gesto touch debe respetar el filtro y resolverse antes del picker de solapes. El contrato actual por el cual `analyze()` puede reparar topología se conserva.
