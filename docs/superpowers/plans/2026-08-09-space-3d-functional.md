# Space 3D Functional Implementation Plan

> **HISTORICAL** — Plan de ejecución conservado. El contrato vigente está en [Space 3D · S3D-1](../../architecture/structureco-space-3d-s3d1.md).

**Clasificación:** `HISTORICAL`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar S3D-1 end-to-end: crear, editar, analizar, visualizar, guardar y reabrir un marco espacial elástico lineal con seis GDL, sin alterar el dominio 2D.

**Architecture:** Todo el dominio nuevo vive bajo `src/space3d/**`: tipos discriminados, validación, orientación, elemento 12×12, ensamblaje, solver, worker, almacenamiento, historial y renderer. `App` carga la superficie con `React.lazy`; el solver 2D y sus contratos permanecen intactos. OpenSees y Frame3DD validan resultados mediante artefactos externos versionados, pero no son dependencias del producto.

**Tech Stack:** TypeScript 6, React 19, Vitest 4, Three.js 0.185, Web Worker, localStorage, JSON estricto, Vite 8 y el `solveLinearSystem` existente como primitiva numérica de sólo lectura.

## Global Constraints

- Base de trabajo: structureCo `0.8.2`; no actualizar versión, dependencias ni lockfile.
- No modificar `src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx` ni `src/types.ts`.
- Mantener idénticos el modelo, solver, resultados, storage, portable, undo/redo y UI 2D.
- Unidades internas: `m`, `kN`, `kN·m`, `kN/m²`, `m²`, `m⁴`, `rad`.
- Orden nodal: `[ux, uy, uz, rx, ry, rz]`; orden del elemento: seis GDL de `i`, luego seis de `j`.
- S3D-1 sólo admite frames Euler–Bernoulli prismáticos, cargas nodales y restricciones homogéneas.
- Rechazar `NaN/Infinity`, coordenadas `|x|,|y|,|z| > 1e9 m`, más de 150 nodos o más de 300 miembros antes de asignar matrices.
- Mantener estado `EXPERIMENTAL`; no afirmar certificación hasta pasar casos manuales, OpenSees y Frame3DD.
- Aplicar TDD estricto: crear prueba, observar fallo correcto, implementar mínimo, observar pase y refactorizar.
- Staging con rutas explícitas; preservar trabajo ajeno; no hacer `push` sin autorización.

## File Map

```text
src/space3d/model/types.ts                 contratos inmutables
src/space3d/model/defaultProject.ts        proyecto vacío y ejemplo verificable
src/space3d/model/validation.ts            schema/topología/propiedades/límites
src/space3d/engine/orientation.ts          triada local y roll
src/space3d/engine/element.ts              k_local, T y k_global 12×12
src/space3d/engine/solver.ts               ensamblaje, restricciones y resultados
src/space3d/engine/fixtures.ts             casos canónicos compartidos
src/space3d/runtime/protocol.ts             envelopes versionados
src/space3d/runtime/space3d.worker.ts       entrada Web Worker aislada
src/space3d/runtime/workerClient.ts         obsolescencia/cancelación/reemplazo
src/space3d/data/codec.ts                   parse/serialize portable estricto
src/space3d/data/storage.ts                 primary/backup localStorage
src/space3d/data/commands.ts                comandos reversibles
src/space3d/store/Space3DProjectContext.tsx estado, historial y análisis
src/space3d/view/sceneModel.ts              geometría original/deformada/semántica
src/space3d/view/cameraModel.ts             framing XYZ seguro
src/space3d/view/threeViewport.ts            recursos Three.js y picking
src/space3d/view/Space3DCanvas.tsx           ciclo React/WebGL/fallback
src/features/space3d/Space3DWorkspace.tsx    composición de la superficie
src/features/space3d/Space3DEntityEditor.tsx formularios autoritativos
src/features/space3d/Space3DResultsPanel.tsx resultados y diagnósticos
src/features/space3d/space3d.css             responsive/tema/foco/touch
validation/space3d/**                        derivaciones y artefactos oracle
```

## Execution Setup

Tras consentimiento para aislar el trabajo:

1. Añadir únicamente `/.worktrees/` a `.gitignore` porque la carpeta existente no está ignorada; no mover ni borrar `structureco-lote1-research`.
2. Commit: `chore: ignore local worktree directory`.
3. Crear `codex/space3d-functional` desde `396167f3dc587fe18fac9f94db78c3f91e0d0e75` en `.worktrees/space3d-functional`.
4. Ejecutar `npm.cmd install` dentro del worktree sin cambiar versiones.
5. Ejecutar `npm.cmd run verify`; si el baseline falla, detener ejecución y diagnosticar antes de Task 1.

---

### Task 1: Contratos, límites y proyectos iniciales

**Files:**
- Create: `src/space3d/model/types.ts`
- Create: `src/space3d/model/defaultProject.ts`
- Create: `src/space3d/model/defaultProject.test.ts`

**Interfaces:**
- Consumes: `UnitSystemId` desde `src/types.ts` sin modificar ese archivo.
- Produces: `Space3DProjectV1`, `Space3DNode`, `Space3DFrameMember`, `Space3DNodalLoad`, `Space3DAnalysisResult`, `createBlankSpace3DProject()` y `createSpace3DPortalExample()`.

- [ ] **Step 1: Escribir la prueba RED del contrato por defecto**

```ts
import { describe, expect, it } from 'vitest';
import { createBlankSpace3DProject, createSpace3DPortalExample } from './defaultProject';

describe('Space3D project defaults', () => {
  it('crea un proyecto discriminado sin compartir arrays', () => {
    const a = createBlankSpace3DProject();
    const b = createBlankSpace3DProject();
    expect(a.analysisSpace).toBe('space-3d');
    expect(a.schemaVersion).toBe(1);
    expect(a.units).toBe('kN-m');
    expect(a.nodes).not.toBe(b.nodes);
    expect(a.members).not.toBe(b.members);
  });

  it('incluye un ejemplo espacial estable con carga fuera del plano', () => {
    const example = createSpace3DPortalExample();
    expect(new Set(example.nodes.map((node) => node.z)).size).toBeGreaterThan(1);
    expect(example.members.length).toBeGreaterThanOrEqual(3);
    expect(example.nodalLoads.some((load) => load.fz !== 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar RED**

Run: `npx.cmd vitest run src/space3d/model/defaultProject.test.ts --maxWorkers=1`

Expected: FAIL porque `defaultProject.ts` no existe.

- [ ] **Step 3: Implementar contratos exactos y fábricas**

Definir los tipos de la spec sin campos opcionales de geometría. Usar:

```ts
export const SPACE3D_SCHEMA_VERSION = 1 as const;
export const SPACE3D_LIMITS = Object.freeze({
  maxNodes: 150,
  maxMembers: 300,
  maxCoordinateMagnitude: 1e9,
  minMemberLength: 1e-9,
  minReferenceNorm: 1e-12,
  minPerpendicularRatio: 1e-8,
});

export const fixedSpace3DRestraints = (): Space3DRestraints => ({
  ux: true, uy: true, uz: true, rx: true, ry: true, rz: true,
});

export const freeSpace3DRestraints = (): Space3DRestraints => ({
  ux: false, uy: false, uz: false, rx: false, ry: false, rz: false,
});
```

El ejemplo tendrá cuatro nodos no coplanares, tres apoyos fijos, miembros con propiedades positivas y una carga `fz` en el nodo libre.

- [ ] **Step 4: Ejecutar GREEN y typecheck focalizado**

Run: `npx.cmd vitest run src/space3d/model/defaultProject.test.ts --maxWorkers=1`

Expected: 2 pruebas aprobadas.

Run: `npm.cmd run typecheck`

Expected: exit 0.

- [ ] **Step 5: Commit**

```powershell
git add -- src/space3d/model/types.ts src/space3d/model/defaultProject.ts src/space3d/model/defaultProject.test.ts
git commit -m "feat: define isolated space 3d project contracts"
```

### Task 2: Validación fail-closed y orientación local

**Files:**
- Create: `src/space3d/model/validation.ts`
- Create: `src/space3d/model/validation.test.ts`
- Create: `src/space3d/engine/orientation.ts`
- Create: `src/space3d/engine/orientation.test.ts`

**Interfaces:**
- Consumes: `Space3DProjectV1`, `Space3DVector`, `SPACE3D_LIMITS`.
- Produces: `validateSpace3DProject(project): readonly Space3DValidationIssue[]` y `buildMemberOrientation(start, end, orientation): Space3DOrientationBasis`.

- [ ] **Step 1: Escribir pruebas RED de orientación**

```ts
it('construye una triada diestra y aplica roll pi/2', () => {
  const basis = buildMemberOrientation([0, 0, 0], [2, 0, 0], {
    localYReferenceGlobal: [0, 1, 0], rollRadians: Math.PI / 2,
  });
  expect(basis.x).toEqual([1, 0, 0]);
  expectVectorClose(basis.y, [0, 0, 1], 1e-12);
  expectVectorClose(basis.z, [0, -1, 0], 1e-12);
  expect(testDot(testCross(basis.x, basis.y), basis.z)).toBeCloseTo(1, 12);
});

it('rechaza una referencia paralela sin elegir un up alternativo', () => {
  expect(() => buildMemberOrientation([0, 0, 0], [1, 0, 0], {
    localYReferenceGlobal: [2, 0, 0], rollRadians: 0,
  })).toThrow(/orientation-reference-parallel/);
});
```

El test define helpers locales sin ampliar la API productiva:

```ts
const testDot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const testCross = (a: readonly number[], b: readonly number[]) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const expectVectorClose = (actual: readonly number[], expected: readonly number[], digits = 12) =>
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], digits));
```

Usar `testDot(testCross(basis.x, basis.y), basis.z)` en la aserción de mano derecha.

- [ ] **Step 2: Ejecutar RED de orientación**

Run: `npx.cmd vitest run src/space3d/engine/orientation.test.ts --maxWorkers=1`

Expected: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar álgebra vectorial y triada**

Implementar funciones puras `dot`, `cross`, `norm`, `normalize`, `subtract`, `scale`, `add`. Para roll:

```ts
const x = normalize(subtract(end, start), 'zero-length-member');
const referenceNorm = norm(localYReferenceGlobal);
if (referenceNorm <= SPACE3D_LIMITS.minReferenceNorm) throw new Space3DGeometryError('orientation-reference-zero');
const projected = subtract(localYReferenceGlobal, scale(x, dot(localYReferenceGlobal, x)));
if (norm(projected) / referenceNorm <= SPACE3D_LIMITS.minPerpendicularRatio) {
  throw new Space3DGeometryError('orientation-reference-parallel');
}
const y0 = normalize(projected, 'orientation-reference-parallel');
const z0 = normalize(cross(x, y0), 'orientation-reference-parallel');
const y = add(scale(y0, Math.cos(rollRadians)), scale(z0, Math.sin(rollRadians)));
const z = add(scale(y0, -Math.sin(rollRadians)), scale(z0, Math.cos(rollRadians)));
return Object.freeze({ x: freezeVector(x), y: freezeVector(y), z: freezeVector(z) });
```

- [ ] **Step 4: Ejecutar GREEN de orientación**

Run: `npx.cmd vitest run src/space3d/engine/orientation.test.ts --maxWorkers=1`

Expected: pruebas aprobadas.

- [ ] **Step 5: Escribir pruebas RED de validación**

Cubrir exactamente: duplicados, extremo inexistente, `NaN`, propiedad no positiva, longitud menor a `1e-9`, referencia degenerada, caso inexistente, campos desconocidos recibidos por codec y límites 150/300.

```ts
it('informa todas las referencias y propiedades inválidas sin mutar', () => {
  const project = createSpace3DPortalExample();
  const broken = structuredClone(project);
  broken.members[0].j = 'missing';
  broken.members[1].J = 0;
  const before = structuredClone(broken);
  const issues = validateSpace3DProject(broken);
  expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['missing-reference', 'invalid-property']));
  expect(broken).toEqual(before);
});
```

- [ ] **Step 6: Ejecutar RED, implementar validador acumulativo y ejecutar GREEN**

Run: `npx.cmd vitest run src/space3d/model/validation.test.ts --maxWorkers=1`

Expected RED: módulo inexistente. Implementar sin reparar el proyecto y ordenar issues por `entityKind/entityId/code` para determinismo.

Run: `npx.cmd vitest run src/space3d/model/validation.test.ts src/space3d/engine/orientation.test.ts --maxWorkers=1`

Expected GREEN: todas aprobadas.

- [ ] **Step 7: Commit**

```powershell
git add -- src/space3d/model/validation.ts src/space3d/model/validation.test.ts src/space3d/engine/orientation.ts src/space3d/engine/orientation.test.ts
git commit -m "feat: validate space 3d geometry and orientation"
```

### Task 3: Elemento frame espacial 12×12

**Files:**
- Create: `src/space3d/engine/element.ts`
- Create: `src/space3d/engine/element.test.ts`

**Interfaces:**
- Consumes: `Space3DFrameMember`, `Space3DNode`, `buildMemberOrientation`, helpers de matriz de sólo lectura en `src/engine/math.ts`.
- Produces: `spaceFrameLocalStiffness(member, length)`, `spaceFrameTransformation(basis)` y `buildSpaceFrameElement(member, nodeI, nodeJ)`.

- [ ] **Step 1: Escribir pruebas RED de los cuatro bloques físicos**

```ts
it('recupera rigideces axial y torsional sin acoplamiento espurio', () => {
  const k = spaceFrameLocalStiffness({ E: 200, G: 80, A: 3, Iy: 5, Iz: 7, J: 11 }, 2);
  expect(k[0][0]).toBe(300);
  expect(k[0][6]).toBe(-300);
  expect(k[3][3]).toBe(440);
  expect(k[3][9]).toBe(-440);
  expect(k[0][3]).toBe(0);
});

it('usa Iz para v-rz e Iy para w-ry', () => {
  const k = spaceFrameLocalStiffness({ E: 2, G: 3, A: 4, Iy: 5, Iz: 7, J: 11 }, 2);
  expect(k[1][1]).toBeCloseTo(12 * 2 * 7 / 2 ** 3);
  expect(k[2][2]).toBeCloseTo(12 * 2 * 5 / 2 ** 3);
  expect(k[1][5]).toBeCloseTo(6 * 2 * 7 / 2 ** 2);
  expect(k[2][4]).toBeCloseTo(-6 * 2 * 5 / 2 ** 2);
});
```

- [ ] **Step 2: Ejecutar RED**

Run: `npx.cmd vitest run src/space3d/engine/element.test.ts --maxWorkers=1`

Expected: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar la matriz local exacta**

Usar índices `[u,v,w,rx,ry,rz]` por nodo. Insertar bloques:

```ts
addSymmetric2(k, [0, 6], EA / L, -EA / L);
addSymmetric2(k, [3, 9], GJ / L, -GJ / L);
addBendingBlock(k, [1, 5, 7, 11], E * Iz, L, +1);
addBendingBlock(k, [2, 4, 8, 10], E * Iy, L, -1);
```

`addBendingBlock` debe producir la matriz estándar `[12EI/L³, s·6EI/L², -12EI/L³, s·6EI/L²; …]`, con `s=+1` para `v/rz` y `s=-1` para `w/ry`.

- [ ] **Step 4: Añadir pruebas RED de transformación**

Verificar `T·Tᵀ=I`, `k_global=Tᵀ·k_local·T`, simetría, energía no negativa y que un miembro global X con referencia Y produce `T=I`.

- [ ] **Step 5: Implementar transformación en cuatro bloques 3×3 y ejecutar GREEN**

La matriz `R` tiene como filas `x`, `y`, `z` expresadas en global. Colocar `R` en los bloques de traslación/rotación de ambos nodos.

Run: `npx.cmd vitest run src/space3d/engine/element.test.ts --maxWorkers=1`

Expected: todas aprobadas sin warnings.

- [ ] **Step 6: Commit**

```powershell
git add -- src/space3d/engine/element.ts src/space3d/engine/element.test.ts
git commit -m "feat: add twelve dof space frame element"
```

### Task 4: Ensamblaje, restricciones y solver estático

**Files:**
- Create: `src/space3d/engine/solver.ts`
- Create: `src/space3d/engine/solver.test.ts`
- Create: `src/space3d/engine/fixtures.ts`

**Interfaces:**
- Consumes: proyectos validados, `buildSpaceFrameElement`, `solveLinearSystem`, `submatrix`, `subvector`, `multiplyMatrixVector`.
- Produces: `analyzeSpace3DProject(project, caseOrCombinationId): Space3DAnalysisResult`, `axialCantilever(overrides?)`, `torsionCantilever(overrides?)`, `bendingCantilever(overrides?)` y `freeFloatingMember()`.

- [ ] **Step 1: Escribir RED axial, torsión y flexión**

Crear fixtures independientes para un voladizo de longitud `L=2`:

```ts
it('resuelve barra axial espacial con PL/EA', () => {
  const project = axialCantilever({ L: 2, E: 200_000_000, A: 0.01, P: 100 });
  const result = analyzeSpace3DProject(project, 'LC1');
  expect(result.success).toBe(true);
  expect(node(result, 'J').displacement.ux).toBeCloseTo(100 * 2 / (200_000_000 * 0.01), 12);
  expect(node(result, 'I').reaction.ux).toBeCloseTo(-100, 10);
});

it('resuelve torsión con TL/GJ', () => {
  const project = torsionCantilever({ L: 2, G: 80_000_000, J: 2e-5, T: 10 });
  const result = analyzeSpace3DProject(project, 'LC1');
  expect(node(result, 'J').displacement.rx).toBeCloseTo(10 * 2 / (80_000_000 * 2e-5), 12);
});
```

El test declara `const node = (result, id) => result.nodeResults.find((item) => item.nodeId === id)!;`. Los fixtures aceptan `Partial` y completan parámetros físicos reproducibles, por lo que pueden invocarse con o sin overrides.

Añadir dos pruebas de flexión con `Iy !== Iz`, usando `PL³/(3EI)` y `PL²/(2EI)`.

- [ ] **Step 2: Ejecutar RED**

Run: `npx.cmd vitest run src/space3d/engine/solver.test.ts --maxWorkers=1`

Expected: FAIL por `solver.ts` inexistente.

- [ ] **Step 3: Implementar ensamblaje y solución reducida**

```ts
const dofIndex = (nodeIndex: number, dof: number) => nodeIndex * 6 + dof;
const free = allDofs.filter((index) => !restrained.has(index));
if (free.length === 0) return failed('no-free-dof');
const Kff = submatrix(K, free, free);
const Ff = subvector(F, free);
const solved = solveLinearSystem(Kff, Ff);
const U = Array(totalDofs).fill(0);
free.forEach((global, index) => { U[global] = solved.x[index]; });
const R = multiplyMatrixVector(K, U).map((value, index) => value - F[index]);
```

Para cada miembro: `uLocal=T·uGlobalElement`; `fLocal=kLocal·uLocal`. Generar resultados inmutables y diagnósticos de residual.

- [ ] **Step 4: Implementar combinaciones lineales y equilibrio 6D**

Resolver cargas combinadas ensamblando `F = Σ factor(caseId)·Fcase`. Auditar `ΣFx/Fy/Fz` y momentos globales `Σ(M + r×F)` respecto al origen. Normalizar el residual por la mayor acción fuente/reacción y `1`.

- [ ] **Step 5: Añadir RED de mecanismos y fallo fail-closed**

```ts
it('no publica resultados utilizables para un mecanismo', () => {
  const result = analyzeSpace3DProject(freeFloatingMember(), 'LC1');
  expect(result.success).toBe(false);
  expect(result.issues.some((issue) => issue.code === 'mechanism')).toBe(true);
  expect(result.nodeResults).toEqual([]);
  expect(result.memberResults).toEqual([]);
});
```

Capturar exclusivamente errores de singularidad/no finitud del solve y convertirlos a issues estables; no ocultar errores de programación.

- [ ] **Step 6: Ejecutar GREEN y regresión matemática focalizada**

Run: `npx.cmd vitest run src/space3d/engine/orientation.test.ts src/space3d/engine/element.test.ts src/space3d/engine/solver.test.ts --maxWorkers=1`

Expected: todas aprobadas; residual lineal y equilibrio bajo las tolerancias de cada fixture.

- [ ] **Step 7: Commit**

```powershell
git add -- src/space3d/engine/solver.ts src/space3d/engine/solver.test.ts src/space3d/engine/fixtures.ts
git commit -m "feat: solve linear elastic space frames"
```

### Task 5: Invariantes, mutation guards y corpus oracle

**Files:**
- Create: `src/space3d/engine/invariants.test.ts`
- Create: `src/space3d/engine/oracleComparison.test.ts`
- Create: `validation/space3d/README.md`
- Create: `validation/space3d/manual-cases.md`
- Create: `validation/space3d/oracles/manifest.json`
- Create: `validation/space3d/oracles/opensees/*.tcl`
- Create: `validation/space3d/oracles/frame3dd/*.3dd`
- Create: `validation/space3d/oracles/expected/*.json`

**Interfaces:**
- Consumes: `analyzeSpace3DProject` y fixtures canónicos.
- Produces: corpus reproducible con observables, unidades, versiones, hashes y tolerancias.

- [ ] **Step 1: Escribir RED de invariantes físicos**

Probar linealidad de cargas, rotación rígida global, roll `2π`, renumeración, `Iy=Iz` y energía `uᵀKu >= 0`. Cada transformación debe construir un proyecto nuevo y comparar componentes mapeados, no snapshots literales.

- [ ] **Step 2: Ejecutar RED y completar helpers mínimos**

Run: `npx.cmd vitest run src/space3d/engine/invariants.test.ts --maxWorkers=1`

Expected: al menos una prueba falla por helper/invariante aún no satisfecho. Corregir el solver, no relajar expected.

- [ ] **Step 3: Escribir mutation guards explícitos**

Los tests deben fallar si se intercambia `Iy/Iz`, si `GJ` se elimina, si `cross(x,y)` cambia a `cross(y,x)`, si roll se interpreta en grados o si el orden `rx/ry/rz` cambia.

- [ ] **Step 4: Documentar y serializar casos manuales**

`manual-cases.md` contendrá entrada completa y derivación de axial, torsión, flexión y marco inclinado. `manifest.json` usará:

```json
{
  "schemaVersion": 1,
  "cases": [{
    "id": "S3D-AXIAL-001",
    "source": "manual",
    "model": "expected/S3D-AXIAL-001.project.json",
    "result": "expected/S3D-AXIAL-001.result.json",
    "observables": [{ "path": "nodes.J.ux", "unit": "m", "atol": 1e-12, "rtol": 1e-9 }]
  }]
}
```

- [ ] **Step 5: Crear modelos nativos OpenSees/Frame3DD sin ejecutar aún**

Los scripts deben fijar `ndm=3`, `ndf=6`, orientación y propiedades equivalentes. Registrar en README comandos exactos y aclarar `NOT_RUN` hasta que existan salidas/versiones/hashes reales.

- [ ] **Step 6: Ejecutar GREEN interno**

Run: `npx.cmd vitest run src/space3d/engine/invariants.test.ts src/space3d/engine/oracleComparison.test.ts --maxWorkers=1`

Expected: casos manuales pasan; casos externos se marcan `skip` con razón `oracle executable unavailable`, no como aprobados.

- [ ] **Step 7: Commit**

```powershell
git add -- src/space3d/engine/invariants.test.ts src/space3d/engine/oracleComparison.test.ts validation/space3d
git commit -m "test: add space 3d manual and oracle corpus"
```

### Task 6: Protocolo, worker y cancelación

**Files:**
- Create: `src/space3d/runtime/protocol.ts`
- Create: `src/space3d/runtime/protocol.test.ts`
- Create: `src/space3d/runtime/space3d.worker.ts`
- Create: `src/space3d/runtime/workerClient.ts`
- Create: `src/space3d/runtime/workerClient.test.ts`

**Interfaces:**
- Consumes: `Space3DProjectV1`, `Space3DAnalysisResult`, `analyzeSpace3DProject`.
- Produces: `handleSpace3DWorkerRequest`, `Space3DWorkerClient.run`, `Space3DWorkerClient.cancel`, `Space3DWorkerClient.dispose`.

- [ ] **Step 1: Escribir RED de paridad y structured clone**

```ts
it('devuelve el mismo resultado que la ruta pura', () => {
  const project = axialCantilever();
  const response = handleSpace3DWorkerRequest({
    protocolVersion: 1, type: 'run', requestId: 7, project, targetId: 'LC1',
  });
  expect(response).toEqual({
    protocolVersion: 1, type: 'success', requestId: 7,
    result: analyzeSpace3DProject(project, 'LC1'),
  });
  expect(structuredClone(response)).toEqual(response);
});
```

- [ ] **Step 2: Ejecutar RED, implementar envelopes y handler, ejecutar GREEN**

Run: `npx.cmd vitest run src/space3d/runtime/protocol.test.ts --maxWorkers=1`

Expected RED: módulo inexistente. Implementar versión exacta y error `PROTOCOL_MISMATCH` fail-closed.

- [ ] **Step 3: Escribir RED del cliente cancelable con worker factory**

Inyectar `createWorker: () => WorkerLike`. Verificar que `cancel()` llama `terminate()`, rechaza la promesa con `Space3DAnalysisCancelledError`, crea un worker nuevo en la siguiente corrida y descarta respuestas con `requestId` viejo.

- [ ] **Step 4: Implementar cliente y entrada Vite Worker**

```ts
const defaultWorkerFactory = () => new Worker(new URL('./space3d.worker.ts', import.meta.url), { type: 'module' });
```

No importar este módulo desde el entry inicial; sólo desde el chunk lazy de Space 3D.

- [ ] **Step 5: Ejecutar GREEN**

Run: `npx.cmd vitest run src/space3d/runtime/protocol.test.ts src/space3d/runtime/workerClient.test.ts --maxWorkers=1`

Expected: paridad, obsolescencia, cancelación y dispose aprobados.

- [ ] **Step 6: Commit**

```powershell
git add -- src/space3d/runtime
git commit -m "feat: run space 3d analysis in an isolated worker"
```

### Task 7: Codec, almacenamiento, comandos y contexto

**Files:**
- Create: `src/space3d/data/codec.ts`
- Create: `src/space3d/data/codec.test.ts`
- Create: `src/space3d/data/storage.ts`
- Create: `src/space3d/data/storage.test.ts`
- Create: `src/space3d/data/commands.ts`
- Create: `src/space3d/data/commands.test.ts`
- Create: `src/space3d/store/Space3DProjectContext.tsx`
- Create: `src/space3d/store/Space3DProjectContext.test.tsx`

**Interfaces:**
- Consumes: modelo/validación y `Space3DWorkerClient`.
- Produces: `parseSpace3DProject`, `serializeSpace3DProject`, `load/saveSpace3DProject`, `applySpace3DCommand`, `Space3DProjectProvider`, `useSpace3DProject`.

- [ ] **Step 1: Escribir RED del codec estricto**

Probar round-trip exacto, versión desconocida, `analysisSpace` incorrecto, campos desconocidos a cualquier nivel, arrays demasiado grandes, `NaN` serializado como `null` y archivo 2D.

```ts
expect(() => parseSpace3DProject(JSON.stringify({ ...project, surprise: true }))).toThrow(/unknown-field/);
expect(parseSpace3DProject(serializeSpace3DProject(project))).toEqual(project);
```

- [ ] **Step 2: Ejecutar RED, implementar guards manuales y ejecutar GREEN**

No añadir Zod/Ajv. Cada objeto se valida con una allowlist exacta antes de convertirlo al tipo de dominio.

- [ ] **Step 3: Escribir RED de primary/backup storage**

Usar claves `structureco:space3d:v1` y `structureco:space3d:v1:backup`. Verificar recuperación desde backup si primary está corrupto y que guardar nunca sobrescribe el único backup válido con JSON inválido.

- [ ] **Step 4: Implementar storage y ejecutar GREEN**

Run: `npx.cmd vitest run src/space3d/data/codec.test.ts src/space3d/data/storage.test.ts --maxWorkers=1`

- [ ] **Step 5: Escribir RED de comandos reversibles**

Definir unión cerrada `add-node | update-node | delete-node | add-member | update-member | delete-member | set-restraints | add-nodal-load | update-nodal-load | delete-nodal-load`. Rechazar borrado de nodo con consumidores y endpoints inexistentes. `applySpace3DCommand` devuelve snapshot nuevo y no muta entrada.

- [ ] **Step 6: Implementar comandos y ejecutar GREEN**

Run: `npx.cmd vitest run src/space3d/data/commands.test.ts --maxWorkers=1`

- [ ] **Step 7: Escribir RED del Provider**

Renderizar un harness que cree un nodo, haga undo/redo, analice, edite después del resultado y compruebe `analysisState='stale'`. Verificar persistencia separada y cancelación al desmontar.

- [ ] **Step 8: Implementar Provider y ejecutar GREEN**

El contexto expone `project`, `analysis`, `analysisState`, `selectedEntity`, `execute`, `undo`, `redo`, `analyze`, `cancelAnalysis`, `replaceProject`, `importPortable`, `exportPortable`.

Run: `npx.cmd vitest run src/space3d/store/Space3DProjectContext.test.tsx --maxWorkers=1`

- [ ] **Step 9: Commit**

```powershell
git add -- src/space3d/data src/space3d/store
git commit -m "feat: persist and edit space 3d projects safely"
```

### Task 8: Scene model, cámara y viewport Three.js

**Files:**
- Create: `src/space3d/view/sceneModel.ts`
- Create: `src/space3d/view/sceneModel.test.ts`
- Create: `src/space3d/view/cameraModel.ts`
- Create: `src/space3d/view/cameraModel.test.ts`
- Create: `src/space3d/view/threeViewport.ts`
- Create: `src/space3d/view/threeViewport.test.ts`
- Create: `src/space3d/view/Space3DCanvas.tsx`
- Create: `src/space3d/view/Space3DCanvas.test.tsx`

**Interfaces:**
- Consumes: proyecto, análisis, selección y comandos de cámara.
- Produces: `buildSpace3DSceneModel`, `computeSpace3DCameraPlacement`, `createSpace3DViewport`, `Space3DCanvas`.

- [ ] **Step 1: Escribir RED del scene model**

Verificar XYZ exacto, miembros, apoyos, vectores de carga, ejes locales y forma deformada `p + scale·u`. Si análisis está stale/failed, la escena no contiene deformada.

- [ ] **Step 2: Ejecutar RED, implementar adaptador puro y ejecutar GREEN**

Run: `npx.cmd vitest run src/space3d/view/sceneModel.test.ts --maxWorkers=1`

- [ ] **Step 3: Escribir RED de cámara XYZ**

Cubrir proyecto vacío, punto único, geometría extendida en Z y presets `front | top | side | isometric`; `near > 0`, `far > near`, posición finita y target igual al centro 3D.

- [ ] **Step 4: Implementar cámara y ejecutar GREEN**

Run: `npx.cmd vitest run src/space3d/view/cameraModel.test.ts --maxWorkers=1`

- [ ] **Step 5: Escribir RED del viewport y lifecycle**

Inyectar factories de renderer/controls para afirmar render bajo demanda, DPR `<=2`, picking por ID, actualización de selección, pérdida de contexto, resize y dispose de listener/geometría/material/renderer/controls.

- [ ] **Step 6: Implementar viewport**

Usar `BufferGeometry`, `LineSegments`, `Points`, `ArrowHelper`, `AxesHelper` y una segunda geometría para deformada. Mantener `requestAnimationFrame` sólo para un render solicitado, nunca loop continuo.

- [ ] **Step 7: Escribir RED/implementar `Space3DCanvas` con fallback**

El fallback conserva árbol semántico, resumen, selección y botón reintentar. Los controles tienen nombres accesibles y funcionan con `button` nativo.

Run: `npx.cmd vitest run src/space3d/view --maxWorkers=1`

Expected: todas las pruebas de view aprobadas.

- [ ] **Step 8: Commit**

```powershell
git add -- src/space3d/view
git commit -m "feat: render editable and deformed space 3d models"
```

### Task 9: Editor y resultados Space 3D

**Files:**
- Create: `src/features/space3d/Space3DWorkspace.tsx`
- Create: `src/features/space3d/Space3DEntityEditor.tsx`
- Create: `src/features/space3d/Space3DResultsPanel.tsx`
- Create: `src/features/space3d/Space3DWorkspace.test.tsx`
- Create: `src/features/space3d/space3d.css`

**Interfaces:**
- Consumes: `useSpace3DProject`, `Space3DCanvas`, i18n.
- Produces: superficie end-to-end y callbacks `onOpenHome`, `onOpen2D`, `onOpenPlanarPreview`.

- [ ] **Step 1: Escribir RED del flujo funcional**

Con worker inyectado síncrono: crear nodo XYZ, crear miembro eligiendo endpoints, fijar seis apoyos, añadir carga `fz`, analizar, abrir resultados, guardar/exportar, importar y comprobar valores restaurados.

```ts
await user.click(screen.getByRole('button', { name: /nuevo nodo/i }));
await user.type(screen.getByLabelText(/^z$/i), '3');
await user.click(screen.getByRole('button', { name: /guardar nodo/i }));
expect(screen.getByRole('row', { name: /N5/ })).toBeInTheDocument();
```

- [ ] **Step 2: Ejecutar RED**

Run: `npx.cmd vitest run src/features/space3d/Space3DWorkspace.test.tsx --maxWorkers=1`

Expected: FAIL por módulos inexistentes.

- [ ] **Step 3: Implementar composición y formularios autoritativos**

Dividir layout en header, toolbar, canvas, entity list/editor y results. Los inputs usan borrador string, convierten sólo al confirmar, rechazan vacío/NaN y muestran unidades. No crear coordenadas con clic 3D.

- [ ] **Step 4: Implementar panel de resultados**

Tabs: resumen, nodos, miembros, diagnósticos. Mostrar seis componentes con unidad/signo/frame. Un resultado stale se etiqueta y oculta deformada; un fallo muestra issue codes y conserva edición.

- [ ] **Step 5: Implementar CSS responsive y accesible**

Desktop `>=960px`: canvas + rail. Móvil: toolbar pegajosa, canvas 45vh, paneles apilados. Todos los targets `min-block-size:44px`; foco `:focus-visible`; tema por tokens existentes; `prefers-reduced-motion` desactiva transiciones.

- [ ] **Step 6: Ejecutar GREEN y axe semántico disponible**

Run: `npx.cmd vitest run src/features/space3d/Space3DWorkspace.test.tsx src/space3d/store/Space3DProjectContext.test.tsx --maxWorkers=1`

Expected: flujo funcional aprobado; cero `act` warnings.

- [ ] **Step 7: Commit**

```powershell
git add -- src/features/space3d
git commit -m "feat: add functional space 3d editor and results"
```

### Task 10: Navegación lazy, Inicio e i18n

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/features/welcome/WelcomeScreen.tsx`
- Modify: `src/features/welcome/WelcomeScreen.test.tsx`
- Modify: `src/i18n/catalogs.ts`
- Modify: `src/styles.css`
- Test: `src/features/space3d/Space3DWorkspace.test.tsx`

**Interfaces:**
- Consumes: lazy `Space3DWorkspace` y Provider.
- Produces: `AppScreen = 'welcome' | 'workspace' | 'experimental3d' | 'space3d'` y acceso visible desde Inicio.

- [ ] **Step 1: Escribir RED de navegación y lazy loading**

Probar que Inicio muestra “Space 3D”, abre la superficie, vuelve a Inicio/Editor 2D y que el módulo Three/space3d no se evalúa antes del clic.

- [ ] **Step 2: Ejecutar RED**

Run: `npx.cmd vitest run src/App.test.tsx src/features/welcome/WelcomeScreen.test.tsx --maxWorkers=1`

Expected: FAIL porque no existe `space3d` en `AppScreen` ni callback.

- [ ] **Step 3: Implementar entrada lazy**

```ts
const loadSpace3DWorkspace = () => import('./features/space3d/Space3DWorkspace');
const Space3DWorkspace = lazy(loadSpace3DWorkspace);
```

El módulo lazy envuelve su propio `Space3DProjectProvider`; no añadirlo alrededor del producto 2D.

- [ ] **Step 4: Añadir catálogo ES/EN completo**

Agregar claves para proyecto, nodos, miembros, propiedades, orientación, apoyos, cargas, análisis, resultados, stale, errores, import/export, presets, fallback y estado experimental. No dejar fallback English en español.

- [ ] **Step 5: Ejecutar GREEN y build de chunks**

Run: `npx.cmd vitest run src/App.test.tsx src/features/welcome/WelcomeScreen.test.tsx src/features/space3d/Space3DWorkspace.test.tsx --maxWorkers=1`

Run: `npm.cmd run build`

Expected: build exit 0; `space3d` y Three.js sólo en chunk lazy.

- [ ] **Step 6: Commit**

```powershell
git add -- src/App.tsx src/App.test.tsx src/features/welcome/WelcomeScreen.tsx src/features/welcome/WelcomeScreen.test.tsx src/i18n/catalogs.ts src/styles.css
git commit -m "feat: integrate space 3d as a lazy application surface"
```

### Task 11: Ejecutar oráculos y capacidad

**Files:**
- Modify: `validation/space3d/oracles/manifest.json`
- Add: `validation/space3d/oracles/**/output/*`
- Modify: `src/space3d/engine/oracleComparison.test.ts`
- Create: `scripts/check-space3d-capacity.mjs`
- Create: `scripts/space3d-capacity-policy.mjs`
- Create: `scripts/check-space3d-capacity.test.mjs`
- Create: `src/space3d/engine/capacity.test.ts`
- Modify: `package.json` únicamente para añadir script `verify:space3d`; no cambiar dependencias ni versión.

**Interfaces:**
- Consumes: modelos nativos y solver structureCo.
- Produces: salidas externas con versión/hash y medición 25/50/100/150 nodos.

- [ ] **Step 1: Detectar oráculos disponibles sin instalar**

Run:

```powershell
Get-Command OpenSees, frame3dd -ErrorAction SilentlyContinue
```

Si faltan, detener sólo este task y pedir autorización para descargar ejecutables oficiales fuera del repositorio. Continuar con otros tasks no convierte G2 en aprobado.

- [ ] **Step 2: Ejecutar OpenSees y Frame3DD con archivos nativos**

Registrar comando, versión, SO, stdout/stderr, archivos de entrada/salida y SHA-256. No copiar código GPL al bundle.

- [ ] **Step 3: Convertir observables a JSON sin sobrescribir datos crudos**

Cada JSON incluye `oracle`, `version`, `inputSha256`, `outputSha256`, `units`, `axes`, `signMap` y `observables`.

- [ ] **Step 4: Quitar skips y ejecutar comparación**

Run: `npx.cmd vitest run src/space3d/engine/oracleComparison.test.ts --maxWorkers=1`

Expected: manual + OpenSees + Frame3DD aprobados dentro de tolerancias por observable.

- [ ] **Step 5: Escribir RED del verificador de capacidad**

`scripts/check-space3d-capacity.test.mjs` usa `node:test` y alimenta reportes sintéticos a `evaluateSpace3DCapacity(report)`. Comprueba que 150/300 sólo pasa si solve `<=2000ms`, heap adicional `<=256MiB` y resultados finitos; si falla, devuelve el último escalón aprobado.

Run: `node --test scripts/check-space3d-capacity.test.mjs`

Expected RED: módulo `space3d-capacity-policy.mjs` inexistente.

- [ ] **Step 6: Implementar medición real y ejecutar**

Implementar la política pura y `capacity.test.ts`. Este último construye modelos deterministas de 25/50/100/150 nodos y 50/100/200/300 miembros, mide `analyzeSpace3DProject` con `performance.now()`, estima bytes de matrices/vectores y emite una sola línea cuyo prefijo es `SPACE3D_CAPACITY_JSON=` seguido por el objeto serializado cuando `SPACE3D_CAPACITY_REPORT=1`.

`check-space3d-capacity.mjs` ejecuta:

```js
execFileSync('npx.cmd', ['vitest', 'run', 'src/space3d/engine/capacity.test.ts', '--maxWorkers=1', '--reporter=verbose'], {
  cwd: ROOT,
  env: { ...process.env, SPACE3D_CAPACITY_REPORT: '1' },
  encoding: 'utf8',
});
```

Extraer el marker, aplicar `evaluateSpace3DCapacity` y fallar si el límite publicado excede el último escalón aprobado.

Run: `node --test scripts/check-space3d-capacity.test.mjs`

Expected: pruebas de política aprobadas.

Run: `node scripts/check-space3d-capacity.mjs`

Expected: JSON y tabla con escalones; actualizar `SPACE3D_LIMITS` al último escalón aprobado si es menor, junto con tests RED/GREEN de ese cambio.

- [ ] **Step 7: Añadir script y ejecutar gate**

```json
"verify:space3d": "vitest run src/space3d src/features/space3d --maxWorkers=1 && node scripts/check-space3d-capacity.mjs"
```

Run: `npm.cmd run verify:space3d`

Expected: exit 0.

- [ ] **Step 8: Commit**

```powershell
git add -- validation/space3d src/space3d/engine/oracleComparison.test.ts src/space3d/engine/capacity.test.ts scripts/check-space3d-capacity.mjs scripts/space3d-capacity-policy.mjs scripts/check-space3d-capacity.test.mjs package.json
git commit -m "test: validate space 3d against independent oracles"
```

### Task 12: QA integral, documentación y cierre local

**Files:**
- Modify: `docs/architecture/structureco-fase-4-3d-pre-rfc.md`
- Modify: `docs/architecture/structureco-fase-4-gates.md`
- Create: `docs/architecture/structureco-space-3d-s3d1.md`
- Create: la ruta resuelta por `$reportPath = "reports/$(Get-Date -Format 'yyyy-MM-dd-HHmm')-space-3d-funcional.md"`
- Add: `reports/evidence/2026-08-09-space3d/*`

**Interfaces:**
- Consumes: todas las tareas y evidencias.
- Produces: matriz gate por gate, reporte, capturas y commit final; no push.

- [ ] **Step 1: Ejecutar verificación focalizada fresca**

Run: `npm.cmd run verify:space3d`

Expected: todos los tests Space 3D y capacidad aprobados.

- [ ] **Step 2: Ejecutar frontera y suite completa**

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run verify:protected
npm.cmd test
npm.cmd run build
npm.cmd run verify:perf
git diff --check
```

Expected: baseline 2D, 29 archivos protegidos, suite, build y medición aprobados. No actualizar baseline para ocultar cambios.

- [ ] **Step 3: Auditar bundle**

Ejecutar `node scripts/measure-performance.mjs --json`. Confirmar que `src/space3d`, `three`, worker y editor no están en chunks eager y que sólo se descargan al abrir Space 3D.

- [ ] **Step 4: QA de navegador real**

Verificar 1440×900 y 390×844; ES/EN; claro/oscuro; proyecto vacío y ejemplo; crear/editar/analizar; órbita/picking/presets; resultados/deformada; mecanismo; cancelación; save/reload; export/import; undo/redo; teclado/foco/touch; WebGL perdido/fallback/reintento. Guardar capturas con un manifest que diga exactamente qué prueba cada una.

- [ ] **Step 5: Actualizar documentos con estados honestos**

Cambiar sólo gates respaldados por evidencia:

- visor planar: implementado/no autoritativo;
- S3D-1: funcional experimental si G1–G7 pasan;
- S3D-2–S3D-4: no implementados;
- no certificar seguridad estructural ni tecnologías asistivas no probadas.

- [ ] **Step 6: Crear reporte de cambio**

Resolver `$reportPath = "reports/$(Get-Date -Format 'yyyy-MM-dd-HHmm')-space-3d-funcional.md"` y crearlo mediante `apply_patch`. Incluir preflight, respaldo, arquitectura, matriz de archivos, TDD RED/GREEN, oráculos/versiones/hashes, comandos/resultados, bundle, navegador, gates, deuda, trabajo ajeno preservado, commit y no-push. Conservar esa ruta exacta para Step 7.

- [ ] **Step 7: Staging explícito y revisión final**

```powershell
git add -- src/space3d src/features/space3d src/App.tsx src/App.test.tsx src/features/welcome/WelcomeScreen.tsx src/features/welcome/WelcomeScreen.test.tsx src/i18n/catalogs.ts src/styles.css validation/space3d scripts/check-space3d-capacity.mjs scripts/space3d-capacity-policy.mjs scripts/check-space3d-capacity.test.mjs package.json docs/architecture $reportPath reports/evidence/2026-08-09-space3d
git diff --cached --check
git diff --cached --name-status
```

Confirmar que no están `src/data/modelOperations.ts`, `.worktrees/` ni reportes ajenos.

- [ ] **Step 8: Commit final de cierre**

```powershell
git commit -m "feat: deliver functional experimental space 3d analysis"
git show --stat --oneline HEAD
git status --short --branch
```

No hacer `push`; informar SHA local y trabajo ajeno preservado.
