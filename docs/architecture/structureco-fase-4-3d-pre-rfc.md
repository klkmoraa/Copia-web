# Pre-RFC: camino de structureCo hacia análisis 3D

> **HISTORICAL** — Conserva la propuesta que precedió a S3D-1. El contrato vigente está en [Space 3D · S3D-1](structureco-space-3d-s3d1.md).

**Clasificación:** `HISTORICAL`

**Fecha:** 2026-08-09
**Estado:** pre-RFC; no autoriza implementación del motor 3D
**Responsable de siguiente gate:** arquitectura estructural + ingeniería numérica

## 1. Decisión y evidencia actual

- **HECHO:** structureCo persiste nodos `x/y`, miembros de marco/armadura 2D y resuelve con contratos 2D protegidos.
- **HECHO:** Fase 4 incorpora un visor Three.js no autoritativo. Su adaptador proyecta cada nodo válido a `(x, y, 0)`, omite referencias inválidas con diagnóstico y no escribe sobre el proyecto.
- **HECHO:** el visor no muestra cargas, apoyos, deformadas ni resultados y no llama al solver.
- **PROPUESTA:** una futura capacidad estructural 3D debe entrar como espacio de análisis explícito y no como campos opcionales dispersos o condicionales dentro del solver 2D.
- **REQUIERE INVESTIGACIÓN:** formulación, ensamblaje, signos locales, releases, torsión, estabilidad, tolerancias, capacidad y oráculos independientes para cada familia de elementos 3D.

El visor implementado valida navegación, renderizado y accesibilidad de una representación espacial. No es evidencia de análisis estructural 3D.

## 2. Contrato conceptual futuro

La siguiente interfaz es ilustrativa; no debe añadirse a `src/types.ts` hasta que pasen los gates numéricos y de compatibilidad.

```ts
type AnalysisSpace = '2d' | '3d';

interface Node3D {
  id: string;
  x: number;
  y: number;
  z: number;
}

interface MemberOrientation3D {
  referenceVectorGlobal: readonly [number, number, number];
  rollRadians: number;
}

interface FrameMember3D {
  id: string;
  i: string;
  j: string;
  E: number;
  G: number;
  A: number;
  Iy: number;
  Iz: number;
  J: number;
  orientation: MemberOrientation3D;
}

type FrameNodeDof3D = 'ux' | 'uy' | 'uz' | 'rx' | 'ry' | 'rz';
```

### Orientación local normativa propuesta

1. El eje local `x` va del nodo `i` al nodo `j`.
2. El usuario o importador entrega un vector de referencia expresado en ejes globales y un roll explícito.
3. El sistema rechaza longitud nula, vector de referencia nulo o paralelo/casi paralelo al eje local. No elige silenciosamente un “up” alternativo.
4. Los ejes locales forman una base ortonormal dextrógira; el roll se aplica alrededor del eje local `x` después de construir la base.
5. Signos de fuerzas, momentos y rotaciones se documentan con diagramas y casos manuales antes de publicar resultados.

OpenSees también exige información adicional de orientación para transformaciones 3D mediante `vecxz`; esa referencia respalda la necesidad del contrato explícito, pero no prueba una implementación de structureCo.

## 3. Límites de arquitectura

```text
ProjectModel versionado
  -> adaptador AnalysisSpace
  -> validación geométrica y de propiedades
  -> protocolo de worker versionado
  -> backend numérico 2D o 3D explícito
  -> resultados con procedencia y convenciones
  -> renderer no autoritativo
```

- El renderer nunca define grados de libertad, ejes locales ni signos del solver.
- La selección/picking produce IDs; la semántica sigue en comandos y formularios accesibles.
- El worker 3D necesita mensajes/versiones propios y cancelación medible; no se amplía implícitamente el protocolo vigente.
- Los resultados 2D y 3D deben identificarse por espacio, versión de formulación, snapshot y convenciones.
- WebGL es opcional. Sin GPU debe mantenerse árbol/formulario semántico y una vista ortográfica legible.

## 4. Persistencia y compatibilidad

- No se migra un proyecto 2D existente a 3D sólo por abrir el visor experimental.
- Un futuro formato 3D debe incrementar la versión portable y ser rechazado de forma estricta por lectores 2D antiguos.
- La primera versión 3D no ofrecerá downgrade editable 3D→2D. Una proyección podrá exportarse como vista o reporte no editable, con pérdida declarada.
- La migración necesita fixtures hacia delante/atrás, checksum, límites de recursos y política clara para propiedades nuevas.

## 5. Programa de validación

El orden obligatorio es:

```text
investigación -> derivación -> casos manuales -> oráculo independiente
-> tests -> experimento -> comparación -> producción
```

Conjuntos mínimos futuros:

- barra axial espacial y rotaciones rígidas;
- viga en cada plano principal con `Iy`/`Iz` distintos;
- torsión Saint-Venant con `J`;
- pórtico espacial con orientación no alineada a globales;
- releases y apoyos parciales por cada GDL;
- cargas nodales y de miembro en global/local;
- mecanismos, singularidad y geometría casi degenerada;
- invariancia ante traslación/rotación rígida y renumeración.

Cada caso necesita derivación manual, residuos/equilibrio, tolerancias justificadas y comparación con al menos un oráculo externo. Frame3DD, OpenSees y PyNite son candidatos; ninguno se considera verdad única.

## 6. Gates

Estado tras entregar S3D-1 (2026-08-10). Ver
`structureco-space-3d-s3d1.md` para el detalle y la evidencia.

| Gate | Evidencia necesaria | Estado |
|---|---|---|
| 3D-G0 · separación visual | Visor no muta, no analiza y declara `z = 0` | Superado y retirado: el visor planar ya no existe, Space 3D sí analiza |
| 3D-G1 · contrato | ADR aprobado para espacio, GDL, orientación, signos y versionado | Pasa para S3D-1: contratos implementados y documentados |
| 3D-G2 · numérico | Derivaciones, corpus manual y dos oráculos independientes | **Pasa**: 5 casos manuales más OpenSees 3.8.0 y PyNite 3.0.0, los tres en acuerdo a precisión de máquina. Frame3DD queda como tercer oráculo pendiente |
| 3D-G3 · compatibilidad | Migraciones, portable, workers, undo/redo y rechazo por versión | Pasa para S3D-1; la migración entre esquemas espera a que exista un segundo esquema |
| 3D-G4 · UX/A11Y | Edición, picking, formularios, teclado y fallback sin GPU | Pasa para el alcance probado; sin tecnología de asistencia real |
| 3D-G5 · capacidad | Presupuestos medidos de modelo, worker, memoria, render y cancelación | Pasa: 150 nudos / 300 barras medidos |
| 3D-G6 · producción | Release reproducible, observabilidad y certificación del alcance | No pasa: sigue siendo experimental, sin certificación estructural |

## 7. Fuentes primarias consultadas

- [Frame3DD — análisis estático y dinámico de marcos 2D/3D](https://hpgavin.github.io/frame3dd/), consultado 2026-08-09.
- [OpenSees — Linear Coordinate Transformation](https://opensees.github.io/OpenSeesDocumentation/user/manual/model/geomTransf/Linear.html), consultado 2026-08-09.
- [PyNite — repositorio oficial](https://github.com/JWock82/Pynite), consultado 2026-08-09.
- [Three.js — WebGLRenderer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer) y [OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls), consultados 2026-08-09.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/), consultado 2026-08-09.
