import { useMemo, useState } from 'react';
import { Copy, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import {
  calculateParametricSection,
  createPersonalSection,
  deletePersonalSection,
  duplicatePersonalSection,
  encodePersonalSections,
  importPersonalSections,
  readPersonalSections,
  uniquePersonalSectionName,
  updatePersonalSection,
  writePersonalSections,
  type ParametricSectionDefinition,
  type ParametricSectionProperties,
  type PersonalParametricSection,
} from '../../data/personalSections';
import { fromDisplay, toDisplay, unitLabel } from '../../engine/units';
import type { UnitSystemId } from '../../types';

type Language = 'es' | 'en';

const COPY = {
  es: {
    eyebrow: 'Secciones personales', title: 'Section Builder', body: 'Diseña geometría paramétrica reproducible. El catálogo integrado no cambia y una sección personal no se aplica al proyecto hasta que tú la confirmes en un flujo compatible.',
    new: 'Nueva sección', name: 'Nombre de la sección', family: 'Familia geométrica', rectangle: 'Rectangular sólida', circle: 'Circular sólida', i: 'I simétrica', box: 'Caja rectangular',
    width: 'Ancho b', depth: 'Peralte h', diameter: 'Diámetro d', web: 'Espesor del alma tw', flange: 'Espesor del patín tf', thickness: 'Espesor t',
    save: 'Guardar sección', saveChanges: 'Guardar cambios', cancel: 'Cancelar', edit: 'Editar', duplicate: 'Duplicar', delete: 'Borrar', revision: 'Revisión', formulas: 'Fórmulas',
    empty: 'Todavía no hay secciones personales.', emptyBody: 'Crea una sin modificar el catálogo ni el proyecto abierto.',
    export: 'Exportar secciones', import: 'Importar secciones', importedOne: 'Se importó 1 sección.', importedMany: 'Se importaron {count} secciones.',
    saved: 'Sección personal guardada.', revised: 'Revisión guardada con la misma identidad.', duplicated: 'Sección duplicada con una identidad nueva.', deleted: 'Sección personal borrada. Ningún proyecto cambió.',
    storageError: 'No se pudo guardar en este dispositivo. Ningún proyecto cambió.', exportEmpty: 'Crea al menos una sección antes de exportar.', preview: 'Vista previa de la sección paramétrica', properties: 'Propiedades calculadas', personal: 'Personal · no catálogo',
  },
  en: {
    eyebrow: 'Personal sections', title: 'Section Builder', body: 'Design reproducible parametric geometry. The built-in catalog stays unchanged and a personal section is not applied to the project until you confirm it through a compatible flow.',
    new: 'New section', name: 'Section name', family: 'Geometric family', rectangle: 'Solid rectangle', circle: 'Solid circle', i: 'Symmetric I', box: 'Rectangular box',
    width: 'Width b', depth: 'Depth h', diameter: 'Diameter d', web: 'Web thickness tw', flange: 'Flange thickness tf', thickness: 'Thickness t',
    save: 'Save section', saveChanges: 'Save changes', cancel: 'Cancel', edit: 'Edit', duplicate: 'Duplicate', delete: 'Delete', revision: 'Revision', formulas: 'Formulas',
    empty: 'There are no personal sections yet.', emptyBody: 'Create one without changing the catalog or the open project.',
    export: 'Export sections', import: 'Import sections', importedOne: 'Imported 1 section.', importedMany: 'Imported {count} sections.',
    saved: 'Personal section saved.', revised: 'Revision saved with the same identity.', duplicated: 'Section duplicated with a new identity.', deleted: 'Personal section deleted. No project changed.',
    storageError: 'Could not save on this device. No project changed.', exportEmpty: 'Create at least one section before exporting.', preview: 'Parametric section preview', properties: 'Calculated properties', personal: 'Personal · not catalog',
  },
} as const;

const defaultDefinition = (family: ParametricSectionDefinition['family']): ParametricSectionDefinition => {
  if (family === 'circle') return { family, diameter: 0.2 };
  if (family === 'symmetric-i') return { family, width: 0.2, depth: 0.5, webThickness: 0.01, flangeThickness: 0.02 };
  if (family === 'rectangular-box') return { family, width: 0.3, depth: 0.4, thickness: 0.02 };
  return { family, width: 0.3, depth: 0.5 };
};

const sectionDimensions = (definition: ParametricSectionDefinition) => definition.family === 'circle'
  ? { width: definition.diameter, depth: definition.diameter }
  : { width: definition.width, depth: definition.depth };

const SectionPreview = ({ definition, label }: { definition: ParametricSectionDefinition; label: string }) => {
  if (Object.values(definition).some((value) => typeof value === 'number' && !Number.isFinite(value))) {
    return <svg data-testid="section-builder-preview" data-family={definition.family} viewBox="0 0 180 140" role="img" aria-label={label}><text x="90" y="74" textAnchor="middle">—</text></svg>;
  }
  const dimensions = sectionDimensions(definition);
  const scale = 112 / Math.max(dimensions.width, dimensions.depth, 0.001);
  const width = Math.max(4, dimensions.width * scale);
  const depth = Math.max(4, dimensions.depth * scale);
  const left = 90 - width / 2;
  const top = 70 - depth / 2;
  if (definition.family === 'circle') return <svg data-testid="section-builder-preview" data-family={definition.family} viewBox="0 0 180 140" role="img" aria-label={label}><circle cx="90" cy="70" r={width / 2} /></svg>;
  if (definition.family === 'symmetric-i') {
    const web = Math.max(3, definition.webThickness * scale);
    const flange = Math.max(3, definition.flangeThickness * scale);
    return <svg data-testid="section-builder-preview" data-family={definition.family} viewBox="0 0 180 140" role="img" aria-label={label}><path d={`M ${left} ${top} H ${left + width} V ${top + flange} H ${90 + web / 2} V ${top + depth - flange} H ${left + width} V ${top + depth} H ${left} V ${top + depth - flange} H ${90 - web / 2} V ${top + flange} H ${left} Z`} /></svg>;
  }
  if (definition.family === 'rectangular-box') {
    const thickness = Math.max(3, definition.thickness * scale);
    return <svg data-testid="section-builder-preview" data-family={definition.family} viewBox="0 0 180 140" role="img" aria-label={label}><path fillRule="evenodd" d={`M ${left} ${top} H ${left + width} V ${top + depth} H ${left} Z M ${left + thickness} ${top + thickness} V ${top + depth - thickness} H ${left + width - thickness} V ${top + thickness} Z`} /></svg>;
  }
  return <svg data-testid="section-builder-preview" data-family={definition.family} viewBox="0 0 180 140" role="img" aria-label={label}><rect x={left} y={top} width={width} height={depth} rx="2" /></svg>;
};

const defaultDownload = (serialized: string, filename: string) => {
  const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const format = (value: number, language: Language, maximumFractionDigits = 6) => new Intl.NumberFormat(language === 'es' ? 'es-MX' : 'en-US', {
  maximumFractionDigits,
}).format(value);

export const SectionBuilder = ({
  language,
  units,
  storage = localStorage,
  readFile = (file) => file.text(),
  onDownload = defaultDownload,
}: {
  language: Language;
  units: UnitSystemId;
  storage?: Storage;
  readFile?: (file: File) => Promise<string>;
  onDownload?: (serialized: string, filename: string) => void;
}) => {
  const copy = COPY[language];
  const [sections, setSections] = useState<PersonalParametricSection[]>(() => readPersonalSections(storage));
  const [editingId, setEditingId] = useState<string>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [name, setName] = useState('');
  const [definition, setDefinition] = useState<ParametricSectionDefinition>(() => defaultDefinition('rectangle'));
  const [feedback, setFeedback] = useState<{ role: 'status' | 'alert'; text: string }>();
  const lengthUnit = unitLabel(units, 'length');
  const properties = useMemo<{ value: ParametricSectionProperties; error?: never } | { value?: never; error: string }>(() => {
    try { return { value: calculateParametricSection(definition) }; }
    catch (error) { return { error: error instanceof Error ? error.message : 'Invalid geometry' }; }
  }, [definition]);

  const persist = (next: PersonalParametricSection[]) => {
    const written = writePersonalSections(storage, next);
    if (!written.ok) {
      setFeedback({ role: 'alert', text: copy.storageError });
      return false;
    }
    setSections(next);
    return true;
  };
  const startNew = () => {
    setEditingId(undefined);
    setName('');
    setDefinition(defaultDefinition('rectangle'));
    setFeedback(undefined);
    setEditorOpen(true);
  };
  const startEdit = (section: PersonalParametricSection) => {
    setEditingId(section.id);
    setName(section.name);
    setDefinition(structuredClone(section.definition));
    setFeedback(undefined);
    setEditorOpen(true);
  };
  const cancel = () => {
    setEditorOpen(false);
    setEditingId(undefined);
    setFeedback(undefined);
  };
  const changeFamily = (family: ParametricSectionDefinition['family']) => setDefinition(defaultDefinition(family));
  const patchDimension = (key: string, displayValue: number) => setDefinition((current) => ({
    ...current,
    [key]: Number.isFinite(displayValue) ? fromDisplay(displayValue, units, 'length') : Number.NaN,
  } as ParametricSectionDefinition));
  const save = () => {
    try {
      if ('error' in properties) throw new Error(properties.error);
      const next = editingId
        ? updatePersonalSection(sections, editingId, { name, definition })
        : createPersonalSection(sections, { name, definition });
      if (!persist(next)) return;
      setFeedback({ role: 'status', text: editingId ? copy.revised : copy.saved });
      setEditorOpen(false);
      setEditingId(undefined);
    } catch (error) {
      setFeedback({ role: 'alert', text: error instanceof Error ? error.message : copy.storageError });
    }
  };
  const duplicate = (section: PersonalParametricSection) => {
    try {
      const suffix = language === 'es' ? '— Copia' : '— Copy';
      const next = duplicatePersonalSection(sections, section.id, uniquePersonalSectionName(sections, `${section.name} ${suffix}`));
      if (persist(next)) setFeedback({ role: 'status', text: copy.duplicated });
    } catch (error) {
      setFeedback({ role: 'alert', text: error instanceof Error ? error.message : copy.storageError });
    }
  };
  const remove = (section: PersonalParametricSection) => {
    if (persist(deletePersonalSection(sections, section.id))) setFeedback({ role: 'status', text: copy.deleted });
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const next = importPersonalSections(sections, await readFile(file));
      const count = next.length - sections.length;
      if (persist(next)) setFeedback({ role: 'status', text: count === 1 ? copy.importedOne : copy.importedMany.replace('{count}', String(count)) });
    } catch (error) {
      setFeedback({ role: 'alert', text: error instanceof Error ? error.message : copy.storageError });
    }
  };
  const exportSections = () => {
    if (!sections.length) {
      setFeedback({ role: 'alert', text: copy.exportEmpty });
      return;
    }
    onDownload(encodePersonalSections(sections), 'structureco-secciones-personales.json');
  };

  const dimensionField = (key: string, label: string) => {
    const raw = (definition as unknown as Record<string, number>)[key];
    const value = Number.isFinite(raw) ? toDisplay(raw, units, 'length') : '';
    const fullLabel = `${label} (${lengthUnit})`;
    return <label key={key}><span>{fullLabel}</span><input aria-label={fullLabel} type="number" min="0" step="any" value={value} onChange={(event) => patchDimension(key, event.currentTarget.valueAsNumber)} /></label>;
  };

  const fields = definition.family === 'circle'
    ? [dimensionField('diameter', copy.diameter)]
    : definition.family === 'symmetric-i'
      ? [dimensionField('width', copy.width), dimensionField('depth', copy.depth), dimensionField('webThickness', copy.web), dimensionField('flangeThickness', copy.flange)]
      : definition.family === 'rectangular-box'
        ? [dimensionField('width', copy.width), dimensionField('depth', copy.depth), dimensionField('thickness', copy.thickness)]
        : [dimensionField('width', copy.width), dimensionField('depth', copy.depth)];

  return <section className="section-builder" aria-labelledby="section-builder-title">
    <header className="section-builder__header">
      <div><p>{copy.eyebrow}</p><h3 id="section-builder-title">{copy.title}</h3><span>{copy.body}</span></div>
      <div className="section-builder__header-actions">
        <label className="section-builder__import"><Upload size={16} aria-hidden="true" /><span>{copy.import}</span><input type="file" accept="application/json,.json" aria-label={copy.import} onChange={(event) => void importFile(event.currentTarget.files?.[0])} /></label>
        <button type="button" onClick={exportSections}><Download size={16} aria-hidden="true" /><span>{copy.export}</span></button>
        <button type="button" className="section-builder__new" onClick={startNew}><Plus size={16} aria-hidden="true" /><span>{copy.new}</span></button>
      </div>
    </header>

    {editorOpen ? <div className="section-builder__editor">
      <div className="section-builder__fields">
        <label><span>{copy.name}</span><input aria-label={copy.name} value={name} onChange={(event) => setName(event.currentTarget.value)} /></label>
        <label><span>{copy.family}</span><select aria-label={copy.family} value={definition.family} onChange={(event) => changeFamily(event.currentTarget.value as ParametricSectionDefinition['family'])}>
          <option value="rectangle">{copy.rectangle}</option><option value="circle">{copy.circle}</option><option value="symmetric-i">{copy.i}</option><option value="rectangular-box">{copy.box}</option>
        </select></label>
        {fields}
      </div>
      <div className="section-builder__preview">
        <SectionPreview definition={definition} label={copy.preview} />
        <strong>{copy.personal}</strong>
        <small>{copy.formulas}: {editingId ? sections.find((section) => section.id === editingId)?.formulaVersion : 'section-properties-v1'}</small>
      </div>
      <div className="section-builder__properties" aria-label={copy.properties}>
        {properties.value !== undefined ? <>
          <div><span>A</span><strong>{format(toDisplay(properties.value.area, units, 'area'), language)} {unitLabel(units, 'area')}</strong></div>
          <div><span>Ix</span><strong>{format(toDisplay(properties.value.inertiaX, units, 'inertia'), language)} {unitLabel(units, 'inertia')}</strong></div>
          <div><span>Iy</span><strong>{format(toDisplay(properties.value.inertiaY, units, 'inertia'), language)} {unitLabel(units, 'inertia')}</strong></div>
          <div><span>Wx</span><strong>{format(toDisplay(properties.value.sectionModulusX, units, 'sectionModulus'), language)} {unitLabel(units, 'sectionModulus')}</strong></div>
          <div><span>Wy</span><strong>{format(toDisplay(properties.value.sectionModulusY, units, 'sectionModulus'), language)} {unitLabel(units, 'sectionModulus')}</strong></div>
          <div><span>rx / ry</span><strong>{format(toDisplay(properties.value.radiusX, units, 'length'), language)} / {format(toDisplay(properties.value.radiusY, units, 'length'), language)} {lengthUnit}</strong></div>
        </> : <p>{properties.error}</p>}
      </div>
      <div className="section-builder__editor-actions"><button type="button" className="section-builder__save" onClick={save}>{editingId ? copy.saveChanges : copy.save}</button><button type="button" onClick={cancel}>{copy.cancel}</button></div>
    </div> : null}

    {feedback ? <p className="section-builder__feedback" role={feedback.role}>{feedback.text}</p> : null}
    {sections.length ? <ul className="section-builder__list">{sections.map((section) => <li key={section.id} aria-label={`${section.name}, ${copy.revision} ${section.revision}`}>
      <SectionPreview definition={section.definition} label={`${copy.preview}: ${section.name}`} />
      <div><strong>{section.name}</strong><span>{copy.personal}</span><small>{section.definition.family} · {copy.revision} {section.revision} · {section.formulaVersion}</small></div>
      <div className="section-builder__item-actions">
        <button type="button" aria-label={`${copy.edit} ${section.name}`} onClick={() => startEdit(section)}><Pencil size={15} aria-hidden="true" /><span>{copy.edit}</span></button>
        <button type="button" aria-label={`${copy.duplicate} ${section.name}`} onClick={() => duplicate(section)}><Copy size={15} aria-hidden="true" /><span>{copy.duplicate}</span></button>
        <button type="button" aria-label={`${copy.delete} ${section.name}`} onClick={() => remove(section)}><Trash2 size={15} aria-hidden="true" /><span>{copy.delete}</span></button>
      </div>
    </li>)}</ul> : <div className="section-builder__empty"><strong>{copy.empty}</strong><span>{copy.emptyBody}</span></div>}
  </section>;
};
