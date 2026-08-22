/**
 * Formularios autoritativos de Space 3D.
 *
 * Todo campo numérico es un borrador de texto: se escribe libre y sólo se
 * convierte al confirmar. Convertir en cada pulsación impide escribir «-», «0.»
 * o «1e-» y obliga a inventar un valor mientras el usuario todavía teclea.
 *
 * No se crean coordenadas con un clic en la escena: en tres dimensiones un
 * punto de pantalla es una recta, no un punto, y adivinar la profundidad
 * produciría geometría que el usuario no ha decidido.
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { fixedSpace3DRestraints, freeSpace3DRestraints, type Space3DFrameMember, type Space3DNodalLoad, type Space3DNode, type Space3DProjectV1, type Space3DRestraints } from '../../space3d/model/types';
import type { Space3DCommand } from '../../space3d/data/commands';
import type { TranslationKey } from '../../i18n/catalogs';

export type Space3DEditorTarget =
  | { readonly kind: 'node'; readonly id: string | null }
  | { readonly kind: 'member'; readonly id: string | null }
  | { readonly kind: 'load'; readonly id: string | null };

export interface Space3DEntityEditorProps {
  readonly project: Space3DProjectV1;
  readonly target: Space3DEditorTarget;
  readonly t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  readonly onSubmit: (command: Space3DCommand) => boolean;
  readonly onCancel: () => void;
  readonly onDelete?: (target: Space3DEditorTarget) => void;
}

type Draft = Record<string, string>;

const DOF_KEYS = ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'] as const;
const LOAD_KEYS = ['fx', 'fy', 'fz', 'mx', 'my', 'mz'] as const;
const PROPERTY_KEYS = ['E', 'G', 'A', 'Iy', 'Iz', 'J'] as const;

const nextId = (prefix: string, used: readonly string[]): string => {
  let index = used.length + 1;
  while (used.includes(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
};

const numeric = (value: string): number | null => {
  const trimmed = value.trim().replace(',', '.');
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const nodeDraft = (node: Space3DNode | undefined): Draft => ({
  x: String(node?.x ?? 0),
  y: String(node?.y ?? 0),
  z: String(node?.z ?? 0),
});

const memberDraft = (member: Space3DFrameMember | undefined, fallback: Space3DFrameMember | undefined): Draft => {
  const source = member ?? fallback;
  return {
    E: String(source?.E ?? 200_000_000),
    G: String(source?.G ?? 77_000_000),
    A: String(source?.A ?? 0.0076),
    Iy: String(source?.Iy ?? 4.5e-5),
    Iz: String(source?.Iz ?? 1.36e-4),
    J: String(source?.J ?? 4e-7),
    refX: String(source?.orientation.localYReferenceGlobal[0] ?? 0),
    refY: String(source?.orientation.localYReferenceGlobal[1] ?? 1),
    refZ: String(source?.orientation.localYReferenceGlobal[2] ?? 0),
    roll: String(source?.orientation.rollRadians ?? 0),
  };
};

const loadDraft = (load: Space3DNodalLoad | undefined): Draft => ({
  fx: String(load?.fx ?? 0),
  fy: String(load?.fy ?? 0),
  fz: String(load?.fz ?? 0),
  mx: String(load?.mx ?? 0),
  my: String(load?.my ?? 0),
  mz: String(load?.mz ?? 0),
});

export const Space3DEntityEditor = ({ project, target, t, onSubmit, onCancel, onDelete }: Space3DEntityEditorProps) => {
  const node = target.kind === 'node' ? project.nodes.find((item) => item.id === target.id) : undefined;
  const member = target.kind === 'member' ? project.members.find((item) => item.id === target.id) : undefined;
  const load = target.kind === 'load' ? project.nodalLoads.find((item) => item.id === target.id) : undefined;

  const initialDraft = useMemo(() => {
    if (target.kind === 'node') return nodeDraft(node);
    if (target.kind === 'member') return memberDraft(member, project.members[0]);
    return loadDraft(load);
  }, [load, member, node, project.members, target.kind]);

  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [restraints, setRestraints] = useState<Space3DRestraints>(node?.restraints ?? freeSpace3DRestraints());
  const [endI, setEndI] = useState(member?.i ?? project.nodes[0]?.id ?? '');
  const [endJ, setEndJ] = useState(member?.j ?? project.nodes[1]?.id ?? '');
  const [loadNodeId, setLoadNodeId] = useState(load?.nodeId ?? project.nodes[0]?.id ?? '');
  const [loadCaseId, setLoadCaseId] = useState(load?.caseId ?? project.loadCases[0]?.id ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const key = `${target.kind}:${target.id ?? 'new'}`;
  useEffect(() => {
    setDraft(initialDraft);
    setRestraints(node?.restraints ?? freeSpace3DRestraints());
    setEndI(member?.i ?? project.nodes[0]?.id ?? '');
    setEndJ(member?.j ?? project.nodes[1]?.id ?? '');
    setLoadNodeId(load?.nodeId ?? project.nodes[0]?.id ?? '');
    setLoadCaseId(load?.caseId ?? project.loadCases[0]?.id ?? '');
    setErrors({});
    // Un cambio de entidad recarga el borrador entero; el resto de dependencias
    // son el propio proyecto, que no debe pisar lo que el usuario está tecleando.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  /**
   * La unidad va fuera del `<label>` y se enlaza con `aria-describedby`: si
   * viviera dentro, el nombre accesible del campo sería «X m» en vez de «X», y
   * el usuario de lector de pantalla oiría la unidad como parte del rótulo.
   */
  const field = (name: string, label: string, unit?: string, positive = false) => {
    const invalid = errors[name];
    const inputId = `space3d-${target.kind}-${name}`;
    const unitId = unit ? `${inputId}-unit` : undefined;
    return <div className={`space3d-field${invalid ? ' is-invalid' : ''}`} key={name}>
      <label className="space3d-field-label" htmlFor={inputId}>{label}</label>
      {unit ? <span className="space3d-field-unit" id={unitId}>{unit}</span> : null}
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-describedby={unitId}
        value={draft[name] ?? ''}
        aria-invalid={invalid ? true : undefined}
        onChange={(event) => setDraft((current) => ({ ...current, [name]: event.target.value }))}
      />
      {invalid ? <small role="alert">{t(positive ? 'space3d.requiredPositive' : 'space3d.requiredNumber')}</small> : null}
    </div>;
  };

  const readNumbers = (names: readonly string[], positive: readonly string[] = []): Record<string, number> | null => {
    const next: Record<string, string> = {};
    const values: Record<string, number> = {};
    for (const name of names) {
      const value = numeric(draft[name] ?? '');
      if (value === null || (positive.includes(name) && value <= 0)) next[name] = 'invalid';
      else values[name] = value;
    }
    setErrors(next);
    return Object.keys(next).length > 0 ? null : values;
  };

  if (target.kind === 'node') {
    const id = target.id ?? nextId('N', project.nodes.map((item) => item.id));
    const submit = () => {
      const values = readNumbers(['x', 'y', 'z']);
      if (!values) return;
      const payload: Space3DNode = { id, x: values.x, y: values.y, z: values.z, restraints };
      const ok = target.id
        ? onSubmit({ kind: 'update-node', nodeId: id, changes: { x: values.x, y: values.y, z: values.z, restraints } })
        : onSubmit({ kind: 'add-node', node: payload });
      if (ok) onCancel();
    };

    return <form className="space3d-editor" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <header className="space3d-editor-head">
        <h3>{t('space3d.node')} <code>{id}</code></h3>
      </header>
      <div className="space3d-field-grid">
        {field('x', t('space3d.fieldX'), t('space3d.unitLength'))}
        {field('y', t('space3d.fieldY'), t('space3d.unitLength'))}
        {field('z', t('space3d.fieldZ'), t('space3d.unitLength'))}
      </div>

      <fieldset className="space3d-fieldset">
        <legend>{t('space3d.restraints')}</legend>
        <div className="space3d-dof-grid">
          {DOF_KEYS.map((dof) => <label key={dof} className="space3d-check">
            <input
              type="checkbox"
              checked={restraints[dof]}
              onChange={(event) => setRestraints((current) => ({ ...current, [dof]: event.target.checked }))}
            />
            <span>{dof}</span>
          </label>)}
        </div>
        <div className="space3d-inline-actions">
          <button type="button" className="space3d-button space3d-button--ghost" onClick={() => setRestraints(fixedSpace3DRestraints())}>{t('space3d.fixAll')}</button>
          <button type="button" className="space3d-button space3d-button--ghost" onClick={() => setRestraints(freeSpace3DRestraints())}>{t('space3d.freeAll')}</button>
        </div>
      </fieldset>

      <footer className="space3d-editor-actions">
        <button type="submit" className="space3d-button space3d-button--primary"><Check size={16} aria-hidden="true" />{t('space3d.saveNode')}</button>
        <button type="button" className="space3d-button" onClick={onCancel}><X size={16} aria-hidden="true" />{t('space3d.cancelEdit')}</button>
        {target.id && onDelete
          ? <button type="button" className="space3d-button space3d-button--danger" onClick={() => onDelete(target)}>{t('space3d.deleteEntity')}</button>
          : null}
      </footer>
    </form>;
  }

  if (target.kind === 'member') {
    const id = target.id ?? nextId('M', project.members.map((item) => item.id));
    const submit = () => {
      const values = readNumbers([...PROPERTY_KEYS, 'refX', 'refY', 'refZ', 'roll'], [...PROPERTY_KEYS]);
      if (!values) return;
      const orientation = {
        localYReferenceGlobal: [values.refX, values.refY, values.refZ] as const,
        rollRadians: values.roll,
      };
      const changes = {
        i: endI, j: endJ,
        E: values.E, G: values.G, A: values.A, Iy: values.Iy, Iz: values.Iz, J: values.J,
        orientation,
      };
      const ok = target.id
        ? onSubmit({ kind: 'update-member', memberId: id, changes })
        : onSubmit({ kind: 'add-member', member: { id, ...changes } });
      if (ok) onCancel();
    };

    return <form className="space3d-editor" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <header className="space3d-editor-head">
        <h3>{t('space3d.member')} <code>{id}</code></h3>
      </header>
      <div className="space3d-field-grid">
        <label className="space3d-field">
          <span className="space3d-field-label">{t('space3d.endI')}</span>
          <select value={endI} onChange={(event) => setEndI(event.target.value)}>
            {project.nodes.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
          </select>
        </label>
        <label className="space3d-field">
          <span className="space3d-field-label">{t('space3d.endJ')}</span>
          <select value={endJ} onChange={(event) => setEndJ(event.target.value)}>
            {project.nodes.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
          </select>
        </label>
      </div>

      <div className="space3d-field-grid">
        {field('E', t('space3d.propertyE'), t('space3d.unitStress'), true)}
        {field('G', t('space3d.propertyG'), t('space3d.unitStress'), true)}
        {field('A', t('space3d.propertyA'), t('space3d.unitArea'), true)}
        {field('Iy', t('space3d.propertyIy'), t('space3d.unitInertia'), true)}
        {field('Iz', t('space3d.propertyIz'), t('space3d.unitInertia'), true)}
        {field('J', t('space3d.propertyJ'), t('space3d.unitInertia'), true)}
      </div>

      <fieldset className="space3d-fieldset">
        <legend>{t('space3d.orientationReference')}</legend>
        <div className="space3d-field-grid">
          {field('refX', t('space3d.fieldX'))}
          {field('refY', t('space3d.fieldY'))}
          {field('refZ', t('space3d.fieldZ'))}
          {field('roll', t('space3d.roll'), t('space3d.unitAngle'))}
        </div>
      </fieldset>

      <footer className="space3d-editor-actions">
        <button type="submit" className="space3d-button space3d-button--primary"><Check size={16} aria-hidden="true" />{t('space3d.saveMember')}</button>
        <button type="button" className="space3d-button" onClick={onCancel}><X size={16} aria-hidden="true" />{t('space3d.cancelEdit')}</button>
        {target.id && onDelete
          ? <button type="button" className="space3d-button space3d-button--danger" onClick={() => onDelete(target)}>{t('space3d.deleteEntity')}</button>
          : null}
      </footer>
    </form>;
  }

  const id = target.id ?? nextId('L', project.nodalLoads.map((item) => item.id));
  const submit = () => {
    const values = readNumbers([...LOAD_KEYS]);
    if (!values) return;
    const changes = {
      nodeId: loadNodeId, caseId: loadCaseId,
      fx: values.fx, fy: values.fy, fz: values.fz, mx: values.mx, my: values.my, mz: values.mz,
    };
    const ok = target.id
      ? onSubmit({ kind: 'update-nodal-load', loadId: id, changes })
      : onSubmit({ kind: 'add-nodal-load', load: { id, ...changes } });
    if (ok) onCancel();
  };

  return <form className="space3d-editor" onSubmit={(event) => { event.preventDefault(); submit(); }}>
    <header className="space3d-editor-head">
      <h3>{t('space3d.load')} <code>{id}</code></h3>
    </header>
    <div className="space3d-field-grid">
      <label className="space3d-field">
        <span className="space3d-field-label">{t('space3d.node')}</span>
        <select value={loadNodeId} onChange={(event) => setLoadNodeId(event.target.value)}>
          {project.nodes.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
        </select>
      </label>
      <label className="space3d-field">
        <span className="space3d-field-label">{t('space3d.loadCase')}</span>
        <select value={loadCaseId} onChange={(event) => setLoadCaseId(event.target.value)}>
          {project.loadCases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
    </div>
    <div className="space3d-field-grid">
      {field('fx', t('space3d.fieldFx'), t('space3d.unitForce'))}
      {field('fy', t('space3d.fieldFy'), t('space3d.unitForce'))}
      {field('fz', t('space3d.fieldFz'), t('space3d.unitForce'))}
      {field('mx', t('space3d.fieldMx'), t('space3d.unitMoment'))}
      {field('my', t('space3d.fieldMy'), t('space3d.unitMoment'))}
      {field('mz', t('space3d.fieldMz'), t('space3d.unitMoment'))}
    </div>
    <footer className="space3d-editor-actions">
      <button type="submit" className="space3d-button space3d-button--primary"><Check size={16} aria-hidden="true" />{t('space3d.saveLoad')}</button>
      <button type="button" className="space3d-button" onClick={onCancel}><X size={16} aria-hidden="true" />{t('space3d.cancelEdit')}</button>
      {target.id && onDelete
        ? <button type="button" className="space3d-button space3d-button--danger" onClick={() => onDelete(target)}>{t('space3d.deleteEntity')}</button>
        : null}
    </footer>
  </form>;
};
