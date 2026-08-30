# Datasheet como editor estructural (CRI-82) — Implementation Plan

**Clasificación:** `HISTORICAL`

> **HISTORICAL** — Plan de ejecución de CRI-82; conserva el método y la evidencia
> de esa entrega y no certifica por sí solo el estado actual. El contrato vigente
> es [Datasheet estructural](../../architecture/structureco-datasheet.md), el
> código y sus pruebas.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el datasheet de sólo lectura de CRI-81 en un editor estructural visual donde se editan nudos, barras y cargas viendo el resultado antes de aplicarlo, con unidades correctas, validación y cambios múltiples atómicos.

**Architecture:** Tres entradas (celda inline, editor visual del panel, pegado) alimentan un único borrador `rowId|fieldId → texto crudo`. Un módulo puro lo interpreta, convierte unidades y lo valida hasta un `DatasheetEditPlan` en unidades base. `applyDatasheetPlan` es la única escritura y alimenta a la vez el proyecto de preview y el `updateProject` real, así que lo que se ve es exactamente lo que se escribe.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library, sistema de diseño Clay propio (`src/design-system`), sin dependencias nuevas.

## Global Constraints

- **No se instalan dependencias.** `AGENTS.md` lo prohíbe sin autorización explícita. Nada de TanStack Table.
- **No se toca el solver ni la teoría estructural** (`src/engine/**`, `src/workers/**`).
- **No se amplía `ProjectCommand` ni `ProjectEntityCollection`** (`src/commands/projectCommand.ts` queda intacto).
- **No se amplía `Selection`** (`src/types.ts:657`).
- **El datasheet no tiene store, historial ni undo propios.** La única escritura es `updateProject` de `useProjectModel`.
- **Una aplicación = un `updateProject`.** Nunca dos entradas de historial para un mismo plan, nunca una escritura parcial.
- **Unidades:** el modelo (`datasheetModel.ts`) ordena y filtra en unidades base (kN, m, m², m⁴). La conversión ocurre al presentar y al interpretar, en ningún otro sitio.
- **Estilo:** tabla plana, sin sombra clay por fila. Sólo tokens semánticos `--sc-*`; ni un color literal ni `rgba()`. Lo fija `datasheetStyles.test.ts`.
- **i18n:** toda cadena visible en `src/i18n/catalogs.ts`, en `es` y en `en`. Ninguna cadena literal en un componente.
- **Comentarios en castellano**, explicando el *porqué* de las decisiones no obvias, como el resto de `src/features/datasheet/**`.
- **Verificación por tarea:** `npx vitest run src/features/datasheet --maxWorkers=1` y, al cerrar, `npx tsc --noEmit -p tsconfig.app.json`.

---

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/features/datasheet/datasheetModel.ts` | **Modificar.** Nueva unión de editabilidad, valor `ref`, entidad `loads`. | 1, 2 |
| `src/features/datasheet/datasheetPresentation.ts` | **Modificar.** Texto del valor `ref` y mensajes de editabilidad. | 1 |
| `src/features/datasheet/datasheetEditModel.ts` | **Crear.** Registro de campos editables; apoya en `bulkEditProperties.ts`. | 3 |
| `src/features/datasheet/datasheetEditDraft.ts` | **Crear.** Borrador, interpretación, unidades, validación, coincidencias. | 4 |
| `src/features/datasheet/datasheetEditApply.ts` | **Crear.** `applyDatasheetPlan`: la única escritura. | 5 |
| `src/features/datasheet/datasheetPaste.ts` | **Crear.** Portapapeles a entradas del borrador. | 6 |
| `src/features/datasheet/DatasheetCellEditor.tsx` | **Crear.** Editor dentro de la celda. | 7 |
| `src/features/datasheet/DatasheetGrid.tsx` | **Modificar.** Apertura del editor, pegado, indicador de pendiente. | 7 |
| `src/features/datasheet/DatasheetEditorPanel.tsx` | **Crear.** Sustituye a `DatasheetContextPanel` con editores y previews. | 8 |
| `src/features/datasheet/DatasheetContextPanel.tsx` | **Eliminar** al final de la tarea 8; su contenido se muda. | 8 |
| `src/features/datasheet/DatasheetReviewPanel.tsx` | **Crear.** Revisión del plan, `Aplicar todo` / `Cancelar`. | 9 |
| `src/features/datasheet/DatasheetPanel.tsx` | **Modificar.** Cablea borrador, plan, preview y aplicación. | 7, 8, 9 |
| `src/features/datasheet/datasheet.css` | **Modificar.** Editores, estado pendiente, revisión, previews. | 10 |
| `src/i18n/catalogs.ts` | **Modificar.** Claves nuevas en `es` y `en`. | 10 |
| `docs/architecture/structureco-datasheet-cri-81.md` | **Modificar.** Contrato vigente tras CRI-82. | 10 |

**Por qué el panel de revisión no es un `Dialog`.** `ModalSurface` registra su `keydown` de `Escape` en `document` y no detiene la propagación. Un `Dialog` anidado dentro del `Drawer` del datasheet cerraría los dos con una sola pulsación. La revisión se renderiza **dentro** del drawer, en el carril del panel contextual.

---

### Task 1: Contrato de editabilidad y valor `ref`

CRI-81 declaró `pending` («editable, todavía no»). Esta fase la sustituye por **dónde** se edita cada celda. Además, la columna de caso de carga necesita mostrar un nombre que escribe el usuario, no una traducción: para eso entra el valor `ref`.

**Files:**
- Modify: `src/features/datasheet/datasheetModel.ts`
- Modify: `src/features/datasheet/datasheetPresentation.ts`
- Modify: `src/features/datasheet/datasheetModel.test.ts`
- Modify: `src/features/datasheet/DatasheetGrid.tsx` (sólo `aria-readonly`)

**Interfaces:**
- Produces:
  - `type DatasheetEditability = 'identity' | 'derived' | 'inline' | 'panel'`
  - `type DatasheetValue = … | { kind: 'ref'; id: string; label: string }`
  - `interface DatasheetFacetOption { token: string; labelKey?: TranslationKey; label?: string; count: number }`
  - `editabilityMessageKey(editability): TranslationKey` con las cuatro ramas

- [ ] **Step 1: Escribir la prueba que falla**

En `src/features/datasheet/datasheetModel.test.ts`, añadir:

```ts
import { NODE_COLUMNS, MEMBER_COLUMNS } from './datasheetModel';

describe('contrato de editabilidad', () => {
  it('no deja ninguna columna en el estado provisional de CRI-81', () => {
    const all = [...NODE_COLUMNS, ...MEMBER_COLUMNS];
    expect(all.map((column) => column.editability)).not.toContain('pending');
  });

  it('abre exactamente las columnas que CRI-81 declaró pendientes', () => {
    const editable = (columns: readonly { id: string; editability: string }[]) =>
      columns.filter((column) => column.editability === 'inline' || column.editability === 'panel')
        .map((column) => column.id);
    expect(editable(NODE_COLUMNS)).toEqual(['x', 'y', 'support', 'hinge']);
    expect(editable(MEMBER_COLUMNS)).toEqual(['type', 'material', 'E', 'section', 'A', 'I', 'releases']);
  });

  it('mantiene identidad y derivadas cerradas', () => {
    expect(NODE_COLUMNS.find((column) => column.id === 'id')?.editability).toBe('identity');
    expect(NODE_COLUMNS.find((column) => column.id === 'restraints')?.editability).toBe('derived');
    expect(MEMBER_COLUMNS.find((column) => column.id === 'i')?.editability).toBe('identity');
    expect(MEMBER_COLUMNS.find((column) => column.id === 'length')?.editability).toBe('derived');
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

```bash
npx vitest run src/features/datasheet/datasheetModel.test.ts --maxWorkers=1
```

Esperado: FAIL — `pending` sigue presente en las columnas.

- [ ] **Step 3: Cambiar la unión y las columnas**

En `datasheetModel.ts`, sustituir el tipo:

```ts
/**
 * Por qué una celda no se edita, o **dónde** se edita.
 *
 * CRI-81 declaró `pending` como promesa de la fase de edición. CRI-82 la cumple
 * y la sustituye: cada celda editable dice ahora si se edita en la propia celda
 * o sólo en el editor visual, porque escribe varios campos a la vez y aplicarla
 * a medias dejaría estados que nadie pidió.
 */
export type DatasheetEditability =
  /** Nunca editable: identidad y referencias estructurales. */
  | 'identity'
  /** Nunca editable: se calcula del modelo. */
  | 'derived'
  /** Editable en la propia celda. */
  | 'inline'
  /** Editable sólo en el editor visual del panel. */
  | 'panel';
```

Y en las columnas: `x`, `y`, `support`, `hinge`, `type`, `E`, `A`, `I` pasan a `'inline'`; `material` y `section` pasan a `'inline'` (la celda elige del catálogo; el modo Personalizado vive en el panel); `releases` pasa a `'panel'`.

Añadir el valor `ref` a la unión:

```ts
  /**
   * Referencia a una entidad que el usuario nombra (un caso de carga). A
   * diferencia de `token`, aquí la etiqueta **es** dato del proyecto, no una
   * traducción, así que ordenar por ella es lo correcto y no depende del idioma.
   */
  | { kind: 'ref'; id: string; label: string }
```

En `compareValues`, tratar `ref` como texto por su `label`:

```ts
  const asText = (value: DatasheetValue): string =>
    value.kind === 'token' ? value.token
      : value.kind === 'text' ? value.text
        : value.kind === 'ref' ? value.label
          : '';
  return asText(first).localeCompare(asText(second), undefined, { numeric: true, sensitivity: 'base' });
```

En `datasheetRowSearchText`, añadir `else if (value.kind === 'ref') parts.push(value.label);`.

En `datasheetFacets`, aceptar también `ref` (su `token` es el `id`, su `label` la etiqueta) y extraer el tipo de opción:

```ts
export interface DatasheetFacetOption {
  token: string;
  /** Etiqueta traducible de un enumerado del dominio. */
  labelKey?: TranslationKey;
  /** Etiqueta que escribe el usuario; excluyente con `labelKey`. */
  label?: string;
  count: number;
}
```

`DatasheetFacet.options` pasa a `readonly DatasheetFacetOption[]`.

- [ ] **Step 4: Actualizar presentación y rejilla**

En `datasheetPresentation.ts`:

```ts
const EDITABILITY_MESSAGES: Record<DatasheetEditability, TranslationKey> = {
  identity: 'datasheet.readOnly.identity',
  derived: 'datasheet.readOnly.derived',
  inline: 'datasheet.edit.inlineHint',
  panel: 'datasheet.edit.panelHint',
};
```

Y en `datasheetCellText`, antes del retorno numérico: `if (value.kind === 'ref') return value.label;`

En `DatasheetGrid.tsx`, el `aria-readonly` fijo pasa a depender de la columna:

```ts
aria-readonly={column.editability === 'identity' || column.editability === 'derived'}
```

- [ ] **Step 5: Añadir las claves i18n mínimas**

En `src/i18n/catalogs.ts`, junto a `datasheet.readOnly.*` (borrar `datasheet.readOnly.pending`), en `es`:

```ts
  'datasheet.edit.inlineHint': 'Pulsa Intro o F2 para editar {column}.',
  'datasheet.edit.panelHint': '{column} se edita en el panel de la derecha.',
```

En `en`:

```ts
  'datasheet.edit.inlineHint': 'Press Enter or F2 to edit {column}.',
  'datasheet.edit.panelHint': '{column} is edited in the right-hand panel.',
```

- [ ] **Step 6: Ejecutar la suite del datasheet**

```bash
npx vitest run src/features/datasheet --maxWorkers=1
```

Esperado: PASS. Si `DatasheetAccessibility.test.tsx` afirma sobre el mensaje de `pending`, actualizar esa afirmación al mensaje de `inline`.

- [ ] **Step 7: Commit**

```bash
git add src/features/datasheet src/i18n/catalogs.ts
git commit -m "refactor: turn the datasheet pending editability into inline and panel"
```

---

### Task 2: Entidad Cargas en la tabla

**Files:**
- Modify: `src/features/datasheet/datasheetModel.ts`
- Modify: `src/features/datasheet/datasheetModel.test.ts`
- Modify: `src/features/datasheet/DatasheetPanel.tsx` (tercer botón de entidad)

**Interfaces:**
- Consumes: `DatasheetEditability`, `DatasheetValue.ref` (tarea 1)
- Produces:
  - `type DatasheetEntity = 'nodes' | 'members' | 'loads'`
  - `DatasheetRow.kind: 'node' | 'member' | 'nodalLoad' | 'memberLoad'`
  - `const LOAD_COLUMNS: readonly DatasheetColumn[]`

- [ ] **Step 1: Escribir la prueba que falla**

En `datasheetModel.test.ts`:

```ts
import { createDatasheetProject } from './datasheetFixtures';
import { datasheetColumns, datasheetFacets, projectDatasheetRows } from './datasheetModel';

describe('entidad de cargas', () => {
  const project = createDatasheetProject();
  const rows = projectDatasheetRows(project, 'loads');

  it('proyecta las cargas nodales y las de barra en una sola tabla', () => {
    expect(rows.map((row) => row.id)).toEqual(['NL1', 'ML1']);
    expect(rows.map((row) => row.kind)).toEqual(['nodalLoad', 'memberLoad']);
  });

  it('nombra el objeto y la familia de cada carga', () => {
    expect(rows[0].values.object).toEqual({ kind: 'text', text: 'N3' });
    expect(rows[0].values.family).toMatchObject({ kind: 'token', token: 'nodal' });
    expect(rows[1].values.family).toMatchObject({ kind: 'token', token: 'distributed' });
  });

  it('muestra el caso con el nombre que le puso el usuario', () => {
    expect(rows[0].values.case).toEqual({ kind: 'ref', id: 'LC1', label: 'Permanente' });
  });

  it('deja vacía toda celda fuera de la familia de la fila', () => {
    // Una repartida no tiene Fx: la celda es ausencia real, no cero.
    expect(rows[1].values.fx).toEqual({ kind: 'number', value: null, quantity: 'force' });
    expect(rows[0].values.qyStart).toEqual({ kind: 'number', value: null, quantity: 'distributedForce' });
  });

  it('guarda las magnitudes en unidades base', () => {
    expect(rows[0].values.fx).toEqual({ kind: 'number', value: 10, quantity: 'force' });
    expect(rows[1].values.qyStart).toEqual({ kind: 'number', value: -12, quantity: 'distributedForce' });
  });

  it('ofrece familia y caso como facetas', () => {
    expect(datasheetFacets(rows, 'loads').map((facet) => facet.columnId)).toEqual(['family', 'case']);
  });

  it('cierra las columnas de identidad de la carga', () => {
    const byId = new Map(datasheetColumns('loads').map((column) => [column.id, column.editability]));
    expect(byId.get('id')).toBe('identity');
    expect(byId.get('object')).toBe('identity');
    expect(byId.get('family')).toBe('identity');
    expect(byId.get('case')).toBe('inline');
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

```bash
npx vitest run src/features/datasheet/datasheetModel.test.ts --maxWorkers=1
```

Esperado: FAIL — `'loads'` no es una `DatasheetEntity`.

- [ ] **Step 3: Implementar la entidad**

En `datasheetModel.ts`:

```ts
export type DatasheetEntity = 'nodes' | 'members' | 'loads';

const LOAD_FAMILY_LABELS: Record<string, TranslationKey> = {
  nodal: 'datasheet.loadFamily.nodal',
  distributed: 'datasheet.loadFamily.distributed',
  point: 'datasheet.loadFamily.point',
  moment: 'datasheet.loadFamily.moment',
};

const COORDINATE_SYSTEM_LABELS: Record<string, TranslationKey> = {
  global: 'datasheet.coordinateSystem.global',
  local: 'datasheet.coordinateSystem.local',
};

const LENGTH_BASIS_LABELS: Record<string, TranslationKey> = {
  real: 'datasheet.lengthBasis.real',
  horizontal: 'datasheet.lengthBasis.horizontal',
  vertical: 'datasheet.lengthBasis.vertical',
};
```

Añadir a `TOKEN_ORDER`: `family: ['nodal', 'distributed', 'point', 'moment']`.

```ts
/**
 * Columnas de la tabla de cargas: la **unión** de las dos familias del modelo.
 *
 * Una celda que no pertenece a la familia de su fila se proyecta como ausencia
 * (`value: null`), no como cero: una repartida no tiene un Fx que valga cero,
 * tiene un Fx que no existe. `datasheetEditModel` la cierra a la edición con el
 * motivo `load-family`, el mismo vocabulario que usa la edición múltiple.
 *
 * Familia y objeto son `identity`: convertir una repartida en puntual no es
 * editar un campo, es sustituir una carga por otra con otros campos obligatorios.
 */
export const LOAD_COLUMNS: readonly DatasheetColumn[] = [
  { id: 'id', labelKey: 'datasheet.column.id', editability: 'identity' },
  { id: 'object', labelKey: 'datasheet.column.loadObject', editability: 'identity' },
  { id: 'family', labelKey: 'datasheet.column.loadFamily', editability: 'identity' },
  { id: 'case', labelKey: 'datasheet.column.loadCase', editability: 'inline' },
  { id: 'fx', labelKey: 'datasheet.column.fx', editability: 'inline', quantity: 'force', numeric: true },
  { id: 'fy', labelKey: 'datasheet.column.fy', editability: 'inline', quantity: 'force', numeric: true },
  { id: 'mz', labelKey: 'datasheet.column.mz', editability: 'inline', quantity: 'moment', numeric: true },
  { id: 'coordinateSystem', labelKey: 'datasheet.column.coordinateSystem', editability: 'inline' },
  { id: 'lengthBasis', labelKey: 'datasheet.column.lengthBasis', editability: 'inline' },
  { id: 'start', labelKey: 'datasheet.column.start', editability: 'inline', numeric: true },
  { id: 'end', labelKey: 'datasheet.column.end', editability: 'inline', numeric: true },
  { id: 'qxStart', labelKey: 'datasheet.column.qxStart', editability: 'inline', quantity: 'distributedForce', numeric: true },
  { id: 'qxEnd', labelKey: 'datasheet.column.qxEnd', editability: 'inline', quantity: 'distributedForce', numeric: true },
  { id: 'qyStart', labelKey: 'datasheet.column.qyStart', editability: 'inline', quantity: 'distributedForce', numeric: true },
  { id: 'qyEnd', labelKey: 'datasheet.column.qyEnd', editability: 'inline', quantity: 'distributedForce', numeric: true },
  { id: 'position', labelKey: 'datasheet.column.position', editability: 'inline', numeric: true },
  { id: 'px', labelKey: 'datasheet.column.px', editability: 'inline', quantity: 'force', numeric: true },
  { id: 'py', labelKey: 'datasheet.column.py', editability: 'inline', quantity: 'force', numeric: true },
  { id: 'moment', labelKey: 'datasheet.column.momentValue', editability: 'inline', quantity: 'moment', numeric: true },
];
```

`datasheetColumns` devuelve `LOAD_COLUMNS` para `'loads'`; `datasheetFacetColumnIds` devuelve `['family', 'case']`.

Proyección — una función por familia, y un ayudante para la ausencia:

```ts
const absent = (quantity?: UnitQuantity): DatasheetValue => ({ kind: 'number', value: null, quantity });

const optionalNumber = (value: number | undefined, quantity?: UnitQuantity): DatasheetValue =>
  ({ kind: 'number', value: value ?? null, quantity });

const caseValue = (caseId: string, caseNames: ReadonlyMap<string, string>): DatasheetValue =>
  // Un caso borrado deja su id a la vista en vez de una celda vacía que
  // escondería que la carga apunta a un caso que ya no existe.
  ({ kind: 'ref', id: caseId, label: caseNames.get(caseId) ?? caseId });

const nodalLoadRow = (load: NodalLoad, caseNames: ReadonlyMap<string, string>): DatasheetRow => ({
  id: load.id,
  kind: 'nodalLoad',
  values: {
    id: { kind: 'text', text: load.id },
    object: { kind: 'text', text: load.nodeId },
    family: { kind: 'token', token: 'nodal', labelKey: LOAD_FAMILY_LABELS.nodal },
    case: caseValue(load.caseId, caseNames),
    fx: { kind: 'number', value: load.fx, quantity: 'force' },
    fy: { kind: 'number', value: load.fy, quantity: 'force' },
    mz: { kind: 'number', value: load.mz, quantity: 'moment' },
    coordinateSystem: absent(),
    lengthBasis: absent(),
    start: absent(), end: absent(),
    qxStart: absent('distributedForce'), qxEnd: absent('distributedForce'),
    qyStart: absent('distributedForce'), qyEnd: absent('distributedForce'),
    position: absent(),
    px: absent('force'), py: absent('force'), moment: absent('moment'),
  },
});

const memberLoadRow = (load: MemberLoad, caseNames: ReadonlyMap<string, string>): DatasheetRow => {
  const distributed = load.type === 'distributed';
  const point = load.type === 'point';
  const moment = load.type === 'moment';
  return {
    id: load.id,
    kind: 'memberLoad',
    values: {
      id: { kind: 'text', text: load.id },
      object: { kind: 'text', text: load.memberId },
      family: { kind: 'token', token: load.type, labelKey: LOAD_FAMILY_LABELS[load.type] },
      case: caseValue(load.caseId, caseNames),
      fx: absent('force'), fy: absent('force'), mz: absent('moment'),
      coordinateSystem: moment
        ? absent()
        : { kind: 'token', token: load.coordinateSystem, labelKey: COORDINATE_SYSTEM_LABELS[load.coordinateSystem] },
      lengthBasis: distributed
        ? { kind: 'token', token: load.lengthBasis, labelKey: LENGTH_BASIS_LABELS[load.lengthBasis] }
        : absent(),
      start: distributed ? { kind: 'number', value: load.start } : absent(),
      end: distributed ? { kind: 'number', value: load.end } : absent(),
      qxStart: distributed ? optionalNumber(load.qxStart, 'distributedForce') : absent('distributedForce'),
      qxEnd: distributed ? optionalNumber(load.qxEnd, 'distributedForce') : absent('distributedForce'),
      qyStart: distributed ? optionalNumber(load.qyStart, 'distributedForce') : absent('distributedForce'),
      qyEnd: distributed ? optionalNumber(load.qyEnd, 'distributedForce') : absent('distributedForce'),
      position: point || moment ? optionalNumber(load.position) : absent(),
      px: point ? optionalNumber(load.px, 'force') : absent('force'),
      py: point ? optionalNumber(load.py, 'force') : absent('force'),
      moment: moment ? optionalNumber(load.moment, 'moment') : absent('moment'),
    },
  };
};
```

En `projectDatasheetRows`, antes de la rama de nudos:

```ts
  if (entity === 'loads') {
    const caseNames = new Map(project.loadCases.map((item) => [item.id, item.name]));
    return [
      ...project.nodalLoads.map((load) => nodalLoadRow(load, caseNames)),
      ...project.memberLoads.map((load) => memberLoadRow(load, caseNames)),
    ];
  }
```

En `datasheetFacets`, aceptar el valor `ref`:

```ts
      const value = row.values[columnId];
      const token = value?.kind === 'token' ? value.token : value?.kind === 'ref' ? value.id : null;
      if (token === null) continue;
      const current = counts.get(token);
      if (current) current.count += 1;
      else counts.set(token, value.kind === 'token'
        ? { labelKey: value.labelKey, count: 1 }
        : { label: value.label, count: 1 });
```

Y en `filterDatasheetRows`, la misma extensión:

```ts
    const value = row.values[columnId];
    if (value?.kind === 'token') return tokens.has(value.token);
    return value?.kind === 'ref' && tokens.has(value.id);
```

- [ ] **Step 4: Ejecutar y ver que pasa**

```bash
npx vitest run src/features/datasheet/datasheetModel.test.ts --maxWorkers=1
```

Esperado: PASS.

- [ ] **Step 5: Añadir la pestaña y sus claves**

En `DatasheetPanel.tsx`, sustituir `(['nodes', 'members'] as const)` por `(['nodes', 'members', 'loads'] as const)`, y el recuento y la etiqueta:

```tsx
              {t(candidate === 'nodes' ? 'datasheet.entity.nodes'
                : candidate === 'members' ? 'datasheet.entity.members' : 'datasheet.entity.loads')}
              <span className="datasheet-entity__count">
                {candidate === 'nodes' ? project.nodes.length
                  : candidate === 'members' ? project.members.length
                    : project.nodalLoads.length + project.memberLoads.length}
              </span>
```

En `selectionIds`, la entidad `loads` mapea a las selecciones de una sola carga:

```ts
const selectionIds = (selection: Selection, entity: DatasheetEntity): ReadonlySet<string> => {
  if (!selection) return new Set();
  if (entity === 'loads') {
    // `Selection.multi` sólo transporta nudos y miembros, así que una tabla de
    // cargas sincroniza como mucho la fila enfocada. No se amplía `Selection`:
    // editar varias cargas no lo necesita, porque las ediciones son por celda.
    return selection.kind === 'nodalLoad' || selection.kind === 'memberLoad' ? new Set([selection.id]) : new Set();
  }
  …
};
```

Y `buildSelection` gana su rama de cargas, que devuelve la selección simple o `null`:

```ts
const buildLoadSelection = (rows: readonly DatasheetRow[], ids: readonly string[]): Selection => {
  const row = ids.length === 1 ? rows.find((candidate) => candidate.id === ids[0]) : undefined;
  if (!row) return null;
  return row.kind === 'nodalLoad' ? { kind: 'nodalLoad', id: row.id } : { kind: 'memberLoad', id: row.id };
};
```

Añadir en `catalogs.ts` (`es` y `en`) las claves `datasheet.entity.loads`, `datasheet.column.loadObject`, `datasheet.column.loadFamily`, `datasheet.column.loadCase`, `datasheet.column.fx|fy|mz|qxStart|qxEnd|qyStart|qyEnd|start|end|position|px|py|momentValue|coordinateSystem|lengthBasis`, `datasheet.loadFamily.*`, `datasheet.coordinateSystem.*`, `datasheet.lengthBasis.*`.

Valores en `es`: `'Cargas'`, `'Objeto'`, `'Familia'`, `'Caso'`, `'Fx'`, `'Fy'`, `'Mz'`, `'qx inicio'`, `'qx fin'`, `'qy inicio'`, `'qy fin'`, `'Inicio x/L'`, `'Fin x/L'`, `'Posición x/L'`, `'Px'`, `'Py'`, `'M'`, `'Ejes'`, `'Longitud'`; familias `'Nodal'`, `'Repartida'`, `'Puntual'`, `'Momento'`; ejes `'Globales'`, `'Locales'`; longitud `'Real'`, `'Horizontal'`, `'Vertical'`.

En `en`: `'Loads'`, `'Object'`, `'Family'`, `'Case'`, mismas siglas, `'q x start'`, `'q x end'`, `'q y start'`, `'q y end'`, `'Start x/L'`, `'End x/L'`, `'Position x/L'`, `'Px'`, `'Py'`, `'M'`, `'Axes'`, `'Length'`; `'Nodal'`, `'Distributed'`, `'Point'`, `'Moment'`; `'Global'`, `'Local'`; `'Real'`, `'Horizontal'`, `'Vertical'`.

- [ ] **Step 6: Ejecutar la suite y el typecheck**

```bash
npx vitest run src/features/datasheet --maxWorkers=1
npx tsc --noEmit -p tsconfig.app.json
```

Esperado: PASS y cero errores de tipo.

- [ ] **Step 7: Commit**

```bash
git add src/features/datasheet src/i18n/catalogs.ts
git commit -m "feat: project loads as a third datasheet entity"
```

---

### Task 3: Registro de campos editables

**Files:**
- Create: `src/features/datasheet/datasheetEditModel.ts`
- Test: `src/features/datasheet/datasheetEditModel.test.ts`

**Interfaces:**
- Consumes: `DatasheetEntity`, `datasheetColumns` (tareas 1–2); `bulkPropertyDescriptors` de `../bulk-edit/bulkEditProperties`; `BulkIncompatibilityReason` de `../bulk-edit/bulkEditTypes`
- Produces:
  - `type DatasheetFieldId` (unión literal)
  - `interface DatasheetField { id; kind; quantity?; unit?; options?; optionsFrom?; positive?; min?; max? }`
  - `datasheetField(id: DatasheetFieldId): DatasheetField`
  - `datasheetColumnField(entity: DatasheetEntity, columnId: string): DatasheetFieldId | undefined`
  - `datasheetFieldIneligibility(fieldId, target: DatasheetEditTarget): BulkIncompatibilityReason | undefined`
  - `type DatasheetEditTarget = { kind: 'node'; node: NodeModel } | { kind: 'member'; member: MemberModel } | { kind: 'nodalLoad'; load: NodalLoad } | { kind: 'memberLoad'; load: MemberLoad }`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/features/datasheet/datasheetEditModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDatasheetProject } from './datasheetFixtures';
import { datasheetColumns, type DatasheetEntity } from './datasheetModel';
import { datasheetColumnField, datasheetField, datasheetFieldIneligibility } from './datasheetEditModel';

describe('registro de campos editables', () => {
  const entities: readonly DatasheetEntity[] = ['nodes', 'members', 'loads'];

  it('da campo a toda columna inline y a ninguna cerrada', () => {
    for (const entity of entities) {
      for (const column of datasheetColumns(entity)) {
        const field = datasheetColumnField(entity, column.id);
        if (column.editability === 'inline') expect(field, `${entity}.${column.id}`).toBeDefined();
        else if (column.editability !== 'panel') expect(field, `${entity}.${column.id}`).toBeUndefined();
      }
    }
  });

  it('hereda cantidad y opciones de la edición múltiple en vez de redeclararlas', () => {
    expect(datasheetField('member.E').quantity).toBe('elasticModulus');
    expect(datasheetField('member.type').options).toEqual(['frame', 'truss', 'rigid']);
    expect(datasheetField('node.support.type').options)
      .toEqual(['none', 'pin', 'roller', 'fixed', 'custom']);
  });

  it('declara las dos coordenadas que ningún registro previo tiene', () => {
    expect(datasheetField('node.x')).toMatchObject({ kind: 'number', quantity: 'length' });
    expect(datasheetField('node.y')).toMatchObject({ kind: 'number', quantity: 'length' });
  });

  it('exige positivo donde un cero haría singular la rigidez', () => {
    for (const id of ['member.E', 'member.A', 'member.I'] as const) {
      expect(datasheetField(id).positive, id).toBe(true);
    }
    expect(datasheetField('node.x').positive).toBeUndefined();
  });

  it('acota las posiciones normalizadas del modelo', () => {
    expect(datasheetField('memberLoad.position')).toMatchObject({ min: 0, max: 1 });
    expect(datasheetField('memberLoad.start')).toMatchObject({ min: 0, max: 1 });
  });

  it('rechaza un campo fuera de la familia de su carga, con el motivo de bulk-edit', () => {
    const project = createDatasheetProject();
    const distributed = project.memberLoads[0];
    expect(datasheetFieldIneligibility('memberLoad.qyStart', { kind: 'memberLoad', load: distributed }))
      .toBeUndefined();
    expect(datasheetFieldIneligibility('memberLoad.px', { kind: 'memberLoad', load: distributed }))
      .toBe('load-family');
  });

  it('rechaza rigidez sobre una barra rígida', () => {
    const project = createDatasheetProject();
    const rigid = { ...project.members[0], type: 'rigid' as const };
    expect(datasheetFieldIneligibility('member.E', { kind: 'member', member: rigid })).toBe('member-type');
  });

  it('rechaza las restricciones fuera de un apoyo personalizado', () => {
    const project = createDatasheetProject();
    expect(datasheetFieldIneligibility('node.support.restrainX', { kind: 'node', node: project.nodes[0] }))
      .toBe('support-type');
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

```bash
npx vitest run src/features/datasheet/datasheetEditModel.test.ts --maxWorkers=1
```

Esperado: FAIL — `datasheetEditModel` no existe.

- [ ] **Step 3: Implementar el registro**

Crear `src/features/datasheet/datasheetEditModel.ts`:

```ts
import type { UnitQuantity } from '../../engine/units';
import type { MemberLoad, MemberModel, NodalLoad, NodeModel } from '../../types';
import { bulkPropertyDescriptors } from '../bulk-edit/bulkEditProperties';
import type { BulkIncompatibilityReason, BulkPropertyId } from '../bulk-edit/bulkEditTypes';
import type { DatasheetEntity } from './datasheetModel';

/**
 * Qué campo del modelo escribe cada celda editable.
 *
 * Casi todo lo que hay aquí ya está descrito en `bulkEditProperties.ts`: qué
 * cantidad física tiene, qué opciones admite y por qué una entidad lo rechaza.
 * Este registro **lee de allí** en vez de repetirlo, para que añadir un tipo de
 * apoyo o de barra siga rompiendo un único sitio.
 *
 * Las dos excepciones son `node.x` y `node.y`, que ni la edición múltiple ni
 * `ProjectCommand` declaran: por eso el datasheet escribe siempre por
 * `updateProject`, que es la ruta reversible que ya usa el Inspector.
 */

export type DatasheetFieldId =
  | 'node.x'
  | 'node.y'
  | BulkBackedFieldId;

/** Campos que la edición múltiple ya describe; su id es literalmente el suyo. */
type BulkBackedFieldId = Extract<BulkPropertyId,
  | 'node.support.type' | 'node.support.angleDeg'
  | 'node.support.restrainX' | 'node.support.restrainY' | 'node.support.restrainR'
  | 'node.internalHinge'
  | 'member.type' | 'member.materialId' | 'member.sectionId'
  | 'member.E' | 'member.A' | 'member.I' | 'member.G' | 'member.density'
  | 'member.releases.iMoment' | 'member.releases.jMoment'
  | 'nodalLoad.caseId' | 'nodalLoad.fx' | 'nodalLoad.fy' | 'nodalLoad.mz'
  | 'memberLoad.caseId' | 'memberLoad.coordinateSystem' | 'memberLoad.lengthBasis'
  | 'memberLoad.start' | 'memberLoad.end'
  | 'memberLoad.qxStart' | 'memberLoad.qxEnd' | 'memberLoad.qyStart' | 'memberLoad.qyEnd'
  | 'memberLoad.position' | 'memberLoad.px' | 'memberLoad.py' | 'memberLoad.moment'
>;

export type DatasheetFieldKind = 'number' | 'enum' | 'boolean' | 'material' | 'section';

export interface DatasheetField {
  id: DatasheetFieldId;
  kind: DatasheetFieldKind;
  quantity?: UnitQuantity;
  /** Unidad fija que no depende del sistema del proyecto (grados, x/L). */
  unit?: string;
  options?: readonly string[];
  /** Enumerado cuyas opciones las declara el proyecto, no una unión del dominio. */
  optionsFrom?: 'loadCases';
  /** Estrictamente positivo: un cero haría singular la matriz de rigidez. */
  positive?: boolean;
  min?: number;
  max?: number;
}

export type DatasheetEditTarget =
  | { kind: 'node'; node: NodeModel }
  | { kind: 'member'; member: MemberModel }
  | { kind: 'nodalLoad'; load: NodalLoad }
  | { kind: 'memberLoad'; load: MemberLoad };

const descriptorById = new Map(bulkPropertyDescriptors.map((descriptor) => [descriptor.id, descriptor]));

/** Sólo estas tres exigen positivo; el resto admite el cero y el negativo. */
const POSITIVE_FIELDS: ReadonlySet<DatasheetFieldId> = new Set(['member.E', 'member.A', 'member.I']);

/** Posiciones normalizadas del modelo: fuera de [0, 1] no hay barra donde caer. */
const NORMALIZED_FIELDS: ReadonlySet<DatasheetFieldId> = new Set([
  'memberLoad.start', 'memberLoad.end', 'memberLoad.position',
]);

const COORDINATE_FIELDS: Readonly<Record<'node.x' | 'node.y', DatasheetField>> = {
  'node.x': { id: 'node.x', kind: 'number', quantity: 'length' },
  'node.y': { id: 'node.y', kind: 'number', quantity: 'length' },
};

export const datasheetField = (id: DatasheetFieldId): DatasheetField => {
  if (id === 'node.x' || id === 'node.y') return COORDINATE_FIELDS[id];
  const descriptor = descriptorById.get(id);
  // El registro de bulk-edit es la fuente; un id sin descriptor es un error de
  // programación, no un estado que la interfaz deba saber dibujar.
  if (!descriptor) throw new Error(`El datasheet no conoce el campo ${id}.`);
  return {
    id,
    kind: descriptor.kind,
    quantity: descriptor.quantity,
    unit: descriptor.unit,
    options: descriptor.options,
    optionsFrom: id === 'nodalLoad.caseId' || id === 'memberLoad.caseId' ? 'loadCases' : undefined,
    positive: POSITIVE_FIELDS.has(id) ? true : undefined,
    min: NORMALIZED_FIELDS.has(id) ? 0 : undefined,
    max: NORMALIZED_FIELDS.has(id) ? 1 : undefined,
  };
};

/** Columna de la tabla al campo que escribe. Lo que no está aquí, no se edita. */
const COLUMN_FIELDS: Record<DatasheetEntity, Readonly<Record<string, DatasheetFieldId>>> = {
  nodes: {
    x: 'node.x',
    y: 'node.y',
    support: 'node.support.type',
    hinge: 'node.internalHinge',
  },
  members: {
    type: 'member.type',
    material: 'member.materialId',
    section: 'member.sectionId',
    E: 'member.E',
    A: 'member.A',
    I: 'member.I',
  },
  loads: {
    case: 'nodalLoad.caseId',
    fx: 'nodalLoad.fx',
    fy: 'nodalLoad.fy',
    mz: 'nodalLoad.mz',
    coordinateSystem: 'memberLoad.coordinateSystem',
    lengthBasis: 'memberLoad.lengthBasis',
    start: 'memberLoad.start',
    end: 'memberLoad.end',
    qxStart: 'memberLoad.qxStart',
    qxEnd: 'memberLoad.qxEnd',
    qyStart: 'memberLoad.qyStart',
    qyEnd: 'memberLoad.qyEnd',
    position: 'memberLoad.position',
    px: 'memberLoad.px',
    py: 'memberLoad.py',
    moment: 'memberLoad.moment',
  },
};

/**
 * La columna `case` de la tabla de cargas escribe en las dos familias. Se
 * resuelve contra la fila concreta, porque `nodalLoad.caseId` y
 * `memberLoad.caseId` son campos distintos aunque signifiquen lo mismo.
 */
export const datasheetRowField = (
  entity: DatasheetEntity,
  columnId: string,
  rowKind: 'node' | 'member' | 'nodalLoad' | 'memberLoad',
): DatasheetFieldId | undefined => {
  const field = COLUMN_FIELDS[entity][columnId];
  if (!field) return undefined;
  if (entity !== 'loads') return field;
  if (columnId === 'case') return rowKind === 'nodalLoad' ? 'nodalLoad.caseId' : 'memberLoad.caseId';
  // Un campo de otra familia no se traduce: la celda está vacía y cerrada.
  return field.startsWith(rowKind) ? field : undefined;
};

export const datasheetColumnField = (
  entity: DatasheetEntity,
  columnId: string,
): DatasheetFieldId | undefined => COLUMN_FIELDS[entity][columnId];

export const datasheetFieldIneligibility = (
  id: DatasheetFieldId,
  target: DatasheetEditTarget,
): BulkIncompatibilityReason | undefined => {
  if (id === 'node.x' || id === 'node.y') return undefined;
  const descriptor = descriptorById.get(id);
  if (!descriptor) return undefined;
  // Cada descriptor sólo sabe juzgar a su propia familia; cruzar familias sería
  // pasarle una entidad que su `ineligible` no está escrito para leer.
  if (descriptor.entity !== target.kind) return 'load-family';
  switch (target.kind) {
    case 'node': return descriptor.entity === 'node' ? descriptor.ineligible?.(target.node) : undefined;
    case 'member': return descriptor.entity === 'member' ? descriptor.ineligible?.(target.member) : undefined;
    case 'nodalLoad': return descriptor.entity === 'nodalLoad' ? descriptor.ineligible?.(target.load) : undefined;
    case 'memberLoad': return descriptor.entity === 'memberLoad' ? descriptor.ineligible?.(target.load) : undefined;
  }
};
```

Nota para el implementador: `descriptor.ineligible` está tipado por familia, así que el `switch` con el `descriptor.entity ===` redundante es lo que permite a TypeScript estrechar sin `as`. No lo sustituyas por una llamada única.

- [ ] **Step 4: Ejecutar y ver que pasa**

```bash
npx vitest run src/features/datasheet/datasheetEditModel.test.ts --maxWorkers=1
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/datasheet/datasheetEditModel.ts src/features/datasheet/datasheetEditModel.test.ts
git commit -m "feat: map datasheet columns to editable model fields"
```

---

### Task 4: Borrador, interpretación y validación

**Files:**
- Create: `src/features/datasheet/datasheetEditDraft.ts`
- Test: `src/features/datasheet/datasheetEditDraft.test.ts`

**Interfaces:**
- Consumes: `datasheetField`, `datasheetFieldIneligibility`, `DatasheetFieldId`, `DatasheetEditTarget` (tarea 3); `projectTopologyTolerance` de `../../data/modelOperations`; `fromDisplay` de `../../engine/units`; `parseInspectorNumber` de `../inspector/numericFormatting`
- Produces:
  - `EMPTY_DATASHEET_DRAFT`, `draftKey`, `stageDatasheetEdit`, `unstageDatasheetEdit`, `datasheetDraftCount`
  - `interpretDatasheetEdits(project, draft, units): DatasheetEditPlan`
  - `DatasheetEditPlan { changes; errors; coincidentNodeIds; applicable }`
  - `DatasheetPlannedChange { rowId; targetKind; fieldId; before; after }`
  - `DatasheetEditError { rowId; fieldId; code; raw }`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/features/datasheet/datasheetEditDraft.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDatasheetProject } from './datasheetFixtures';
import {
  EMPTY_DATASHEET_DRAFT,
  interpretDatasheetEdits,
  stageDatasheetEdit,
} from './datasheetEditDraft';

const project = createDatasheetProject();
const stage = (...entries: readonly (readonly [string, string, string])[]) =>
  entries.reduce(
    (draft, [rowId, fieldId, raw]) => stageDatasheetEdit(draft, rowId, fieldId as never, raw),
    EMPTY_DATASHEET_DRAFT,
  );

describe('interpretación del borrador', () => {
  it('convierte del sistema mostrado a unidades base', () => {
    // 1 ft = 0.3048 m: si el plan guardase 12 el nudo se iría a doce metros.
    const plan = interpretDatasheetEdits(project, stage(['N2', 'node.x', '12']), 'kip-ft');
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0].after).toBeCloseTo(12 * 0.3048, 10);
    expect(plan.applicable).toBe(true);
  });

  it('no convierte lo adimensional', () => {
    const plan = interpretDatasheetEdits(project, stage(['ML1', 'memberLoad.end', '0.5']), 'kip-ft');
    expect(plan.changes[0].after).toBe(0.5);
  });

  it('descarta el cambio que devuelve el valor original', () => {
    const plan = interpretDatasheetEdits(project, stage(['N2', 'node.x', '0']), 'kN-m');
    expect(plan.changes).toEqual([]);
    expect(plan.applicable).toBe(false);
  });

  it('lleva el valor anterior para que la revisión no compare formularios', () => {
    const plan = interpretDatasheetEdits(project, stage(['N2', 'node.y', '5']), 'kN-m');
    expect(plan.changes[0]).toMatchObject({ rowId: 'N2', before: 4, after: 5 });
  });

  it('rechaza lo que no es número', () => {
    const plan = interpretDatasheetEdits(project, stage(['N2', 'node.x', 'dos']), 'kN-m');
    expect(plan.errors).toEqual([{ rowId: 'N2', fieldId: 'node.x', code: 'not-a-number', raw: 'dos' }]);
    expect(plan.applicable).toBe(false);
  });

  it('rechaza rigidez no positiva', () => {
    const plan = interpretDatasheetEdits(project, stage(['M2', 'member.A', '0']), 'kN-m');
    expect(plan.errors[0].code).toBe('not-positive');
  });

  it('rechaza una posición fuera de la barra', () => {
    const plan = interpretDatasheetEdits(project, stage(['ML1', 'memberLoad.end', '1.4']), 'kN-m');
    expect(plan.errors[0].code).toBe('out-of-range');
  });

  it('rechaza una opción que no está en la unión del dominio', () => {
    const plan = interpretDatasheetEdits(project, stage(['N1', 'node.support.type', 'flotante']), 'kN-m');
    expect(plan.errors[0].code).toBe('unknown-option');
  });

  it('rechaza un caso de carga que el proyecto no declara', () => {
    const plan = interpretDatasheetEdits(project, stage(['NL1', 'nodalLoad.caseId', 'LC9']), 'kN-m');
    expect(plan.errors[0].code).toBe('unknown-option');
  });

  it('rechaza un campo fuera de la familia de su carga', () => {
    const plan = interpretDatasheetEdits(project, stage(['ML1', 'memberLoad.px', '3']), 'kN-m');
    expect(plan.errors[0].code).toBe('ineligible');
  });

  it('rechaza una fila que ya no existe', () => {
    const plan = interpretDatasheetEdits(project, stage(['N9', 'node.x', '1']), 'kN-m');
    expect(plan.errors[0].code).toBe('unknown-row');
  });

  it('un solo error deja el plan entero sin aplicar', () => {
    const plan = interpretDatasheetEdits(
      project,
      stage(['N2', 'node.x', '1'], ['N3', 'node.x', 'dos']),
      'kN-m',
    );
    expect(plan.changes).toHaveLength(1);
    expect(plan.applicable).toBe(false);
  });

  it('avisa de los nudos que quedarían coincidentes sin fusionarlos', () => {
    // N2 está en (0, 4) y N3 en (6, 4): llevar N3 a x = 0 los superpone.
    const plan = interpretDatasheetEdits(project, stage(['N3', 'node.x', '0']), 'kN-m');
    expect(plan.coincidentNodeIds).toEqual(['N2', 'N3']);
    // Avisar no es bloquear: el modelo queda como se tecleó.
    expect(plan.applicable).toBe(true);
  });

  it('no avisa cuando nada se superpone', () => {
    const plan = interpretDatasheetEdits(project, stage(['N3', 'node.x', '7']), 'kN-m');
    expect(plan.coincidentNodeIds).toEqual([]);
  });

  it('un booleano acepta las dos formas que teclea el usuario', () => {
    const yes = interpretDatasheetEdits(project, stage(['N1', 'node.internalHinge', 'true']), 'kN-m');
    expect(yes.changes[0].after).toBe(true);
    const no = interpretDatasheetEdits(project, stage(['N2', 'node.internalHinge', 'false']), 'kN-m');
    expect(no.changes[0].after).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

```bash
npx vitest run src/features/datasheet/datasheetEditDraft.test.ts --maxWorkers=1
```

Esperado: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar el borrador y la interpretación**

Crear `src/features/datasheet/datasheetEditDraft.ts`:

```ts
import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection } from '../../data/standardSections';
import { projectTopologyTolerance } from '../../data/modelOperations';
import { fromDisplay } from '../../engine/units';
import type { MemberLoad, MemberModel, NodalLoad, NodeModel, ProjectModel, UnitSystemId } from '../../types';
import { parseInspectorNumber } from '../inspector/numericFormatting';
import {
  datasheetField,
  datasheetFieldIneligibility,
  type DatasheetEditTarget,
  type DatasheetFieldId,
} from './datasheetEditModel';

/**
 * Borrador de edición del datasheet: interpretar → convertir → validar.
 *
 * El borrador guarda **la cadena tal como se teclea**, sin interpretar.
 * Interpretar en cada pulsación convertiría `1.` o `-` en `NaN` mientras el
 * usuario todavía está escribiendo el número.
 *
 * El plan que sale de aquí está en **unidades base** y es todo o nada: un solo
 * error deja `applicable` en `false` y nadie escribe una parte.
 */

export type DatasheetDraftValue = string;
/** Clave `rowId|fieldId`. El separador no aparece en ningún id del modelo. */
export type DatasheetEditDraft = Readonly<Record<string, DatasheetDraftValue>>;

export const EMPTY_DATASHEET_DRAFT: DatasheetEditDraft = Object.freeze({});

export const draftKey = (rowId: string, fieldId: DatasheetFieldId): string => `${rowId}|${fieldId}`;

export const stageDatasheetEdit = (
  draft: DatasheetEditDraft,
  rowId: string,
  fieldId: DatasheetFieldId,
  raw: string,
): DatasheetEditDraft => ({ ...draft, [draftKey(rowId, fieldId)]: raw });

export const unstageDatasheetEdit = (
  draft: DatasheetEditDraft,
  rowId: string,
  fieldId: DatasheetFieldId,
): DatasheetEditDraft => {
  const key = draftKey(rowId, fieldId);
  if (!(key in draft)) return draft;
  const next = { ...draft };
  delete next[key];
  return next;
};

export const datasheetDraftCount = (draft: DatasheetEditDraft): number => Object.keys(draft).length;

export type DatasheetEditErrorCode =
  | 'not-a-number'
  | 'not-positive'
  | 'out-of-range'
  | 'unknown-option'
  | 'ineligible'
  | 'unknown-row';

export type DatasheetEditValue = string | number | boolean | undefined;

export interface DatasheetPlannedChange {
  rowId: string;
  targetKind: DatasheetEditTarget['kind'];
  fieldId: DatasheetFieldId;
  /** Unidades base. */
  before: DatasheetEditValue;
  after: DatasheetEditValue;
}

export interface DatasheetEditError {
  rowId: string;
  fieldId: DatasheetFieldId;
  code: DatasheetEditErrorCode;
  raw: string;
}

export interface DatasheetEditPlan {
  changes: readonly DatasheetPlannedChange[];
  errors: readonly DatasheetEditError[];
  /** Nudos que compartirían punto tras aplicar. Avisa; no fusiona ni bloquea. */
  coincidentNodeIds: readonly string[];
  applicable: boolean;
}

export const EMPTY_DATASHEET_PLAN: DatasheetEditPlan = Object.freeze({
  changes: [], errors: [], coincidentNodeIds: [], applicable: false,
});

/** Índice de una sola pasada: buscar cada fila recorriendo el modelo sería cuadrático. */
interface ProjectIndex {
  nodes: ReadonlyMap<string, NodeModel>;
  members: ReadonlyMap<string, MemberModel>;
  nodalLoads: ReadonlyMap<string, NodalLoad>;
  memberLoads: ReadonlyMap<string, MemberLoad>;
  loadCaseIds: ReadonlySet<string>;
}

const indexProject = (project: ProjectModel): ProjectIndex => ({
  nodes: new Map(project.nodes.map((node) => [node.id, node])),
  members: new Map(project.members.map((member) => [member.id, member])),
  nodalLoads: new Map(project.nodalLoads.map((load) => [load.id, load])),
  memberLoads: new Map(project.memberLoads.map((load) => [load.id, load])),
  loadCaseIds: new Set(project.loadCases.map((item) => item.id)),
});

const targetFor = (index: ProjectIndex, fieldId: DatasheetFieldId, rowId: string): DatasheetEditTarget | undefined => {
  if (fieldId.startsWith('node.')) {
    const node = index.nodes.get(rowId);
    return node ? { kind: 'node', node } : undefined;
  }
  if (fieldId.startsWith('member.')) {
    const member = index.members.get(rowId);
    return member ? { kind: 'member', member } : undefined;
  }
  if (fieldId.startsWith('nodalLoad.')) {
    const load = index.nodalLoads.get(rowId);
    return load ? { kind: 'nodalLoad', load } : undefined;
  }
  const load = index.memberLoads.get(rowId);
  return load ? { kind: 'memberLoad', load } : undefined;
};

/** Valor actual del campo, en unidades base. Es lo que la revisión enseña como «antes». */
const readField = (target: DatasheetEditTarget, fieldId: DatasheetFieldId): DatasheetEditValue => {
  switch (fieldId) {
    case 'node.x': return target.kind === 'node' ? target.node.x : undefined;
    case 'node.y': return target.kind === 'node' ? target.node.y : undefined;
    case 'node.support.type': return target.kind === 'node' ? target.node.support.type : undefined;
    case 'node.support.angleDeg': return target.kind === 'node' ? target.node.support.angleDeg : undefined;
    case 'node.support.restrainX': return target.kind === 'node' ? target.node.support.restrainX : undefined;
    case 'node.support.restrainY': return target.kind === 'node' ? target.node.support.restrainY : undefined;
    case 'node.support.restrainR': return target.kind === 'node' ? target.node.support.restrainR : undefined;
    case 'node.internalHinge': return target.kind === 'node' ? target.node.internalHinge : undefined;
    case 'member.type': return target.kind === 'member' ? target.member.type : undefined;
    case 'member.materialId': return target.kind === 'member' ? target.member.materialId : undefined;
    case 'member.sectionId': return target.kind === 'member' ? target.member.sectionId : undefined;
    case 'member.E': return target.kind === 'member' ? target.member.E : undefined;
    case 'member.A': return target.kind === 'member' ? target.member.A : undefined;
    case 'member.I': return target.kind === 'member' ? target.member.I : undefined;
    case 'member.G': return target.kind === 'member' ? target.member.G : undefined;
    case 'member.density': return target.kind === 'member' ? target.member.density : undefined;
    case 'member.releases.iMoment': return target.kind === 'member' ? target.member.releases?.iMoment : undefined;
    case 'member.releases.jMoment': return target.kind === 'member' ? target.member.releases?.jMoment : undefined;
    case 'nodalLoad.caseId': return target.kind === 'nodalLoad' ? target.load.caseId : undefined;
    case 'nodalLoad.fx': return target.kind === 'nodalLoad' ? target.load.fx : undefined;
    case 'nodalLoad.fy': return target.kind === 'nodalLoad' ? target.load.fy : undefined;
    case 'nodalLoad.mz': return target.kind === 'nodalLoad' ? target.load.mz : undefined;
    default:
      return target.kind === 'memberLoad'
        ? (target.load as unknown as Record<string, DatasheetEditValue>)[fieldId.slice('memberLoad.'.length)]
        : undefined;
  }
};

/** Comprueba la opción contra su dominio: unión fija, catálogo o casos del proyecto. */
const optionError = (
  fieldId: DatasheetFieldId,
  raw: string,
  index: ProjectIndex,
): DatasheetEditErrorCode | undefined => {
  const field = datasheetField(fieldId);
  if (field.kind === 'material') return findStandardMaterial(raw) ? undefined : 'unknown-option';
  if (field.kind === 'section') return findStandardSection(raw) ? undefined : 'unknown-option';
  if (field.optionsFrom === 'loadCases') return index.loadCaseIds.has(raw) ? undefined : 'unknown-option';
  return field.options?.includes(raw) ? undefined : 'unknown-option';
};

/**
 * Un booleano llega como texto porque el borrador es homogéneo: la celda, el
 * panel y el pegado escriben todos una cadena, y sólo aquí se decide qué es.
 */
const parseBoolean = (raw: string): boolean | undefined => {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
};

interface Interpreted {
  change?: DatasheetPlannedChange;
  error?: DatasheetEditError;
}

const interpretEntry = (
  index: ProjectIndex,
  rowId: string,
  fieldId: DatasheetFieldId,
  raw: string,
  units: UnitSystemId,
): Interpreted => {
  const fail = (code: DatasheetEditErrorCode): Interpreted => ({ error: { rowId, fieldId, code, raw } });
  const target = targetFor(index, fieldId, rowId);
  if (!target) return fail('unknown-row');
  if (datasheetFieldIneligibility(fieldId, target)) return fail('ineligible');

  const field = datasheetField(fieldId);
  const before = readField(target, fieldId);
  let after: DatasheetEditValue;

  if (field.kind === 'number') {
    const parsed = parseInspectorNumber(raw);
    if (!parsed.ok) return fail('not-a-number');
    // El usuario teclea en las unidades que la tabla le muestra.
    after = field.quantity ? fromDisplay(parsed.value, units, field.quantity) : parsed.value;
    if (field.positive && after <= 0) return fail('not-positive');
    if (field.min !== undefined && after < field.min) return fail('out-of-range');
    if (field.max !== undefined && after > field.max) return fail('out-of-range');
  } else if (field.kind === 'boolean') {
    const parsed = parseBoolean(raw);
    if (parsed === undefined) return fail('unknown-option');
    after = parsed;
  } else {
    const error = optionError(fieldId, raw.trim(), index);
    if (error) return fail(error);
    after = raw.trim();
  }

  // Volver a teclear el valor que ya estaba no es un cambio: dejarlo en el plan
  // haría que «Aplicar» registrase una entrada de historial que no cambia nada.
  if (before === after) return {};
  return { change: { rowId, targetKind: target.kind, fieldId, before, after } };
};

/**
 * Nudos que compartirían punto tras el plan.
 *
 * El datasheet **no** repara la topología, a diferencia del Inspector: un pegado
 * de coordenadas no debe borrar filas en silencio. Se avisa y se remite al Model
 * Doctor, que es la ruta explícita y reversible para fusionarlos.
 */
const coincidentNodes = (
  project: ProjectModel,
  changes: readonly DatasheetPlannedChange[],
): readonly string[] => {
  const moved = changes.filter((change) => change.fieldId === 'node.x' || change.fieldId === 'node.y');
  if (moved.length === 0) return [];
  const points = new Map(project.nodes.map((node) => [node.id, { x: node.x, y: node.y }]));
  for (const change of moved) {
    const point = points.get(change.rowId);
    if (point && typeof change.after === 'number') {
      if (change.fieldId === 'node.x') point.x = change.after;
      else point.y = change.after;
    }
  }
  const tolerance = projectTopologyTolerance(project);
  const coincident = new Set<string>();
  const entries = [...points.entries()];
  for (let first = 0; first < entries.length; first += 1) {
    for (let second = first + 1; second < entries.length; second += 1) {
      const [firstId, firstPoint] = entries[first];
      const [secondId, secondPoint] = entries[second];
      if (Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y) > tolerance) continue;
      coincident.add(firstId);
      coincident.add(secondId);
    }
  }
  return [...coincident];
};

export const interpretDatasheetEdits = (
  project: ProjectModel,
  draft: DatasheetEditDraft,
  units: UnitSystemId,
): DatasheetEditPlan => {
  const index = indexProject(project);
  const changes: DatasheetPlannedChange[] = [];
  const errors: DatasheetEditError[] = [];

  for (const [key, raw] of Object.entries(draft)) {
    const separator = key.indexOf('|');
    const rowId = key.slice(0, separator);
    const fieldId = key.slice(separator + 1) as DatasheetFieldId;
    const { change, error } = interpretEntry(index, rowId, fieldId, raw, units);
    if (change) changes.push(change);
    if (error) errors.push(error);
  }

  return {
    changes,
    errors,
    coincidentNodeIds: coincidentNodes(project, changes),
    applicable: errors.length === 0 && changes.length > 0,
  };
};
```

- [ ] **Step 4: Ejecutar y ver que pasa**

```bash
npx vitest run src/features/datasheet/datasheetEditDraft.test.ts --maxWorkers=1
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/datasheet/datasheetEditDraft.ts src/features/datasheet/datasheetEditDraft.test.ts
git commit -m "feat: interpret, convert and validate datasheet edits into a plan"
```

---

### Task 5: Aplicación del plan

**Files:**
- Create: `src/features/datasheet/datasheetEditApply.ts`
- Test: `src/features/datasheet/datasheetEditApply.test.ts`

**Interfaces:**
- Consumes: `DatasheetEditPlan`, `DatasheetPlannedChange` (tarea 4)
- Produces: `applyDatasheetPlan(project: ProjectModel, plan: DatasheetEditPlan): ProjectModel`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/features/datasheet/datasheetEditApply.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDatasheetProject } from './datasheetFixtures';
import { EMPTY_DATASHEET_DRAFT, interpretDatasheetEdits, stageDatasheetEdit } from './datasheetEditDraft';
import { applyDatasheetPlan } from './datasheetEditApply';

const project = createDatasheetProject();
const planOf = (...entries: readonly (readonly [string, string, string])[]) =>
  interpretDatasheetEdits(
    project,
    entries.reduce((draft, [rowId, fieldId, raw]) => stageDatasheetEdit(draft, rowId, fieldId as never, raw), EMPTY_DATASHEET_DRAFT),
    'kN-m',
  );

describe('aplicación del plan', () => {
  it('escribe exactamente lo declarado y nada más', () => {
    const next = applyDatasheetPlan(project, planOf(['N2', 'node.x', '2']));
    expect(next.nodes[1].x).toBe(2);
    expect(next.nodes[1].y).toBe(4);
    expect(next.members).toEqual(project.members);
  });

  it('no muta el proyecto de entrada', () => {
    applyDatasheetPlan(project, planOf(['N2', 'node.x', '2']));
    expect(project.nodes[1].x).toBe(0);
  });

  it('un plan con error no escribe nada', () => {
    const next = applyDatasheetPlan(project, planOf(['N2', 'node.x', '2'], ['N3', 'node.y', 'ocho']));
    expect(next).toBe(project);
  });

  it('cambia el apoyo conservando lo que el tipo nuevo sostiene', () => {
    const next = applyDatasheetPlan(project, planOf(['N1', 'node.support.type', 'roller']));
    // Un rodillo nace con su normal declarada, no con un ángulo indefinido.
    expect(next.nodes[0].support).toMatchObject({ type: 'roller', angleDeg: 90 });
  });

  it('un apoyo personalizado nace con sus tres restricciones declaradas', () => {
    const next = applyDatasheetPlan(project, planOf(['N1', 'node.support.type', 'custom']));
    expect(next.nodes[0].support).toMatchObject({
      type: 'custom', restrainX: false, restrainY: false, restrainR: false,
    });
  });

  it('una identidad de catálogo viaja con sus números', () => {
    const next = applyDatasheetPlan(project, planOf(['M2', 'member.materialId', 'steel-a992']));
    const member = next.members[1];
    expect(member.materialId).toBe('steel-a992');
    expect(member.materialOrigin).toBe('catalog');
    expect(member.E).toBe(200000000);
  });

  it('escribir E a mano degrada el origen a personalizado', () => {
    const next = applyDatasheetPlan(project, planOf(['M1', 'member.E', '150000000']));
    expect(next.members[0].E).toBe(150000000);
    expect(next.members[0].materialOrigin).toBe('custom');
    expect(next.members[0].materialId).toBeUndefined();
    // La sección no se toca: degradar el material no degrada el perfil.
    expect(next.members[0].sectionOrigin).toBe('catalog');
  });

  it('escribir A o I a mano degrada la sección y deja el material intacto', () => {
    const next = applyDatasheetPlan(project, planOf(['M1', 'member.A', '0.01']));
    expect(next.members[0].sectionOrigin).toBe('custom');
    expect(next.members[0].sectionId).toBeUndefined();
    expect(next.members[0].materialOrigin).toBe('catalog');
  });

  it('escribe una liberación sin borrar la contraria', () => {
    const next = applyDatasheetPlan(project, planOf(['M2', 'member.releases.jMoment', 'true']));
    expect(next.members[1].releases).toEqual({ iMoment: true, jMoment: true });
  });

  it('escribe en la carga nodal por su id y no por su posición', () => {
    const next = applyDatasheetPlan(project, planOf(['NL1', 'nodalLoad.fy', '-9']));
    expect(next.nodalLoads[0].fy).toBe(-9);
  });

  it('escribe en la carga de barra', () => {
    const next = applyDatasheetPlan(project, planOf(['ML1', 'memberLoad.qyEnd', '-4']));
    expect(next.memberLoads[0].qyEnd).toBe(-4);
  });

  it('aplica todo el plan en una sola pasada', () => {
    const next = applyDatasheetPlan(project, planOf(
      ['N2', 'node.x', '1'],
      ['N3', 'node.y', '5'],
      ['M2', 'member.I', '0.0004'],
      ['NL1', 'nodalLoad.caseId', 'LC2'],
    ));
    expect(next.nodes[1].x).toBe(1);
    expect(next.nodes[2].y).toBe(5);
    expect(next.members[1].I).toBe(0.0004);
    expect(next.nodalLoads[0].caseId).toBe('LC2');
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

```bash
npx vitest run src/features/datasheet/datasheetEditApply.test.ts --maxWorkers=1
```

Esperado: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar la aplicación**

Crear `src/features/datasheet/datasheetEditApply.ts`:

```ts
import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection } from '../../data/standardSections';
import type { MemberLoad, MemberModel, NodeModel, ProjectModel, SupportType } from '../../types';
import type { DatasheetEditPlan, DatasheetPlannedChange } from './datasheetEditDraft';

/**
 * La única escritura del datasheet.
 *
 * Es pura: recibe un proyecto y devuelve otro. La misma función alimenta el
 * proyecto de preview y el `updateProject` real, que es lo que garantiza que lo
 * que el usuario ve antes de aplicar es exactamente lo que se escribe. Dos
 * caminos distintos podrían divergir; uno solo, no.
 *
 * Un plan no aplicable devuelve el proyecto **por identidad**: así el llamador
 * puede comparar por referencia y no hay forma de escribir la mitad de un plan.
 */

/**
 * Un tipo de apoyo nace con los campos que ese tipo sostiene y sin los del
 * anterior. Conservar el ángulo de un rodillo en un empotramiento dejaría un
 * dato que nadie lee y que reaparecería al volver a rodillo.
 */
const rebuildSupport = (node: NodeModel, type: SupportType): NodeModel['support'] => {
  const spring = node.support.spring;
  const prescribed = node.support.prescribed;
  if (type === 'roller') return { type, angleDeg: node.support.angleDeg ?? 90, spring, prescribed };
  if (type === 'custom') return { type, restrainX: false, restrainY: false, restrainR: false, spring, prescribed };
  return { type, spring, prescribed };
};

/**
 * Escribir un número de material a mano degrada el origen a `custom` y suelta la
 * identidad: es la regla que `member.update` ya aplica, y dejar el id apuntando
 * a un perfil cuyos números ya no coinciden sería una identidad falsa. El
 * material y la sección se degradan por separado.
 */
const degradeMaterial = (member: MemberModel): void => {
  if (member.materialOrigin !== 'catalog') return;
  member.materialOrigin = 'custom';
  delete member.materialId;
};

const degradeSection = (member: MemberModel): void => {
  if (member.sectionOrigin !== 'catalog') return;
  member.sectionOrigin = 'custom';
  delete member.sectionId;
};

const writeNode = (node: NodeModel, change: DatasheetPlannedChange): void => {
  switch (change.fieldId) {
    case 'node.x': node.x = change.after as number; break;
    case 'node.y': node.y = change.after as number; break;
    case 'node.support.type': node.support = rebuildSupport(node, change.after as SupportType); break;
    case 'node.support.angleDeg': node.support.angleDeg = change.after as number; break;
    case 'node.support.restrainX': node.support.restrainX = change.after as boolean; break;
    case 'node.support.restrainY': node.support.restrainY = change.after as boolean; break;
    case 'node.support.restrainR': node.support.restrainR = change.after as boolean; break;
    case 'node.internalHinge': node.internalHinge = change.after as boolean; break;
    default: break;
  }
};

const writeMember = (member: MemberModel, change: DatasheetPlannedChange): void => {
  switch (change.fieldId) {
    case 'member.type': member.type = change.after as MemberModel['type']; break;
    case 'member.materialId': {
      const material = findStandardMaterial(String(change.after));
      if (!material) break;
      member.materialId = material.id;
      member.materialOrigin = 'catalog';
      member.E = material.elasticModulus;
      if (material.shearModulus !== undefined) member.G = material.shearModulus;
      if (material.density !== undefined) member.density = material.density;
      break;
    }
    case 'member.sectionId': {
      const section = findStandardSection(String(change.after));
      if (!section) break;
      member.sectionId = section.id;
      member.sectionOrigin = 'catalog';
      member.A = section.area;
      member.I = section.inertiaX;
      break;
    }
    case 'member.E': member.E = change.after as number; degradeMaterial(member); break;
    case 'member.G': member.G = change.after as number; degradeMaterial(member); break;
    case 'member.density': member.density = change.after as number; degradeMaterial(member); break;
    case 'member.A': member.A = change.after as number; degradeSection(member); break;
    case 'member.I': member.I = change.after as number; degradeSection(member); break;
    case 'member.releases.iMoment':
      member.releases = { ...member.releases, iMoment: change.after as boolean };
      break;
    case 'member.releases.jMoment':
      member.releases = { ...member.releases, jMoment: change.after as boolean };
      break;
    default: break;
  }
};

export const applyDatasheetPlan = (project: ProjectModel, plan: DatasheetEditPlan): ProjectModel => {
  if (!plan.applicable) return project;
  const next = structuredClone(project);
  const nodes = new Map(next.nodes.map((node) => [node.id, node]));
  const members = new Map(next.members.map((member) => [member.id, member]));
  const nodalLoads = new Map(next.nodalLoads.map((load) => [load.id, load]));
  const memberLoads = new Map(next.memberLoads.map((load) => [load.id, load]));

  for (const change of plan.changes) {
    switch (change.targetKind) {
      case 'node': {
        const node = nodes.get(change.rowId);
        if (node) writeNode(node, change);
        break;
      }
      case 'member': {
        const member = members.get(change.rowId);
        if (member) writeMember(member, change);
        break;
      }
      case 'nodalLoad': {
        const load = nodalLoads.get(change.rowId);
        if (!load) break;
        // Los cuatro campos nodales son homogéneos: el id ya está validado
        // contra el registro, así que el sufijo basta y evita cuatro ramas.
        (load as unknown as Record<string, unknown>)[change.fieldId.slice('nodalLoad.'.length)] = change.after;
        break;
      }
      case 'memberLoad': {
        const load = memberLoads.get(change.rowId);
        if (!load) break;
        (load as unknown as Record<string, unknown>)[change.fieldId.slice('memberLoad.'.length)] =
          change.after as MemberLoad[keyof MemberLoad];
        break;
      }
    }
  }

  return next;
};
```

- [ ] **Step 4: Ejecutar y ver que pasa**

```bash
npx vitest run src/features/datasheet/datasheetEditApply.test.ts --maxWorkers=1
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/datasheet/datasheetEditApply.ts src/features/datasheet/datasheetEditApply.test.ts
git commit -m "feat: apply a datasheet edit plan as one pure project transform"
```

---

### Task 6: Pegado

**Files:**
- Create: `src/features/datasheet/datasheetPaste.ts`
- Test: `src/features/datasheet/datasheetPaste.test.ts`

**Interfaces:**
- Consumes: `DatasheetRow`, `DatasheetColumn`, `DatasheetEntity` (tareas 1–2); `datasheetRowField` (tarea 3); `GridPosition` de `./datasheetGridNavigation`
- Produces:
  - `parseClipboardGrid(text: string): string[][]`
  - `mapPasteToEdits(input): DatasheetPasteResult`
  - `DatasheetPasteResult { edits; droppedOutside; droppedReadOnly }`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/features/datasheet/datasheetPaste.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDatasheetProject } from './datasheetFixtures';
import { datasheetColumns, projectDatasheetRows } from './datasheetModel';
import { mapPasteToEdits, parseClipboardGrid } from './datasheetPaste';

const project = createDatasheetProject();
const rows = projectDatasheetRows(project, 'nodes');
const columns = datasheetColumns('nodes');

describe('lectura del portapapeles', () => {
  it('parte por tabulador y por salto de línea', () => {
    expect(parseClipboardGrid('1\t2\n3\t4')).toEqual([['1', '2'], ['3', '4']]);
  });

  it('acepta el salto de línea de Windows', () => {
    expect(parseClipboardGrid('1\t2\r\n3\t4')).toEqual([['1', '2'], ['3', '4']]);
  });

  it('descarta la línea final vacía que añade toda hoja de cálculo', () => {
    expect(parseClipboardGrid('1\t2\n')).toEqual([['1', '2']]);
  });

  it('trata una celda sola como un bloque de uno', () => {
    expect(parseClipboardGrid('7')).toEqual([['7']]);
  });
});

describe('anclaje del bloque', () => {
  // Columnas de nudos: 0 id · 1 x · 2 y · 3 apoyo · 4 restricciones · 5 rótula · 6 cargas
  it('ancla en la celda enfocada y se extiende abajo y a la derecha', () => {
    const result = mapPasteToEdits({
      block: [['1', '2'], ['3', '4']],
      rows, columns, entity: 'nodes',
      anchor: { row: 0, column: 1 },
    });
    expect(result.edits).toEqual([
      { rowId: 'N1', fieldId: 'node.x', raw: '1' },
      { rowId: 'N1', fieldId: 'node.y', raw: '2' },
      { rowId: 'N2', fieldId: 'node.x', raw: '3' },
      { rowId: 'N2', fieldId: 'node.y', raw: '4' },
    ]);
    expect(result.droppedOutside).toBe(0);
    expect(result.droppedReadOnly).toBe(0);
  });

  it('cuenta lo que cae fuera de la tabla en vez de recortarlo en silencio', () => {
    const result = mapPasteToEdits({
      block: [['1'], ['2'], ['3'], ['4']],
      rows, columns, entity: 'nodes',
      anchor: { row: 2, column: 1 },
    });
    expect(result.edits).toEqual([{ rowId: 'N3', fieldId: 'node.x', raw: '1' }]);
    expect(result.droppedOutside).toBe(3);
  });

  it('cuenta lo que cae sobre una columna que no se edita', () => {
    // Columna 0 es el id, que es identidad y nunca se escribe.
    const result = mapPasteToEdits({
      block: [['X1', '9']],
      rows, columns, entity: 'nodes',
      anchor: { row: 0, column: 0 },
    });
    expect(result.edits).toEqual([{ rowId: 'N1', fieldId: 'node.x', raw: '9' }]);
    expect(result.droppedReadOnly).toBe(1);
  });

  it('salta las celdas de otra familia en la tabla de cargas', () => {
    const loadRows = projectDatasheetRows(project, 'loads');
    const loadColumns = datasheetColumns('loads');
    const fxIndex = loadColumns.findIndex((column) => column.id === 'fx');
    const result = mapPasteToEdits({
      block: [['5'], ['6']],
      rows: loadRows, columns: loadColumns, entity: 'loads',
      anchor: { row: 0, column: fxIndex },
    });
    // NL1 es nodal y acepta Fx; ML1 es repartida y no tiene dónde escribirlo.
    expect(result.edits).toEqual([{ rowId: 'NL1', fieldId: 'nodalLoad.fx', raw: '5' }]);
    expect(result.droppedReadOnly).toBe(1);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

```bash
npx vitest run src/features/datasheet/datasheetPaste.test.ts --maxWorkers=1
```

Esperado: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar el pegado**

Crear `src/features/datasheet/datasheetPaste.ts`:

```ts
import { datasheetRowField, type DatasheetFieldId } from './datasheetEditModel';
import type { GridPosition } from './datasheetGridNavigation';
import type { DatasheetColumn, DatasheetEntity, DatasheetRow } from './datasheetModel';

/**
 * Pegado sobre la rejilla: interpretar y **contar lo que se descarta**.
 *
 * Un recorte silencioso es el peor fallo posible aquí: el usuario pega cien
 * celdas, se escriben sesenta y cree que se escribieron cien. Por eso el
 * resultado lleva cuántas quedaron fuera y por qué, y la revisión lo enseña
 * antes de que nadie pulse Aplicar.
 */

export interface DatasheetPasteEdit {
  rowId: string;
  fieldId: DatasheetFieldId;
  raw: string;
}

export interface DatasheetPasteResult {
  edits: readonly DatasheetPasteEdit[];
  /** Celdas del bloque que caen más allá del final de la tabla. */
  droppedOutside: number;
  /** Celdas que caen sobre una columna o una fila que no admite ese campo. */
  droppedReadOnly: number;
}

/**
 * Texto tabular a matriz. El tabulador y el salto de línea son el formato que
 * toda hoja de cálculo pone en el portapapeles; no se intenta adivinar CSV con
 * comillas, que es un formato distinto y ambiguo.
 */
export const parseClipboardGrid = (text: string): string[][] => {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  if (normalized === '') return [];
  return normalized.split('\n').map((line) => line.split('\t'));
};

export interface DatasheetPasteInput {
  block: readonly (readonly string[])[];
  rows: readonly DatasheetRow[];
  columns: readonly DatasheetColumn[];
  entity: DatasheetEntity;
  anchor: GridPosition;
}

export const mapPasteToEdits = ({
  block, rows, columns, entity, anchor,
}: DatasheetPasteInput): DatasheetPasteResult => {
  const edits: DatasheetPasteEdit[] = [];
  let droppedOutside = 0;
  let droppedReadOnly = 0;

  block.forEach((line, lineIndex) => {
    const row = rows[anchor.row + lineIndex];
    line.forEach((raw, cellIndex) => {
      const column = columns[anchor.column + cellIndex];
      if (!row || !column) {
        droppedOutside += 1;
        return;
      }
      const fieldId = column.editability === 'inline'
        ? datasheetRowField(entity, column.id, row.kind)
        : undefined;
      if (!fieldId) {
        droppedReadOnly += 1;
        return;
      }
      edits.push({ rowId: row.id, fieldId, raw });
    });
  });

  return { edits, droppedOutside, droppedReadOnly };
};
```

- [ ] **Step 4: Ejecutar y ver que pasa**

```bash
npx vitest run src/features/datasheet/datasheetPaste.test.ts --maxWorkers=1
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/datasheet/datasheetPaste.ts src/features/datasheet/datasheetPaste.test.ts
git commit -m "feat: map a pasted block onto datasheet cells and count what is dropped"
```

---

### Task 7: Edición en la celda

**Files:**
- Create: `src/features/datasheet/DatasheetCellEditor.tsx`
- Modify: `src/features/datasheet/DatasheetGrid.tsx`
- Modify: `src/features/datasheet/DatasheetPanel.tsx`
- Test: `src/features/datasheet/DatasheetEditing.test.tsx`

**Interfaces:**
- Consumes: todo lo de las tareas 3–6
- Produces:
  - `DatasheetCellEditor` con props `{ field, options, initialText, label, onCommit, onCancel }`
  - `DatasheetGridProps` gana `editing`, `onBeginEdit`, `onCommitEdit`, `onCancelEdit`, `onPaste`, `draftText`, `fieldFor`, `optionsFor`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/features/datasheet/DatasheetEditing.test.tsx`. Sigue el patrón de montaje de `DatasheetPanel.test.tsx` (léelo antes: monta el panel con sus providers reales).

```tsx
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderDatasheet } from './DatasheetPanel.test';

describe('edición en la celda', () => {
  it('abre el editor con Intro sobre una celda inline', async () => {
    const { grid } = await renderDatasheet();
    const cell = within(grid).getAllByRole('gridcell')[0]; // X de N1
    cell.focus();
    fireEvent.keyDown(cell, { key: 'Enter' });
    expect(within(grid).getByRole('textbox')).toBeInTheDocument();
  });

  it('un solo cambio se aplica al confirmar y entra en el historial normal', async () => {
    const { grid, currentProject, user } = await renderDatasheet();
    const cell = within(grid).getAllByRole('gridcell')[0];
    cell.focus();
    fireEvent.keyDown(cell, { key: 'F2' });
    const input = within(grid).getByRole('textbox');
    await user.clear(input);
    await user.type(input, '3{Enter}');
    expect(currentProject().nodes[0].x).toBe(3);
    // Un cambio simple no pide revisión.
    expect(screen.queryByRole('region', { name: /revisión|review/i })).toBeNull();
  });

  it('Escape cancela la celda sin tocar el modelo', async () => {
    const { grid, currentProject, user } = await renderDatasheet();
    const cell = within(grid).getAllByRole('gridcell')[0];
    cell.focus();
    fireEvent.keyDown(cell, { key: 'F2' });
    const input = within(grid).getByRole('textbox');
    await user.clear(input);
    await user.type(input, '3{Escape}');
    expect(currentProject().nodes[0].x).toBe(0);
  });

  it('un valor inválido no escribe y queda pendiente con su motivo', async () => {
    const { grid, currentProject, user } = await renderDatasheet();
    const cell = within(grid).getAllByRole('gridcell')[0];
    cell.focus();
    fireEvent.keyDown(cell, { key: 'F2' });
    const input = within(grid).getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'dos{Enter}');
    expect(currentProject().nodes[0].x).toBe(0);
    expect(await screen.findByRole('region', { name: /revisión|review/i })).toBeInTheDocument();
  });

  it('devuelve el foco a la celda al cerrar el editor', async () => {
    const { grid, user } = await renderDatasheet();
    const cell = within(grid).getAllByRole('gridcell')[0];
    cell.focus();
    fireEvent.keyDown(cell, { key: 'F2' });
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(cell);
  });

  it('anuncia dónde se edita una celda de panel', async () => {
    const { grid, status } = await renderDatasheet({ entity: 'members' });
    const cells = within(grid).getAllByRole('gridcell');
    const releases = cells[cells.length - 2];
    releases.focus();
    fireEvent.keyDown(releases, { key: 'F2' });
    expect(status().textContent).toMatch(/panel/i);
  });
});
```

Nota: `DatasheetPanel.test.tsx` debe exportar un ayudante `renderDatasheet` reutilizable. Si hoy no lo exporta, extráelo en el paso 3 y deja las pruebas existentes usándolo — es refactor puro, sin cambio de comportamiento.

- [ ] **Step 2: Ejecutar y ver que falla**

```bash
npx vitest run src/features/datasheet/DatasheetEditing.test.tsx --maxWorkers=1
```

Esperado: FAIL — no hay editor y `renderDatasheet` no existe.

- [ ] **Step 3: Implementar el editor de celda**

Crear `src/features/datasheet/DatasheetCellEditor.tsx`:

```tsx
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { DatasheetField } from './datasheetEditModel';

/**
 * Editor dentro de la celda enfocada.
 *
 * Guarda **texto**, no un valor interpretado: interpretar en cada pulsación
 * convertiría `1.` o `-` en `NaN` mientras el usuario todavía escribe. La
 * interpretación ocurre una sola vez, al confirmar, en `interpretDatasheetEdits`.
 *
 * `Escape` cancela sin tocar el borrador; la rejilla devuelve el foco a la celda
 * para que no pierda su única parada de tabulación.
 */

export interface DatasheetCellEditorOption {
  value: string;
  label: string;
  group?: string;
}

export interface DatasheetCellEditorProps {
  field: DatasheetField;
  /** Valor mostrado de la celda, ya en las unidades del proyecto. */
  initialText: string;
  options: readonly DatasheetCellEditorOption[];
  label: string;
  onCommit: (raw: string) => void;
  onCancel: () => void;
}

export const DatasheetCellEditor = ({
  field, initialText, options, label, onCommit, onCancel,
}: DatasheetCellEditorProps) => {
  const [text, setText] = useState(initialText);
  const controlRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    const control = controlRef.current;
    control?.focus();
    if (control instanceof HTMLInputElement) control.select();
  }, []);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    // La rejilla navega con flechas; dentro del editor son del propio control.
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      onCommit(text);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  };

  if (field.kind === 'boolean') {
    return <input
      ref={controlRef as React.RefObject<HTMLInputElement>}
      className="datasheet-cell-editor"
      type="checkbox"
      aria-label={label}
      checked={text === 'true'}
      onKeyDown={onKeyDown}
      onChange={(event) => onCommit(event.target.checked ? 'true' : 'false')}
      onBlur={onCancel}
    />;
  }

  if (field.kind === 'number') {
    return <input
      ref={controlRef as React.RefObject<HTMLInputElement>}
      className="datasheet-cell-editor"
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={text}
      onKeyDown={onKeyDown}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => onCommit(text)}
    />;
  }

  const groups = [...new Set(options.map((option) => option.group))];
  return <select
    ref={controlRef as React.RefObject<HTMLSelectElement>}
    className="datasheet-cell-editor"
    aria-label={label}
    value={text}
    onKeyDown={onKeyDown}
    onChange={(event) => onCommit(event.target.value)}
    onBlur={onCancel}
  >
    {groups.map((group) => {
      const inGroup = options.filter((option) => option.group === group);
      if (group === undefined) {
        return inGroup.map((option) => <option key={option.value} value={option.value}>{option.label}</option>);
      }
      return <optgroup key={group} label={group}>
        {inGroup.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </optgroup>;
    })}
  </select>;
};
```

- [ ] **Step 4: Coser el editor a la rejilla**

En `DatasheetGrid.tsx`, ampliar las props:

```ts
  /** Celda con el editor abierto; `null` cuando se navega. */
  editing: GridPosition | null;
  onBeginEdit: (position: GridPosition) => void;
  onCommitEdit: (rowId: string, columnId: string, raw: string) => void;
  onCancelEdit: () => void;
  onPasteBlock: (text: string, anchor: GridPosition) => void;
  /** Texto pendiente de una celda; marca el indicador de borrador. */
  draftText: (rowId: string, columnId: string) => string | undefined;
  editorFor: (row: DatasheetRow, column: DatasheetColumn) => DatasheetCellEditorProps | null;
```

En `onKeyDown`, `Enter` y `F2` abren el editor cuando la columna es `inline`:

```ts
    if (key === 'Enter' || key === 'F2') {
      event.preventDefault();
      const row = rows[safeFocus.row];
      const column = columns[safeFocus.column];
      if (key === 'Enter' && row) onActivateRow(row.id);
      if (!column) return;
      // Una celda que sí se edita abre su editor; la que no, dice por qué. El
      // silencio sería peor que cualquiera de las dos respuestas.
      if (column.editability === 'inline' && row && editorFor(row, column)) {
        onBeginEdit({ row: safeFocus.row, column: safeFocus.column });
      } else {
        onRequestEdit(column);
      }
      return;
    }
```

Añadir el manejador de pegado en el `<tbody>`:

```tsx
      <tbody
        ref={bodyRef}
        onKeyDown={onKeyDown}
        onPaste={(event) => {
          if (editing) return; // Dentro del editor, el pegado es del control.
          const text = event.clipboardData.getData('text/plain');
          if (!text) return;
          event.preventDefault();
          onPasteBlock(text, safeFocus);
        }}
      >
```

Y en la celda, el editor o el texto:

```tsx
              const pending = draftText(row.id, column.id);
              const isEditing = editing?.row === rowIndex && editing.column === columnIndex;
              const editorProps = isEditing ? editorFor(row, column) : null;
              return <Cell
                …
                data-editability={column.editability}
                data-pending={pending !== undefined ? 'true' : undefined}
                aria-readonly={column.editability === 'identity' || column.editability === 'derived'}
                …
              >
                {editorProps
                  ? <DatasheetCellEditor {...editorProps} />
                  : pending ?? datasheetCellText(row.values[column.id], units, t)}
              </Cell>;
```

Devolver el foco a la celda al cerrar el editor:

```ts
  // El editor se lleva el foco al abrirse; al cerrarse hay que devolverlo o la
  // rejilla se queda sin su única parada de tabulación.
  const wasEditingRef = useRef(false);
  useEffect(() => {
    if (editing) { wasEditingRef.current = true; return; }
    if (!wasEditingRef.current) return;
    wasEditingRef.current = false;
    bodyRef.current?.querySelector<HTMLElement>('[data-datasheet-focused="true"]')?.focus();
  }, [editing]);
```

- [ ] **Step 5: Cablear el panel**

En `DatasheetPanel.tsx`, añadir el estado y la aplicación:

```tsx
  const { project, updateProject } = useProjectModel();
  const [draft, setDraft] = useState<DatasheetEditDraft>(EMPTY_DATASHEET_DRAFT);
  const [editing, setEditing] = useState<GridPosition | null>(null);
  const [paste, setPaste] = useState<{ droppedOutside: number; droppedReadOnly: number } | null>(null);

  const plan = useMemo(
    () => interpretDatasheetEdits(project, draft, units),
    [project, draft, units],
  );
  const previewProject = useMemo(() => applyDatasheetPlan(project, plan), [project, plan]);

  const applyPlan = useCallback((target: DatasheetEditPlan) => {
    if (!target.applicable) return;
    // Una sola escritura: el plan entero entra como una entrada de historial.
    updateProject((current) => applyDatasheetPlan(current, target));
    setDraft(EMPTY_DATASHEET_DRAFT);
    setPaste(null);
  }, [updateProject]);

  const onCommitEdit = useCallback((rowId: string, columnId: string, raw: string) => {
    setEditing(null);
    const row = rows.find((candidate) => candidate.id === rowId);
    const fieldId = row ? datasheetRowField(entity, columnId, row.kind) : undefined;
    if (!fieldId) return;
    const next = stageDatasheetEdit(draft, rowId, fieldId, raw);
    const nextPlan = interpretDatasheetEdits(project, next, units);
    // Si el borrador estaba vacío y el cambio es válido y único, se aplica ya:
    // pedir «Aplicar» por cada celda haría inservible una hoja de datos. En
    // cualquier otro caso el cambio se suma al borrador y pasa por revisión.
    if (datasheetDraftCount(draft) === 0 && nextPlan.applicable && nextPlan.changes.length === 1) {
      applyPlan(nextPlan);
      return;
    }
    setDraft(next);
  }, [applyPlan, draft, entity, project, rows, units]);

  const onCancelDraft = useCallback(() => {
    setDraft(EMPTY_DATASHEET_DRAFT);
    setPaste(null);
  }, []);
```

Y el pegado:

```tsx
  const onPasteBlock = useCallback((text: string, anchor: GridPosition) => {
    const result = mapPasteToEdits({ block: parseClipboardGrid(text), rows, columns, entity, anchor });
    if (result.edits.length === 0 && result.droppedOutside === 0 && result.droppedReadOnly === 0) return;
    setDraft((current) => result.edits.reduce(
      (accumulated, edit) => stageDatasheetEdit(accumulated, edit.rowId, edit.fieldId, edit.raw),
      current,
    ));
    setPaste({ droppedOutside: result.droppedOutside, droppedReadOnly: result.droppedReadOnly });
  }, [columns, entity, rows]);
```

Cambiar de entidad limpia el borrador, porque sus filas y columnas son otras:

```tsx
  useEffect(() => {
    setFilters({});
    setSort(null);
    setFocus({ row: 0, column: 0 });
    setDraft(EMPTY_DATASHEET_DRAFT);
    setEditing(null);
    setPaste(null);
    rangeAnchorRef.current = null;
  }, [entity]);
```

`editorFor` construye las props del editor con el texto mostrado y las opciones traducidas:

```tsx
  const editorFor = useCallback((row: DatasheetRow, column: DatasheetColumn): DatasheetCellEditorProps | null => {
    const fieldId = datasheetRowField(entity, column.id, row.kind);
    if (!fieldId) return null;
    const field = datasheetField(fieldId);
    const value = row.values[column.id];
    return {
      field,
      initialText: draft[draftKey(row.id, fieldId)]
        ?? datasheetEditorText(value, units, field),
      options: datasheetFieldOptions(field, project, language, t),
      label: t('datasheet.edit.cellLabel', { column: t(column.labelKey), row: row.id }),
      onCommit: (raw) => onCommitEdit(row.id, column.id, raw),
      onCancel: () => setEditing(null),
    };
  }, [draft, entity, language, onCommitEdit, project, t, units]);
```

Añadir a `datasheetPresentation.ts` las dos funciones que usa:

```ts
/**
 * Texto con el que se **abre** el editor. No es el texto de lectura: un número
 * se sirve sin redondear para que confirmar sin tocar nada no altere el valor.
 */
export const datasheetEditorText = (
  value: DatasheetValue | undefined,
  units: UnitSystemId,
  field: DatasheetField,
): string => {
  if (!value) return '';
  if (value.kind === 'ref') return value.id;
  if (value.kind === 'token') return value.token;
  if (value.kind === 'text') return value.text;
  if (value.value === null) return '';
  return serializeInspectorNumber(
    field.quantity ? toDisplay(value.value, units, field.quantity) : value.value,
  );
};

/** Opciones del editor: unión del dominio, catálogo, o los casos del proyecto. */
export const datasheetFieldOptions = (
  field: DatasheetField,
  project: ProjectModel,
  language: Language,
  t: (key: TranslationKey) => string,
): readonly DatasheetCellEditorOption[] => {
  if (field.optionsFrom === 'loadCases') {
    return project.loadCases.map((item) => ({ value: item.id, label: item.name }));
  }
  if (field.kind === 'material' || field.kind === 'section') {
    // El catálogo ya viene agrupado y traducido de la edición múltiple.
    return bulkPropertyOptionGroups(
      { id: field.id, kind: field.kind } as unknown as BulkPropertyState,
      { t: createBulkEditTranslator(language), language, units: project.settings.units },
    ).flatMap((group) => group.options.map((option) => ({ ...option, group: group.label })));
  }
  return (field.options ?? []).map((option) => ({
    value: option,
    label: t(datasheetOptionLabelKey(field.id, option)),
  }));
};
```

`datasheetOptionLabelKey` mapea `(fieldId, opción)` a la clave que ya existe: `node.support.type` a `datasheet.support.*`, `member.type` a `datasheet.memberType.*`, `memberLoad.coordinateSystem` a `datasheet.coordinateSystem.*`, `memberLoad.lengthBasis` a `datasheet.lengthBasis.*`. Un `Record` explícito, no una plantilla: una clave construida con `${}` no la verifica TypeScript.

Añadir en `catalogs.ts` `'datasheet.edit.cellLabel'`: `'{column} de {row}'` / `'{column} of {row}'`.

- [ ] **Step 6: Ejecutar y ver que pasa**

```bash
npx vitest run src/features/datasheet --maxWorkers=1
```

Esperado: PASS. Las pruebas de revisión de la tarea 9 todavía no existen; las que aquí buscan la región de revisión pasan en cuanto la tarea 9 esté hecha — si te bloquean, márcalas `it.todo` y devuélvelas en la tarea 9.

- [ ] **Step 7: Commit**

```bash
git add src/features/datasheet src/i18n/catalogs.ts
git commit -m "feat: edit datasheet cells inline with a single-change fast path"
```

---

### Task 8: Editores visuales del panel

**Files:**
- Create: `src/features/datasheet/DatasheetEditorPanel.tsx`
- Delete: `src/features/datasheet/DatasheetContextPanel.tsx`
- Modify: `src/features/datasheet/DatasheetPanel.tsx`
- Test: `src/features/datasheet/DatasheetEditorPanel.test.tsx`

**Interfaces:**
- Consumes: `previewProject` y `onStage` del panel (tarea 7); `SectionViewer2D` de `../inspector/SectionViewer2D`; `NodeNeighborhood` y `SupportGlyph`, que se mudan desde `DatasheetContextPanel.tsx`
- Produces: `DatasheetEditorPanel` con props `{ project, previewProject, target, units, language, t, draftText, onStage, onFocusObject, focusLabel }`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/features/datasheet/DatasheetEditorPanel.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderDatasheet } from './DatasheetPanel.test';

describe('editores visuales', () => {
  it('mueve el nudo del preview al escribir X, sin tocar el modelo', async () => {
    const { user, currentProject } = await renderDatasheet();
    const x = screen.getByLabelText(/^X /);
    await user.clear(x);
    await user.type(x, '3');
    const preview = screen.getByTestId('datasheet-node-preview');
    // El fantasma es la posición anterior; el nudo lleno, la del borrador.
    expect(within(preview).getByTestId('datasheet-node-preview-ghost')).toBeInTheDocument();
    expect(currentProject().nodes[0].x).toBe(0);
  });

  it('cambia el glifo del apoyo conforme se edita', async () => {
    const { user } = await renderDatasheet();
    await user.selectOptions(screen.getByLabelText(/apoyo|support/i), 'roller');
    expect(screen.getByTestId('datasheet-support-preview')).toHaveAttribute('data-support', 'roller');
  });

  it('dibuja la sección antes y después al elegir otro perfil', async () => {
    const { user } = await renderDatasheet({ entity: 'members' });
    await user.selectOptions(screen.getByLabelText(/sección|section/i), 'w14x30');
    const viewers = screen.getAllByTestId('section-viewer-2d');
    expect(viewers).toHaveLength(2);
  });

  it('el material personalizado abre E, G y densidad', async () => {
    const { user } = await renderDatasheet({ entity: 'members' });
    await user.click(screen.getByRole('radio', { name: /personalizado|custom/i }));
    expect(screen.getByLabelText(/^E /)).toBeInTheDocument();
    expect(screen.getByLabelText(/^G /)).toBeInTheDocument();
  });

  it('gira la flecha de la carga al cambiar su signo', async () => {
    const { user } = await renderDatasheet({ entity: 'loads' });
    const fy = screen.getByLabelText(/^Fy /);
    await user.clear(fy);
    await user.type(fy, '8');
    expect(screen.getByTestId('datasheet-load-preview')).toHaveAttribute('data-direction', 'up');
  });

  it('aplica el borrador del panel como una sola entrada de historial', async () => {
    const { user, currentProject, historyLength } = await renderDatasheet();
    const before = historyLength();
    const x = screen.getByLabelText(/^X /);
    await user.clear(x);
    await user.type(x, '3');
    const y = screen.getByLabelText(/^Y /);
    await user.clear(y);
    await user.type(y, '2');
    await user.click(screen.getByRole('button', { name: /aplicar/i }));
    expect(currentProject().nodes[0]).toMatchObject({ x: 3, y: 2 });
    expect(historyLength()).toBe(before + 1);
  });

  it('cancelar devuelve el preview al modelo', async () => {
    const { user, currentProject } = await renderDatasheet();
    const x = screen.getByLabelText(/^X /);
    await user.clear(x);
    await user.type(x, '3');
    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(currentProject().nodes[0].x).toBe(0);
    expect(screen.queryByTestId('datasheet-node-preview-ghost')).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

```bash
npx vitest run src/features/datasheet/DatasheetEditorPanel.test.tsx --maxWorkers=1
```

Esperado: FAIL — el panel editor no existe.

- [ ] **Step 3: Mudar las tarjetas y volverlas editoras**

Crear `DatasheetEditorPanel.tsx` con el contenido de `DatasheetContextPanel.tsx` como punto de partida (`Card`, `Facts`, `SupportGlyph`, `NodeNeighborhood`, `describeMemberLoad` se mudan tal cual) y estos cambios:

1. **Dos proyectos.** `project` es el real; `previewProject` es el del plan. Toda tarjeta lee del **preview**, salvo el «Antes» explícito, que lee del real.

2. **Nudo.** `NodeNeighborhood` recibe además la posición anterior y dibuja el fantasma:

```tsx
  {ghost ? <circle
    className="datasheet-node-preview__ghost"
    data-testid="datasheet-node-preview-ghost"
    cx={ghost.x} cy={ghost.y} r="4.5"
  /> : null}
```

El `<svg>` lleva `data-testid="datasheet-node-preview"`. Bajo el dibujo, dos `UnitField` para X e Y, etiquetados `X (m)` e `Y (m)` con la unidad del proyecto, cuyo `onChange` llama a `onStage('node.x', texto)`.

3. **Apoyo.** Un `Select` con los cinco tipos y, cuando el tipo resultante es `custom`, tres casillas de restricción; cuando es `roller`, el ángulo de la normal. El `<svg>` lleva `data-testid="datasheet-support-preview"` y `data-support={supportDelPreview.type}`, de modo que el glifo cambia con el borrador sin ninguna lógica nueva de dibujo.

4. **Material.** Un `role="radiogroup"` con dos opciones, Catálogo y Personalizado:

```tsx
{/*
  Los dos modos que el modelo ya distingue, hechos visibles. Catálogo fija la
  identidad y sus números juntos, como `member.material.apply`. Personalizado
  edita E, G y ρ, lo que degrada el origen a `custom`: la regla existe en el
  modelo y el editor la enseña en vez de dejar que ocurra de lado.
*/}
```

En modo Catálogo, un `Select` con `datasheetFieldOptions` del campo `member.materialId`. En modo Personalizado, tres `UnitField` para `member.E`, `member.G` y `member.density`. Debajo, la transición **Antes → Después** con el nombre del material del proyecto real y el del preview.

5. **Sección.** Dos `SectionViewer2D`, uno con los valores del proyecto real y otro con los del preview, y el `Select` de perfiles del campo `member.sectionId`. Cuando el borrador no toca la sección se dibuja **uno solo**, para no repetir la misma imagen dos veces:

```tsx
  const sectionChanged = previewMember.sectionId !== member.sectionId
    || previewMember.A !== member.A || previewMember.I !== member.I;
```

6. **Liberaciones.** Dos casillas, `member.releases.iMoment` y `member.releases.jMoment`. Es la única columna `panel`, y por eso está aquí y no en la celda.

7. **Carga.** Para una carga nodal, tres `UnitField` (Fx, Fy, Mz) y el `Select` de caso; para una de barra, los campos de su familia. La flecha:

```tsx
{/*
  La flecha es la carga, no un adorno: su sentido sale del signo y su longitud
  de la magnitud relativa a la mayor del caso. `data-direction` la hace legible
  para una prueba sin depender de una transformación concreta.
*/}
<svg
  className="datasheet-load-preview"
  data-testid="datasheet-load-preview"
  data-direction={fy > 0 ? 'up' : fy < 0 ? 'down' : 'none'}
  viewBox="0 0 80 60"
  role="presentation"
>…</svg>
```

8. **Barra del borrador.** Al pie del panel, cuando `pendingCount > 0`:

```tsx
  <footer className="datasheet-draft-bar" role="status">
    <p>{pendingCount === 1 ? t('datasheet.draft.countOne') : t('datasheet.draft.count', { count: pendingCount })}</p>
    <Button variant="ghost" onClick={onCancelDraft}>{t('datasheet.draft.cancel')}</Button>
    <Button variant="primary" disabled={!plan.applicable} onClick={onApply}>{t('datasheet.draft.apply')}</Button>
  </footer>
```

9. Borrar `datasheet.readOnlyPhase` del pie y su clave del catálogo: ya no es verdad.

Sustituir el uso en `DatasheetPanel.tsx` y **borrar** `DatasheetContextPanel.tsx`. Actualizar `DatasheetPanel.test.tsx` si nombra ese archivo.

- [ ] **Step 4: Añadir las claves i18n**

En `es`: `datasheet.draft.count` `'{count} cambios pendientes'`, `datasheet.draft.countOne` `'1 cambio pendiente'`, `datasheet.draft.apply` `'Aplicar'`, `datasheet.draft.cancel` `'Cancelar'`, `datasheet.material.catalog` `'Catálogo'`, `datasheet.material.custom` `'Personalizado'`, `datasheet.material.mode` `'Origen del material'`, `datasheet.field.before` `'Antes'`, `datasheet.field.after` `'Después'`, `datasheet.card.releases` `'Liberaciones'`, `datasheet.field.releaseI` `'Momento en i'`, `datasheet.field.releaseJ` `'Momento en j'`.

En `en`: `'{count} pending changes'`, `'1 pending change'`, `'Apply'`, `'Cancel'`, `'Catalog'`, `'Custom'`, `'Material source'`, `'Before'`, `'After'`, `'Releases'`, `'Moment at i'`, `'Moment at j'`.

- [ ] **Step 5: Ejecutar y ver que pasa**

```bash
npx vitest run src/features/datasheet --maxWorkers=1
```

Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A src/features/datasheet src/i18n/catalogs.ts
git commit -m "feat: turn the datasheet context cards into visual editors with live preview"
```

---

### Task 9: Revisión del plan

**Files:**
- Create: `src/features/datasheet/DatasheetReviewPanel.tsx`
- Modify: `src/features/datasheet/DatasheetPanel.tsx`
- Test: `src/features/datasheet/DatasheetReview.test.tsx`

**Interfaces:**
- Consumes: `DatasheetEditPlan` (tarea 4), resultado de `mapPasteToEdits` (tarea 6)
- Produces: `DatasheetReviewPanel` con props `{ plan, paste, project, units, language, t, entity, onApply, onCancel }`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/features/datasheet/DatasheetReview.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderDatasheet } from './DatasheetPanel.test';

const pasteInto = (cell: HTMLElement, text: string) => {
  fireEvent.paste(cell.closest('tbody')!, {
    clipboardData: { getData: () => text },
  });
};

describe('revisión de un cambio múltiple', () => {
  it('un pegado no escribe hasta que se aplica', async () => {
    const { grid, currentProject } = await renderDatasheet();
    const cell = within(grid).getAllByRole('gridcell')[0];
    cell.focus();
    pasteInto(cell, '1\t2\n3\t4');
    expect(currentProject().nodes[0].x).toBe(0);
    expect(await screen.findByRole('region', { name: /revisión|review/i })).toBeInTheDocument();
  });

  it('enseña antes y después de cada celda', async () => {
    const { grid } = await renderDatasheet();
    const cell = within(grid).getAllByRole('gridcell')[0];
    cell.focus();
    pasteInto(cell, '1\t2');
    const review = await screen.findByRole('region', { name: /revisión|review/i });
    expect(within(review).getByText('N1')).toBeInTheDocument();
  });

  it('aplica el bloque entero como una sola entrada de historial', async () => {
    const { grid, currentProject, historyLength, user } = await renderDatasheet();
    const before = historyLength();
    const cell = within(grid).getAllByRole('gridcell')[0];
    cell.focus();
    pasteInto(cell, '1\t2\n3\t4');
    const review = await screen.findByRole('region', { name: /revisión|review/i });
    await user.click(within(review).getByRole('button', { name: /aplicar/i }));
    expect(currentProject().nodes[0]).toMatchObject({ x: 1, y: 2 });
    expect(currentProject().nodes[1]).toMatchObject({ x: 3, y: 4 });
    expect(historyLength()).toBe(before + 1);
  });

  it('cancelar no escribe nada', async () => {
    const { grid, currentProject, user } = await renderDatasheet();
    const cell = within(grid).getAllByRole('gridcell')[0];
    cell.focus();
    pasteInto(cell, '1\t2\n3\t4');
    const review = await screen.findByRole('region', { name: /revisión|review/i });
    await user.click(within(review).getByRole('button', { name: /cancelar/i }));
    expect(currentProject().nodes[0].x).toBe(0);
    expect(screen.queryByRole('region', { name: /revisión|review/i })).toBeNull();
  });

  it('un solo valor inválido bloquea el bloque entero', async () => {
    const { grid, currentProject, user } = await renderDatasheet();
    const cell = within(grid).getAllByRole('gridcell')[0];
    cell.focus();
    pasteInto(cell, '1\t2\ntres\t4');
    const review = await screen.findByRole('region', { name: /revisión|review/i });
    expect(within(review).getByRole('button', { name: /aplicar/i })).toBeDisabled();
    await user.click(within(review).getByRole('button', { name: /cancelar/i }));
    expect(currentProject().nodes[0].x).toBe(0);
  });

  it('cuenta lo que el pegado descartó en vez de callarlo', async () => {
    const { grid } = await renderDatasheet();
    const cell = within(grid).getAllByRole('gridcell')[0];
    cell.focus();
    // Cinco líneas sobre una tabla de tres nudos: dos caen fuera.
    pasteInto(cell, '1\n2\n3\n4\n5');
    const review = await screen.findByRole('region', { name: /revisión|review/i });
    expect(within(review).getByText(/2/)).toBeInTheDocument();
  });

  it('avisa de los nudos coincidentes sin fusionarlos', async () => {
    const { grid, currentProject, user } = await renderDatasheet();
    const cell = within(grid).getAllByRole('gridcell')[0];
    cell.focus();
    // N1 a (0, 4), donde ya está N2.
    pasteInto(cell, '0\t4');
    const review = await screen.findByRole('region', { name: /revisión|review/i });
    expect(within(review).getByRole('status', { name: /coincident/i })).toBeInTheDocument();
    await user.click(within(review).getByRole('button', { name: /aplicar/i }));
    // Avisar no es fusionar: siguen siendo tres nudos.
    expect(currentProject().nodes).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

```bash
npx vitest run src/features/datasheet/DatasheetReview.test.tsx --maxWorkers=1
```

Esperado: FAIL — no hay panel de revisión.

- [ ] **Step 3: Implementar la revisión**

Crear `DatasheetReviewPanel.tsx`. Toma el carril del panel contextual mientras hay algo que revisar:

```tsx
/**
 * Revisión del plan antes de escribir.
 *
 * No es un `Dialog`. `ModalSurface` registra su `Escape` en `document` sin
 * detener la propagación, así que un diálogo anidado dentro del drawer del
 * datasheet cerraría los dos con una pulsación. Esta revisión vive **dentro**
 * del drawer, en el carril del panel contextual, y hereda su foco atrapado.
 *
 * Enseña tres cosas que un contador solo escondería: qué cambia celda a celda,
 * qué se descartó del pegado y por qué, y qué avisos deja el plan sin bloquear.
 */
export const DatasheetReviewPanel = ({ plan, paste, units, language, t, entity, onApply, onCancel }) =>
  <Surface as="section" level="raised" className="datasheet-review" role="region" aria-label={t('datasheet.review.title')}>
    <PanelHeader title={t('datasheet.review.title')} description={
      plan.errors.length > 0
        ? t('datasheet.review.blocked', { count: plan.errors.length })
        : t('datasheet.review.ready', { count: plan.changes.length })
    } />

    {paste && (paste.droppedOutside > 0 || paste.droppedReadOnly > 0)
      ? <Banner tone="warning">
        {t('datasheet.review.dropped', {
          outside: paste.droppedOutside,
          readOnly: paste.droppedReadOnly,
        })}
      </Banner>
      : null}

    {plan.coincidentNodeIds.length > 0
      ? <Banner tone="warning" role="status" aria-label={t('datasheet.review.coincidentLabel')}>
        {t('datasheet.review.coincident', { ids: plan.coincidentNodeIds.join(', ') })}
      </Banner>
      : null}

    <dl className="datasheet-review__list">
      {plan.changes.map((change) => <div key={`${change.rowId}|${change.fieldId}`}>
        <dt>{change.rowId}</dt>
        <dd>
          {formatPlannedValue(change.before, change.fieldId, units, language, t)}
          <span className="sr-only">{t('datasheet.review.to')}</span>
          <ArrowRight size={13} aria-hidden="true" />
          {formatPlannedValue(change.after, change.fieldId, units, language, t)}
        </dd>
      </div>)}
    </dl>

    {plan.errors.length > 0
      ? <ul className="datasheet-review__errors">
        {plan.errors.map((error) => <li key={`${error.rowId}|${error.fieldId}`}>
          {t(reviewErrorKey(error.code), { row: error.rowId, raw: error.raw })}
        </li>)}
      </ul>
      : null}

    <footer className="datasheet-review__actions">
      <Button variant="ghost" onClick={onCancel}>{t('datasheet.draft.cancel')}</Button>
      <Button variant="primary" disabled={!plan.applicable} onClick={onApply}>
        {t('datasheet.review.applyAll')}
      </Button>
    </footer>
  </Surface>;
```

`formatPlannedValue` convierte de base al sistema del proyecto y rotula: reutiliza `formatDatasheetNumber` para los números y las claves de opción para los enumerados. `reviewErrorKey` mapea los seis códigos a sus claves; un `Record<DatasheetEditErrorCode, TranslationKey>` explícito, para que un código nuevo rompa la compilación.

En `DatasheetPanel.tsx`, la revisión sustituye al panel editor cuando hay más de un cambio pendiente o algún error:

```tsx
  // Un solo cambio pendiente se revisa en el propio editor, que ya lo enseña con
  // su preview; abrir un panel aparte para una celda sería ruido.
  const reviewing = plan.errors.length > 0 || plan.changes.length > 1 || paste !== null;
```

Y en el render, `{reviewing ? <DatasheetReviewPanel … /> : <DatasheetEditorPanel … />}`.

- [ ] **Step 4: Añadir las claves i18n**

En `es`: `datasheet.review.title` `'Revisión de cambios'`, `datasheet.review.ready` `'{count} celdas se escribirán.'`, `datasheet.review.blocked` `'{count} celdas no son válidas; no se escribirá ninguna.'`, `datasheet.review.applyAll` `'Aplicar todo'`, `datasheet.review.to` `'pasa a'`, `datasheet.review.dropped` `'{outside} celdas caen fuera de la tabla y {readOnly} sobre columnas que no se editan.'`, `datasheet.review.coincident` `'Estos nudos quedarían en el mismo punto: {ids}. La hoja no los fusiona; usa el Model Doctor si quieres unirlos.'`, `datasheet.review.coincidentLabel` `'Nudos coincidentes'`, y `datasheet.error.*` para los seis códigos:

```ts
  'datasheet.error.not-a-number': '{row}: «{raw}» no es un número.',
  'datasheet.error.not-positive': '{row}: «{raw}» debe ser mayor que cero.',
  'datasheet.error.out-of-range': '{row}: «{raw}» está fuera del intervalo admitido.',
  'datasheet.error.unknown-option': '{row}: «{raw}» no es una opción válida.',
  'datasheet.error.ineligible': '{row} no admite este campo.',
  'datasheet.error.unknown-row': '{row} ya no existe en el modelo.',
```

Sus equivalentes en `en`.

- [ ] **Step 5: Ejecutar la suite entera del datasheet**

```bash
npx vitest run src/features/datasheet --maxWorkers=1
```

Esperado: PASS, incluidas las pruebas de la tarea 7 que esperaban la región de revisión.

- [ ] **Step 6: Commit**

```bash
git add src/features/datasheet src/i18n/catalogs.ts
git commit -m "feat: review a multi-cell datasheet plan before applying it whole"
```

---

### Task 10: Estilo, accesibilidad y contrato

**Files:**
- Modify: `src/features/datasheet/datasheet.css`
- Modify: `src/features/datasheet/datasheetStyles.test.ts`
- Modify: `src/features/datasheet/DatasheetAccessibility.test.tsx`
- Modify: `docs/architecture/structureco-datasheet-cri-81.md`
- Modify: `docs/README.md`, `docs/architecture/README.md`

- [ ] **Step 1: Escribir las pruebas que fallan**

En `datasheetStyles.test.ts`:

```ts
  it('distingue pendiente, foco y selección con tres señales distintas', () => {
    // Las tres pueden coincidir en la misma celda: si compartieran señal, no
    // habría forma de saber si una celda está seleccionada o sin aplicar.
    const pending = ruleFor(".datasheet-grid tbody td[data-pending='true']");
    expect(pending).toMatch(/--sc-color-/);
    expect(pending).not.toMatch(/outline:/);
    expect(pending).not.toMatch(/background:\s*var\(--sc-color-selection\)/);
  });

  it('mantiene la revisión y los editores dentro del sistema de tokens', () => {
    for (const selector of ['.datasheet-review', '.datasheet-cell-editor', '.datasheet-draft-bar']) {
      expect(ruleFor(selector), selector).not.toBe('');
    }
  });
```

En `DatasheetAccessibility.test.tsx`:

```tsx
  it('anuncia dónde se edita una celda que sólo el panel escribe', async () => { /* … */ });
  it('marca editable la celda inline y de sólo lectura la identidad', async () => {
    const { grid } = await renderDatasheet();
    const cells = within(grid).getAllByRole('gridcell');
    expect(cells[0]).not.toHaveAttribute('aria-readonly', 'true'); // X
    expect(within(grid).getAllByRole('rowheader')[0]).toHaveAttribute('aria-readonly', 'true'); // id
  });
  it('anuncia el recuento del borrador en una región viva', async () => { /* … */ });
```

- [ ] **Step 2: Ejecutar y ver que fallan**

```bash
npx vitest run src/features/datasheet/datasheetStyles.test.ts src/features/datasheet/DatasheetAccessibility.test.tsx --maxWorkers=1
```

- [ ] **Step 3: Escribir el CSS**

En `datasheet.css`, sólo tokens `--sc-*`, ningún color literal:

```css
/*
  Tres estados que pueden coincidir en la misma celda, con tres señales que no
  se confunden: la selección es fondo, el foco es anillo y lo pendiente es una
  marca en el borde de inicio. Compartir cualquiera de ellas haría ilegible una
  celda seleccionada, enfocada y sin aplicar a la vez.
*/
.datasheet-grid tbody td[data-pending='true'],
.datasheet-grid tbody th[data-pending='true'] {
  box-shadow: inset 3px 0 0 0 var(--sc-color-accent);
  font-weight: var(--sc-font-weight-medium);
}

.datasheet-cell-editor { /* control a ras de celda, sin relieve clay */ }
.datasheet-draft-bar { /* barra al pie del panel */ }
.datasheet-review { /* carril de revisión */ }
.datasheet-node-preview__ghost { /* posición anterior, atenuada */ }
```

El implementador rellena cada bloque con los tokens existentes: consulta `datasheet.css` y `tokens.css` para los nombres exactos (`--sc-color-accent`, `--sc-space-*`, `--sc-radius-*`, `--sc-control-height-*`). Mantén la regla de `min-height: var(--sc-control-height-touch)` para los controles nuevos en viewport pequeño y el bloque `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 4: Actualizar el contrato canónico**

En `docs/architecture/structureco-datasheet-cri-81.md`:

- Renombrar el archivo a `structureco-datasheet.md` y actualizar los tres enlaces (`docs/README.md`, `docs/architecture/README.md`, la nota histórica del spec de CRI-81). El nombre con el número de un ticket envejeció mal en cuanto llegó el segundo.
- Sustituir «fase de auditoría de sólo lectura» por el alcance vigente.
- Reescribir la tabla de editabilidad con las cuatro ramas.
- Añadir la sección «Ruta de escritura», con la justificación de `updateProject` y la constancia verificada de que `NodeBulkChanges` no tiene `x` ni `y`.
- Añadir «Coincidencia de nudos»: la hoja avisa y no repara, a diferencia del Inspector.
- Añadir la entidad Cargas y la nota de que `Selection.multi` no se amplía.
- Ampliar la tabla de teclado con `Intro`/`F2` abriendo el editor, `Esc` cancelando la celda y `Ctrl`+`V`.
- Actualizar la lista de pruebas de la sección «Verificación».
- Añadir a «Historia» el enlace al diseño de CRI-82.

- [ ] **Step 5: Verificar todo**

```bash
npx vitest run src/features/datasheet --maxWorkers=1
npx tsc --noEmit -p tsconfig.app.json
npx vitest run src/features/bulk-edit src/features/inspector --maxWorkers=1
```

Esperado: todo PASS. La tercera orden comprueba que reutilizar `bulkEditProperties` y `sectionGeometry` no rompió a sus dueños.

- [ ] **Step 6: Humo de navegador**

Levantar la app y recorrer los cuatro flujos: editar una coordenada en la celda, cambiar un material desde el editor visual, pegar un bloque y cancelarlo, pegar un bloque y aplicarlo. Comprobar la consola sin errores y capturar el resultado.

- [ ] **Step 7: Commit**

```bash
git add -A src/features/datasheet docs
git commit -m "docs: record the datasheet editing contract and style the editors"
```

---

## Self-review

**Cobertura del spec.** Modelo de interacción → tareas 7–9. Atomicidad y ruta de escritura → tareas 4, 5, 7. Reutilización de bulk-edit → tarea 3. Editabilidad → tarea 1. Cargas → tarea 2. Unidades → tarea 4. Validación → tarea 4. Coincidencia de nudos → tareas 4 y 9. Pegado → tareas 6 y 9. Previews → tarea 8. Teclado y accesibilidad → tareas 7 y 10. Estilo → tarea 10. Documentación → tarea 10.

**Consistencia de tipos.** `DatasheetFieldId` (tarea 3) se usa igual en 4, 6 y 7. `DatasheetEditPlan` (tarea 4) lo consumen 5, 7, 8 y 9. `applyDatasheetPlan` (tarea 5) tiene una sola firma en todo el plan. `datasheetRowField` resuelve la columna contra la fila y es la que usan tanto el pegado como el editor de celda; `datasheetColumnField` sólo sirve para la prueba de cobertura de columnas.

**Dependencia entre tareas.** Estrictamente secuencial: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. Las pruebas de la tarea 7 que buscan la región de revisión se cierran en la 9; está anotado en su paso 6.
