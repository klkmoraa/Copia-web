# Esquema de lecciones de Aula - Fase 10

## Propósito

Una lección de Aula organiza una actividad sobre el mismo workspace, proyecto, selección, historial y resultado que usa el modo Completo. El contenido conduce el recorrido **Construye → Define → Predice → Analiza → Compara → Concluye**; no contiene un modelo estructural alterno, no calcula resultados y no modifica contratos del dominio.

El esquema debe ser versionable, validable y localizable. Su validación comprueba estructura editorial, referencias y accesibilidad. La estabilidad, el equilibrio, la respuesta y los avisos siguen siendo responsabilidad exclusiva del motor y las validaciones actuales.

## Frontera protegida

| Dato | Fuente de verdad | Uso permitido por Aula |
| --- | --- | --- |
| Geometría, apoyos, propiedades y cargas | Proyecto actual | Leer, seleccionar y proponer la herramienta existente. |
| IDs de nodos, miembros, casos y combinaciones | Contratos actuales | Referenciar sin renombrar, regenerar ni duplicar. |
| Estado de preparación | Progreso y validaciones existentes | Presentar el siguiente paso; no declarar estabilidad por heurística editorial. |
| Análisis, issues y explicación | Resultado real del solver | Revelar, localizar y explicar la evidencia recibida. |
| Predicciones y reflexiones | Sesión de Aula | Mantener como borrador pedagógico, fuera del proyecto y de undo/redo. |
| Unidades y formato | Sistema de unidades y formatters de presentación | Mostrar unidades activas sin alterar el valor almacenado. |
| Visibilidad, paso y nivel de detalle | Estado de interfaz | Persistir sólo como preferencia de presentación cuando corresponda. |

Una lección nunca incluye matrices resueltas, reacciones esperadas, diagramas precalculados ni tolerancias propias. Una respuesta de autor puede describir el razonamiento que se espera observar, pero la comparación cuantitativa siempre consume el análisis vigente.

## Documento raíz

La siguiente forma es normativa a nivel conceptual. Los nombres de campo son estables en inglés para facilitar interoperabilidad; el contenido visible se resuelve mediante `copy` localizado.

```ts
type LessonDocument = {
  schemaVersion: '1.0';
  id: string;
  revision: number;
  status: 'draft' | 'review' | 'published' | 'retired';
  defaultLocale: 'es';
  supportedLocales: Array<'es' | 'en'>;
  metadata: LessonMetadata;
  learningObjectives: LocalizedText[];
  prerequisites?: LessonPrerequisite[];
  modelSource: ModelSource;
  stages: [BuildStage, DefineStage, PredictStage, AnalyzeStage, CompareStage, ConcludeStage];
  glossary?: GlossaryEntry[];
  attribution: Attribution;
};
```

### Identidad y versión

| Campo | Regla |
| --- | --- |
| `schemaVersion` | Versión del contrato. Cambia sólo cuando cambia la forma o semántica del documento. |
| `id` | Identificador estable, minúsculas y guiones; no depende del título traducido. |
| `revision` | Entero creciente para cambios de contenido bajo el mismo contrato. |
| `status` | Sólo `published` se ofrece por defecto a estudiantes. `retired` conserva trazabilidad. |
| `defaultLocale` | `es` en la primera versión. Nunca se infiere del navegador para validar el contenido fuente. |
| `supportedLocales` | Debe contener `es` y `en` antes de publicar. No admite una traducción parcial silenciosa. |

Una migración de schema debe ser explícita, determinista y reversible. No se reinterpreta un documento desconocido con valores por defecto. Si `schemaVersion` no es compatible, Aula bloquea la lección, explica el impacto y ofrece volver al selector.

## Tipos compartidos

```ts
type LocalizedText = {
  es: string;
  en: string;
};

type LessonMetadata = {
  title: LocalizedText;
  summary: LocalizedText;
  level: 'introductory' | 'intermediate' | 'advanced';
  estimatedMinutes?: number;
  technicalTopics: string[];
  authors: string[];
  reviewedBy?: string[];
  lastReviewedAt: string; // ISO 8601
};

type LessonPrerequisite = {
  kind: 'concept' | 'lesson' | 'capability';
  ref: string;
  label: LocalizedText;
};

type ModelSource =
  | { kind: 'current-project' }
  | { kind: 'bundled-example'; exampleId: string }
  | { kind: 'template'; templateId: string };

type Attribution = {
  sourceTitle?: string;
  sourceUrl?: string;
  authors: string[];
  license: string;
  adaptationNote?: LocalizedText;
  verificationNote: LocalizedText;
};
```

`modelSource` invoca rutas de apertura/importación ya existentes. No embebe otra representación del modelo dentro de la lección. Una plantilla puede sugerir un punto de partida, pero después de abrirse existe un solo proyecto editable.

## Etapas y orden canónico

```ts
type LessonStageId = 'build' | 'define' | 'predict' | 'analyze' | 'compare' | 'conclude';
type DetailLevel = 'summary' | 'steps' | 'full';

type LessonStageBase = {
  id: LessonStageId;
  title: LocalizedText;
  purpose: LocalizedText;
  tasks: LessonTask[];
  completion: CompletionRule;
  blockedCopy?: LocalizedText;
};
```

| ID estable | Rótulo ES / EN | Decisión de la persona | Evidencia de finalización |
| --- | --- | --- | --- |
| `build` | Construye / Build | ¿Qué sistema estructural representará el ejercicio? | El modelo actual contiene la geometría requerida o la persona confirma la observación solicitada. |
| `define` | Define / Define | ¿Qué apoyos, cargas, casos y propiedades representan el problema? | Las acciones editoriales requeridas se completan y las validaciones actuales no reportan el bloqueo indicado. |
| `predict` | Predice / Predict | ¿Qué signo, forma, ubicación o tendencia se espera antes del cálculo? | Existe una respuesta explícita o se elige `No puedo predecir todavía` con justificación; nunca se rellena con cero. |
| `analyze` | Analiza / Analyze | ¿El modelo se resuelve y qué avisos afectan su interpretación? | Termina el análisis real vigente; el fallo conduce a Avisos, no salta a comparar. |
| `compare` | Compara / Compare | ¿En qué coincide o difiere la predicción del resultado? | Se revisa evidencia vinculada y se registra una observación. |
| `conclude` | Concluye / Conclude | ¿Qué principio explica la respuesta y qué cambiaría al modificar el modelo? | Se registra una conclusión y se ofrece el siguiente ejercicio o volver al workspace. |

Las seis etapas son obligatorias y aparecen una vez, en ese orden. Una etapa puede ser breve, pero no se elimina para adelantar el resultado.

## Tareas

```ts
type LessonTask = {
  id: string;
  kind:
    | 'instruction'
    | 'choose-tool'
    | 'select-entity'
    | 'inspect-property'
    | 'prediction'
    | 'run-analysis'
    | 'inspect-result'
    | 'explain-evidence'
    | 'reflection';
  copy: {
    prompt: LocalizedText;
    helper?: LocalizedText;
    success?: LocalizedText;
  };
  detail: Partial<Record<DetailLevel, LocalizedContent>>;
  target?: LessonTarget;
  evidence?: EvidenceBinding[];
  action?: LessonAction;
  accessibility: AccessibilityCopy;
};

type LocalizedContent = {
  es: string[];
  en: string[];
};

type LessonAction =
  | { kind: 'tool'; toolId: string }
  | { kind: 'result-tab'; tabId: string }
  | { kind: 'analyze' }
  | { kind: 'select'; target: LessonTarget }
  | { kind: 'none' };

type LessonTarget =
  | { kind: 'node' | 'member' | 'load' | 'case' | 'combination'; id: string }
  | { kind: 'current-selection' }
  | { kind: 'all-model' };
```

`toolId`, `tabId` y los IDs de entidad deben validarse contra catálogos o datos vigentes. La ausencia de una referencia no se corrige eligiendo el primer elemento disponible: la tarea se muestra bloqueada con una salida segura.

### Niveles de detalle

Cada tarea debe soportar tres niveles sin cambiar el objetivo ni la respuesta:

- `summary`: decisión, dato gobernante y siguiente acción.
- `steps`: secuencia razonada, relaciones y ecuaciones esenciales.
- `full`: entradas, convenciones, ecuaciones, salidas, unidades y referencias completas.

Los tres niveles consumen la misma evidencia. Cambiar de nivel no vuelve a analizar, no altera selección y no marca una tarea como completada.

## Predicción antes del cálculo

```ts
type PredictionTask = LessonTask & {
  kind: 'prediction';
  prediction: {
    responseType: 'number' | 'sign' | 'shape' | 'location' | 'choice' | 'text';
    quantity?: 'axial' | 'shear' | 'moment' | 'displacement' | 'reaction';
    unitKind?: 'force' | 'moment' | 'length' | 'rotation';
    choices?: Array<{ id: string; label: LocalizedText }>;
    allowUnsure: true;
    requiresRationale?: boolean;
  };
};
```

Reglas de revelado:

1. La predicción se presenta antes de ejecutar o revelar el análisis de esta sesión.
2. Un input vacío permanece vacío; nunca se interpreta como cero.
3. La unidad visible acompaña cualquier entrada numérica. Cambiar unidades convierte sólo la presentación de la predicción y del resultado.
4. El usuario puede declarar incertidumbre. Esa elección no inventa un valor ni bloquea permanentemente el ejercicio.
5. Revelar es una acción deliberada. No ocurre al cambiar de selección, tab, viewport o nivel de detalle.
6. Volver a editar el modelo marca la evidencia anterior como desactualizada y exige un nuevo análisis antes de comparar.

## Evidencia real y trazabilidad

```ts
type EvidenceBinding = {
  id: string;
  source: 'project' | 'selection' | 'analysis' | 'analysis-explanation' | 'issue';
  target?: LessonTarget;
  path?: string;
  presentation: {
    label: LocalizedText;
    detailLevels: DetailLevel[];
    showUnit: boolean;
    locateInCanvas?: boolean;
  };
  freshness: 'current-analysis-required' | 'project-current';
};
```

- `path` sólo puede pertenecer a una lista permitida por versión; no evalúa expresiones ni ejecuta código.
- Una evidencia de `analysis` exige `analysis.success === true` y correspondencia con la revisión actual del modelo.
- `analysis-explanation` presenta los pasos, entradas, ecuaciones, salidas e IDs relacionados que ya produce el análisis.
- `issue` enlaza el aviso real y su objeto cuando exista. La lección no rebaja su severidad ni reemplaza la acción sugerida.
- Localizar evidencia usa selección y cursor compartidos. No crea selecciones, estaciones ni magnitudes alternativas.
- Los números se convierten y formatean para visualización. El valor fuente conserva toda su precisión.

## Reglas de finalización

```ts
type CompletionRule =
  | { kind: 'manual-confirmation' }
  | { kind: 'all-tasks-complete' }
  | { kind: 'existing-progress'; stepId: 'geometry' | 'supports' | 'loads' | 'analysis' }
  | { kind: 'prediction-recorded'; taskId: string }
  | { kind: 'analysis-current-and-successful' }
  | { kind: 'reflection-recorded'; taskId: string };
```

Las reglas sólo observan estado existente o interacciones pedagógicas. No duplican validaciones estructurales. `manual-confirmation` sirve para una observación cualitativa, nunca para declarar resuelto o estable un modelo.

## Defaults, bloqueo e hiperestaticidad

Una lección debe declarar la intención cuando usa propiedades por defecto, pero no redefinir esos valores.

```ts
type ClassroomNotice = {
  id: string;
  trigger:
    | { kind: 'uses-existing-default'; property: string }
    | { kind: 'existing-issue'; issueCode: string }
    | { kind: 'classroom-edit-lock'; scope: string };
  severity: 'info' | 'warning' | 'blocking';
  title: LocalizedText;
  impact: LocalizedText;
  action: LocalizedText;
};
```

- Un default se describe como supuesto activo, no como dato ingresado por la persona.
- En estructuras hiperestáticas se advierte que la distribución de esfuerzos depende de propiedades mecánicas. La advertencia remite a modo Completo para revisarlas; no asigna ni corrige E, A, I o G·As.
- Un campo bloqueado explica qué se conserva y cómo cambiar a Completo. No aparenta estar editable ni pierde su valor.
- Un issue del motor conserva severidad, identidad y acción. El texto de Aula puede contextualizarlo, no sustituirlo.

## Accesibilidad del schema

```ts
type AccessibilityCopy = {
  label: LocalizedText;
  description?: LocalizedText;
  announcedOnComplete?: LocalizedText;
  visualAlternative?: LocalizedText;
};
```

Todas las tareas interactivas deben tener nombre accesible localizado. Una gráfica, ecuación, diagrama o cambio de color requiere alternativa textual que identifique entidad, magnitud, tendencia, valor y unidad relevantes. El orden de tareas es también el orden de lectura; una lección no define `tabIndex` positivo.

El contenido no controla focus trap, retorno de foco, shortcuts ni live regions. Esas responsabilidades pertenecen a la superficie de Aula, que debe anunciar cambio de etapa y resultado de validación sin leer de nuevo todo el documento.

## Validación y diagnósticos

La carga de una lección valida, como mínimo:

1. `schemaVersion`, `id`, `revision` y estado reconocibles.
2. Seis etapas únicas, completas y en el orden canónico.
3. IDs de tarea únicos y referencias internas existentes.
4. Paridad ES/EN en todo texto visible, nombres accesibles y alternativas.
5. Acciones y paths pertenecientes a listas permitidas.
6. Predicción ubicada antes de cualquier `run-analysis` o evidencia revelada.
7. Comparación ligada a evidencia real y vigente.
8. Atribución, licencia y fecha de revisión presentes.
9. Ausencia de resultados precalculados, scripts o HTML arbitrario.
10. Notices requeridos para defaults, bloqueos de Aula e hiperestaticidad según la intención editorial.

Los errores usan la forma **problema → impacto → acción**, incluyen `lessonId`, `stageId` y `taskId` cuando existan, y nunca aplican una reparación destructiva. Ejemplo: `Falta la traducción en inglés de predict-shape → la lección no puede publicarse en EN → completa copy.prompt.en.`

## Estado de sesión

La sesión no forma parte de `LessonDocument` ni del proyecto estructural.

```ts
type LessonSession = {
  lessonId: string;
  lessonRevision: number;
  currentStage: LessonStageId;
  completedTaskIds: string[];
  revealState: 'hidden' | 'predicting' | 'revealed';
  predictions: Record<string, unknown>;
  reflections: Record<string, string>;
  detailLevel: DetailLevel;
  analysisRevision?: string;
};
```

Al cambiar de proyecto se carga la sesión pedagógica asociada a ese proyecto. Al editar el modelo después de revelar, el intento queda invalidado: se ocultan los resultados y se limpian predicción, comparación y conclusión para exigir una nueva hipótesis antes del siguiente análisis. Este reinicio afecta sólo datos pedagógicos y nunca ejecuta undo ni modifica el proyecto.

## Ejemplo mínimo ilustrativo

```json
{
  "schemaVersion": "1.0",
  "id": "viga-simple-signo-momento",
  "revision": 1,
  "status": "draft",
  "defaultLocale": "es",
  "supportedLocales": ["es", "en"],
  "metadata": {
    "title": { "es": "Signo del momento en una viga simple", "en": "Moment sign in a simple beam" },
    "summary": { "es": "Predice y comprueba la forma de M.", "en": "Predict and verify the shape of M." },
    "level": "introductory",
    "technicalTopics": ["momento-flector", "signos"],
    "authors": ["structureCo"],
    "lastReviewedAt": "2026-07-22"
  },
  "learningObjectives": [
    { "es": "Relacionar carga, apoyos y signo de M.", "en": "Relate load, supports, and the sign of M." }
  ],
  "modelSource": { "kind": "bundled-example", "exampleId": "simple-beam" },
  "stages": [
    { "id": "build", "title": { "es": "Construye", "en": "Build" }, "purpose": { "es": "Reconoce la geometría.", "en": "Recognize the geometry." }, "tasks": [], "completion": { "kind": "existing-progress", "stepId": "geometry" } },
    { "id": "define", "title": { "es": "Define", "en": "Define" }, "purpose": { "es": "Verifica apoyos y carga.", "en": "Verify supports and load." }, "tasks": [], "completion": { "kind": "existing-progress", "stepId": "loads" } },
    { "id": "predict", "title": { "es": "Predice", "en": "Predict" }, "purpose": { "es": "Anticipa el signo de M.", "en": "Anticipate the sign of M." }, "tasks": [], "completion": { "kind": "prediction-recorded", "taskId": "predict-moment-shape" } },
    { "id": "analyze", "title": { "es": "Analiza", "en": "Analyze" }, "purpose": { "es": "Resuelve el modelo actual.", "en": "Solve the current model." }, "tasks": [], "completion": { "kind": "analysis-current-and-successful" } },
    { "id": "compare", "title": { "es": "Compara", "en": "Compare" }, "purpose": { "es": "Contrasta la predicción con M real.", "en": "Contrast the prediction with the actual M." }, "tasks": [], "completion": { "kind": "all-tasks-complete" } },
    { "id": "conclude", "title": { "es": "Concluye", "en": "Conclude" }, "purpose": { "es": "Explica la relación observada.", "en": "Explain the observed relationship." }, "tasks": [], "completion": { "kind": "reflection-recorded", "taskId": "conclusion" } }
  ],
  "attribution": {
    "authors": ["structureCo"],
    "license": "Project documentation license",
    "verificationNote": { "es": "Los valores se obtienen del análisis activo.", "en": "Values come from the active analysis." }
  }
}
```

El ejemplo ilustra la forma, no autoriza los IDs de plantilla o lección sin comprobarlos contra los catálogos reales.

## Criterios de aceptación

- El documento se valida antes de mostrarse y rechaza versiones incompatibles de manera segura.
- Construye, Define, Predice, Analiza, Compara y Concluye son visibles y conservan su orden.
- Ningún resultado se revela antes de una predicción o decisión explícita de incertidumbre.
- Toda comparación usa el resultado vigente, IDs existentes, unidades visibles y precisión presentacional.
- Resumen, paso a paso y completo explican la misma evidencia sin duplicarla.
- Defaults, propiedades bloqueadas e hiperestaticidad se advierten sin cambiar valores ni validaciones.
- ES y EN tienen paridad semántica, nombres accesibles y atribución.
- La sesión de Aula nunca entra al schema del proyecto, persistencia estructural ni historial undo/redo.
