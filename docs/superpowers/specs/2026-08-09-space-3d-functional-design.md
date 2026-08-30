# Space 3D funcional — diseño para revisión

> **HISTORICAL** — Diseño previo a la implementación conservado. El contrato vigente está en [Space 3D · S3D-1](../../architecture/structureco-space-3d-s3d1.md).

**Clasificación:** `HISTORICAL`

**Fecha:** 2026-08-09
**Producto base:** structureCo `0.8.2`
**Base Git:** `fcbca272c1e01d8cf2c00f8aaaa6943d8d78e618`
**Estado:** arquitectura seleccionada por continuidad del objetivo; pendiente de revisión del documento antes del plan ejecutable

## 1. Objetivo y definición de funcional

Crear una capacidad estructural 3D real, separada del dominio 2D vigente. Una entrega se considera funcional cuando una persona puede crear un proyecto espacial, introducir nodos XYZ, miembros, apoyos y cargas nodales, ejecutar un análisis estático lineal, inspeccionar desplazamientos, reacciones y fuerzas locales de extremo, visualizar la geometría original/deformada, guardar el proyecto, cerrarlo y abrirlo de nuevo sin pérdida.

El visor experimental `(x,y,0)` existente no satisface esta definición: seguirá disponible como proyección no autoritativa mientras se construye el espacio estructural nuevo.

## 2. Decisión de arquitectura

Se adopta un motor 3D nativo, aislado y escrito en TypeScript. OpenSees y Frame3DD serán oráculos de comparación; no serán dependencias de ejecución del producto.

```text
Producto 2D vigente                    Capacidad Space 3D
ProjectModel                           Space3DProjectV1
solver.ts                              src/space3d/engine/**
analysis.worker.ts                     src/space3d/runtime/space3d.worker.ts
ProjectContext                         src/space3d/store/Space3DProjectContext.tsx
SVG StructuralCanvas                  Space3DWorkspace + ThreeViewport
portable 2D                            portable Space 3D versionado
```

No se generalizará el solver 2D con ramas `if (is3D)`, no se añadirá `z?` a `NodeModel` y no se reutilizarán resultados 2D para representar seis GDL. El modo 2D conservará sus tipos, resultados, persistencia, workers, snapshots, undo/redo y formatos actuales.

## 3. Programa y cortes verticales

El objetivo completo se divide en capacidades que dejan software ejecutable después de cada gate:

1. **S3D-1 · Marco espacial lineal funcional:** dominio, orientación, elemento Euler–Bernoulli, cargas nodales, apoyos binarios, solver, worker, persistencia, editor y resultados.
2. **S3D-2 · Acciones y conexiones:** cargas de miembro, peso propio, desplazamientos impuestos, releases, resortes, offsets y recuperación continua de diagramas.
3. **S3D-3 · Paridad de producto:** combinaciones/envolventes completas, PDF, Aula, importadores explícitos, capacidad y accesibilidad asistiva.
4. **S3D-4 · Extensiones físicas futuras:** Timoshenko, P-Delta 3D, dinámica, placas, sólidos o no linealidad; cada una exige un RFC y corpus propios.

El primer plan implementará S3D-1 completo. No declarará terminados S3D-2–S3D-4.

## 4. Contrato de datos S3D-1

```ts
type Space3DDof = 'ux' | 'uy' | 'uz' | 'rx' | 'ry' | 'rz';
type Space3DVector = readonly [x: number, y: number, z: number];

interface Space3DProjectV1 {
  readonly schemaVersion: 1;
  readonly analysisSpace: 'space-3d';
  readonly id: string;
  readonly name: string;
  readonly units: UnitSystemId;
  readonly nodes: readonly Space3DNode[];
  readonly members: readonly Space3DFrameMember[];
  readonly loadCases: readonly Space3DLoadCase[];
  readonly combinations: readonly Space3DLoadCombination[];
  readonly nodalLoads: readonly Space3DNodalLoad[];
}

interface Space3DNode {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly restraints: Readonly<Record<Space3DDof, boolean>>;
}

interface Space3DFrameMember {
  readonly id: string;
  readonly i: string;
  readonly j: string;
  readonly E: number;
  readonly G: number;
  readonly A: number;
  readonly Iy: number;
  readonly Iz: number;
  readonly J: number;
  readonly orientation: {
    readonly localYReferenceGlobal: Space3DVector;
    readonly rollRadians: number;
  };
  readonly label?: string;
}

interface Space3DNodalLoad {
  readonly id: string;
  readonly nodeId: string;
  readonly caseId: string;
  readonly fx: number;
  readonly fy: number;
  readonly fz: number;
  readonly mx: number;
  readonly my: number;
  readonly mz: number;
}

interface Space3DLoadCase {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
}

interface Space3DLoadCombination {
  readonly id: string;
  readonly name: string;
  readonly factors: Readonly<Record<string, number>>;
}
```

Los casos y combinaciones usan superposición lineal y factores finitos. S3D-1 sólo admite restricciones homogéneas: un GDL está libre o fijado a cero. Los desplazamientos impuestos entran en S3D-2.

### Unidades internas

Se conserva la base interna del producto: longitud `m`, fuerza `kN`, momento `kN·m`, `E/G` en `kN/m²`, `A` en `m²`, `Iy/Iz/J` en `m⁴`, traslaciones en `m` y rotaciones en `rad`. El selector de unidades sólo transforma entrada y presentación; nunca modifica el contrato interno.

## 5. Ejes y orientación local

El orden de GDL nodales es siempre `[ux, uy, uz, rx, ry, rz]`; el orden del elemento es primero nodo `i` y después nodo `j`.

1. `x = normalize(j - i)`.
2. `y0 = normalize(referenceY - dot(referenceY, x) * x)`.
3. `z0 = normalize(cross(x, y0))`.
4. Para el roll `φ`: `y = cos(φ)y0 + sin(φ)z0` y `z = -sin(φ)y0 + cos(φ)z0`.
5. Deben cumplirse ortonormalidad, determinante positivo y `cross(x,y)=z`.

Se rechazan nodos coincidentes, referencia nula, referencia paralela/casi paralela, roll no finito y toda triada que no pueda normalizarse de forma estable. No se elige silenciosamente un vector “arriba”. S3D-1 fija longitud mínima `1e-9 m`, norma mínima de referencia `1e-12` y razón perpendicular `||referenceY - (referenceY·x)x|| / ||referenceY|| > 1e-8`. Tras normalizar, cada norma y producto punto debe cerrar a `1e-12`, y el determinante debe ser positivo. Estos umbrales son propios del contrato 3D y se someterán a barridos de escala y mutation tests; no reutilizan tolerancias estructurales 2D.

## 6. Formulación y solución S3D-1

El miembro es un frame prismático elástico Euler–Bernoulli de doce GDL. La matriz local contiene cuatro bloques físicos independientes:

- axial `EA/L`;
- torsión `GJ/L`;
- flexión alrededor de `y` con `EIy`;
- flexión alrededor de `z` con `EIz`.

La transformación global se construye a partir de la triada ortonormal. El ensamblaje usa seis GDL por nodo. Los GDL restringidos a cero se eliminan del sistema reducido; el solver recupera después reacciones mediante `R = K·U - F`. La inversión/factorización reutilizará una primitiva lineal existente sólo si puede consumirse sin modificar su contrato 2D; de lo contrario se añadirá una primitiva numérica independiente dentro de `space3d`.

El resultado público será discriminado:

```ts
interface Space3DAnalysisResult {
  readonly analysisSpace: 'space-3d';
  readonly success: boolean;
  readonly issues: readonly Space3DValidationIssue[];
  readonly nodeResults: readonly Space3DNodeResult[];
  readonly memberResults: readonly Space3DMemberResult[];
  readonly diagnostics: Space3DSolverDiagnostics;
}

interface Space3DNodeResult {
  readonly nodeId: string;
  readonly displacement: Readonly<Record<Space3DDof, number>>;
  readonly reaction: Readonly<Record<Space3DDof, number>>;
}

interface Space3DMemberResult {
  readonly memberId: string;
  readonly length: number;
  readonly localDisplacements: readonly [number, number, number, number, number, number, number, number, number, number, number, number];
  readonly endI: Space3DEndAction;
  readonly endJ: Space3DEndAction;
}

interface Space3DEndAction {
  readonly n: number;
  readonly vy: number;
  readonly vz: number;
  readonly t: number;
  readonly my: number;
  readonly mz: number;
}

interface Space3DSolverDiagnostics {
  readonly reducedDofCount: number;
  readonly linearResidual: number;
  readonly equilibriumResidual: number;
  readonly conditionEstimate: number;
}

type Space3DValidationCode =
  | 'schema-invalid'
  | 'resource-limit'
  | 'duplicate-id'
  | 'missing-reference'
  | 'invalid-coordinate'
  | 'zero-length-member'
  | 'invalid-property'
  | 'invalid-orientation'
  | 'no-free-dof'
  | 'mechanism'
  | 'non-finite-result';

interface Space3DValidationIssue {
  readonly code: Space3DValidationCode;
  readonly message: string;
  readonly entityId?: string;
  readonly entityKind?: 'project' | 'node' | 'member' | 'load-case' | 'combination' | 'nodal-load';
}
```

Cada nodo entrega seis desplazamientos y seis reacciones globales. Cada miembro entrega los doce desplazamientos locales y las doce fuerzas de extremo locales. `endI` y `endJ` son las acciones resistentes que el elemento ejerce sobre sus nodos, expresadas en la misma triada local; `n/vy/vz` son positivas hacia `+x/+y/+z` y `t/my/mz` siguen la regla de la mano derecha. Si el sistema es singular, no finito o incompatible, `success=false` y no se publican números como resultados utilizables.

## 7. Worker y control de ejecución

`src/space3d/runtime/space3d.worker.ts` tendrá un protocolo versionado distinto del worker 2D y vivirá fuera de `src/workers/**` para no ampliar implícitamente el contrato protegido. Cada solicitud incluye `requestId`, snapshot inmutable, caso/combinación y versión del protocolo. La respuesta conserva el mismo `requestId`; una respuesta obsoleta se descarta. La cancelación termina el worker activo, crea uno nuevo y marca la corrida como cancelada; no dependerá de que un solve síncrono procese un mensaje cooperativo. Los límites se validan antes de asignar matrices.

El visor y el editor nunca llaman directamente a ensamblaje o solver. La única entrada productiva será el protocolo del worker, con una ruta síncrona pura reservada a tests.

## 8. Persistencia, portable y rollback

- Storage separado: `structureco:space3d:v1`.
- Formato portable separado: `application/vnd.structureco.space3d+json`, extensión `.structureco3d.json`.
- Validación fail-closed de versión, discriminante, IDs, referencias, finitud, límites y campos desconocidos.
- Un lector 2D nunca intentará abrir o proyectar un archivo 3D.
- No existe migración automática 2D→3D. Una futura acción explícita podrá copiar geometría a `z=0`, sin cargas ni resultados y con preview de pérdida.
- Ningún resultado se persiste como autoridad; se recalcula desde el snapshot y la versión del solver.
- La función 3D se mantiene detrás de un feature flag local hasta pasar sus gates. Desactivarla no altera proyectos 2D.

El editor 3D tendrá comandos reversibles para crear/editar nodos, miembros, apoyos y cargas. Undo/redo trabaja sobre snapshots `Space3DProjectV1`; no reutiliza ni altera el historial 2D.

## 9. Experiencia de usuario

Inicio separará claramente “Editor 2D” y “Space 3D”. La superficie 3D permitirá crear un proyecto vacío o abrir un ejemplo verificable.

La edición autoritativa se realiza mediante formularios y tablas accesibles:

- nodo: ID, `X/Y/Z` y seis restricciones;
- miembro: extremos, propiedades, referencia de `+y local` y roll;
- carga nodal: seis componentes y caso;
- análisis: caso/combinación, estado del worker, diagnósticos y resultado.

El canvas Three.js permite seleccionar y navegar, pero no inventa coordenadas mediante un clic ambiguo. Mostrará nodos, miembros, ejes locales, apoyos, cargas, forma deformada y leyenda de resultados. El árbol semántico y los formularios siguen disponibles si WebGL no existe o se pierde.

Los controles conservarán español/inglés, temas claro/oscuro, foco visible, teclado, objetivos táctiles mínimos y `prefers-reduced-motion`. “Experimental” permanecerá visible hasta que los gates matemáticos y de producto pasen.

## 10. Validación y errores

La validación se divide en capas:

1. **Schema:** versión, discriminante, campos, tipos, finitud y límites de recursos.
2. **Topología:** IDs únicos, extremos existentes, longitud positiva y casos existentes.
3. **Propiedades:** `E,G,A,Iy,Iz,J > 0` y orientación válida.
4. **Estructura:** GDL libres, restricciones suficientes y sistema solucionable.
5. **Resultado:** finitud, residual lineal, equilibrio global y transformación local/global.

Los errores se devuelven con código estable, entidad y acción sugerida. El sistema no repara automáticamente IDs, propiedades, orientación, apoyos o cargas. Un fallo conserva el proyecto editable y el último resultado válido queda marcado como obsoleto, nunca como resultado del snapshot nuevo.

## 11. Programa de pruebas y oráculos

La secuencia obligatoria será:

```text
derivación -> caso manual -> oracle externo -> test RED -> implementación
-> comparación -> revisión -> ampliación de UI
```

Casos mínimos S3D-1:

1. barra axial espacial: `δ = PL/(EA)`;
2. voladizo a torsión: `θx = TL/(GJ)`;
3. voladizo en flexión local `y` y local `z`, con `Iy ≠ Iz`;
4. miembro inclinado con roll `0`, `π/2` y `2π`;
5. marco espacial estable con carga fuera de plano;
6. transformación rígida global del mismo modelo;
7. renumeración/reordenamiento de nodos y miembros;
8. referencia local degenerada, nodos coincidentes y propiedades no positivas;
9. mecanismo traslacional y mecanismo rotacional;
10. round-trip storage/portable y rechazo de archivos 2D o versiones desconocidas.

Cada caso registra unidades, signos, observable, fórmula o modelo externo, versión, archivo, hash, tolerancia absoluta/relativa y residual. OpenSees usa `ndm=3`, `ndf=6`, `elasticBeamColumn` y transformación lineal explícita. Frame3DD usa archivos nativos versionados. Ninguno será considerado verdad única.

Mutation tests obligatorios intercambiarán `Iy/Iz`, eliminarán `GJ`, invertirán un producto cruz, tratarán roll como grados, alterarán el orden de GDL y omitirán una reacción. El corpus debe detectar todos esos mutantes.

## 12. Seguridad y capacidad

Antes de construir matrices se rechazan `NaN/Infinity`, más de 150 nodos, más de 300 miembros, IDs duplicados, referencias rotas, coordenadas con magnitud mayor a `1e9 m` y payloads con campos desconocidos. No se evalúa código ni se cargan URLs desde proyectos.

El presupuesto de bundle seguirá sin techo bloqueante por decisión del usuario, pero se medirán por separado entrada inicial, chunk 3D, tiempo de ensamblaje/solve, memoria estimada, tiempo de render, cancelación y round-trip portable. El gate ejecutará corpus de 25/50/100/150 nodos y 50/100/200/300 miembros; si el caso máximo excede 2 s de solve o 256 MiB de heap adicional en el navegador de referencia, el límite público se reducirá al último escalón que cumpla ambos valores antes de habilitar archivos externos.

## 13. Gates de aceptación S3D-1

| Gate | Evidencia para pasar |
|---|---|
| `S3D-G1-CONTRACT` | Spec revisada, GDL/ejes/unidades/signos/versiones sin contradicción |
| `S3D-G2-MATH` | Matriz 12×12 derivada, casos manuales y comparación OpenSees + Frame3DD reproducible |
| `S3D-G3-DATA` | Storage/portable/undo-redo versionados; 2D bit-a-bit fuera del cambio |
| `S3D-G4-WORKER` | Paridad sync/worker, structured clone, obsolescencia y cancelación probadas |
| `S3D-G5-UX` | Crear/editar/analizar/inspeccionar/guardar/reabrir en escritorio y móvil; fallback sin WebGL |
| `S3D-G6-REGRESSION` | Suite 2D completa, baseline protegida revisada conscientemente y sin regresiones no autorizadas |
| `S3D-G7-RELEASE` | Reporte, evidencias, revisión independiente y estado experimental explícito |

S3D-1 sólo puede declararse funcional cuando pasan G1–G7. No se usará “tests verdes” como sustituto de las comparaciones estructurales.

## 14. Exclusiones y siguientes capacidades

S3D-1 no incluye cargas distribuidas o puntuales sobre miembros, peso propio, liberaciones, resortes, offsets rígidos, desplazamientos impuestos, diagramas continuos, Timoshenko, P-Delta, dinámica, placas, sólidos, diseño por norma, BIM ni IA. Esas exclusiones no desaparecen del objetivo general: quedan enumeradas como S3D-2–S3D-4 y requieren planes/gates separados después de estabilizar el marco espacial lineal.

No se actualizan dependencias ni versión en el diseño. Cualquier herramienta externa se instalará fuera del producto y sólo con autorización explícita.

## 15. Fuentes normativas de referencia

- [OpenSees — Linear Coordinate Transformation](https://opensees.github.io/OpenSeesDocumentation/user/manual/model/geomTransf/Linear.html), consulta 2026-08-09.
- [OpenSees — Elastic Beam Column Element](https://opensees.github.io/OpenSeesDocumentation/user/manual/model/elements/elasticBeamColumn.html), consulta 2026-08-09.
- [Frame3DD — proyecto oficial](https://hpgavin.github.io/frame3dd/), consulta 2026-08-09.
- [Frame3DD User Manual and Reference](https://hpgavin.github.io/frame3dd/web/Frame3DD-manual.html), versión `0.20140514+`, consulta 2026-08-09.
- `docs/architecture/structureco-fase-4-3d-pre-rfc.md`.
- `structureCo/docs/structureco_evolution/02_seguimiento_implementacion/investigaciones/ARCH-004_informe.md`.
