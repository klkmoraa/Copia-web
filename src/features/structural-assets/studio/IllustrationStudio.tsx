import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Copy, Download, RotateCcw, Trash2, X } from 'lucide-react';
import { STRUCTURAL_ASSET_REGISTRY } from '../registry';
import { StructuralIllustration } from '../StructuralIllustration';
import type { StructuralAssetFamily } from '../types';
import { useModalFocus } from '../../../design-system/components/modalFocus';
import { formatFixed } from '../../../utils/numberFormat';
import {
  FACTORY_STUDIO_PRESETS,
  createPersonalPreset,
  deletePersonalPreset,
  duplicatePersonalPreset,
  readPersonalPresetLibrary,
  renamePersonalPreset,
  restorePersonalPreset,
  updatePersonalPreset,
  writePersonalPresetLibrary,
  type PersonalStudioPreset,
  type StudioParameters,
  type StudioPreviewTheme,
} from './presetRepository';
import { buildStudioScene, disposeStudioScene, renderStudioPng, serializeStudioSvg, type StudioExportScale } from './studioScene';
import './illustrationStudio.css';

type StudioSection = 'proportions' | 'material' | 'camera' | 'detail' | 'view';
type StudioLanguage = 'es' | 'en';

const families = [...new Set(STRUCTURAL_ASSET_REGISTRY.map((asset) => asset.family))];
const copy = {
  es: { eyebrow: 'Estructuras / Ilustraciones', title: 'Estudio de ilustraciones', close: 'Cerrar estudio', families: 'Familias estructurales', assets: 'Activos estructurales', proportions: 'Proporciones', material: 'Material', camera: 'Cámara', detail: 'Detalle', view: 'Vista', widthScale: 'Ancho', heightScale: 'Altura', depthScale: 'Profundidad', day: 'Día', night: 'Noche', exportScale: 'Escala de exportación', png: 'Exportar PNG', svg: 'Exportar SVG', factory: 'Diseño original', concrete: 'Concreto', steel: 'Acero', timber: 'Madera', technical: 'Técnico', isometric: 'Isométrica', front: 'Frente', side: 'Lateral', top: 'Superior', hero: 'Grande', card: 'Tarjeta', compact: 'Compacto', personal: 'Diseño guardado', savedDesigns: 'Diseños guardados', designName: 'Nombre del diseño', preview: 'Vista previa estructural Three.js', duplicate: 'Duplicar', restore: 'Restaurar', delete: 'Borrar', nameRequired: 'Escribe un nombre para el diseño.', duplicateName: 'Ya existe un diseño con ese nombre.', storageError: 'No se pudo guardar en este dispositivo. Libera espacio o revisa los permisos del navegador.', exportError: 'No se pudo exportar la ilustración. Intenta de nuevo.' },
  en: { eyebrow: 'Structures / Illustrations', title: 'Illustration Studio', close: 'Close studio', families: 'Structural families', assets: 'Structural assets', proportions: 'Proportions', material: 'Material', camera: 'Camera', detail: 'Detail', view: 'View', widthScale: 'Width', heightScale: 'Height', depthScale: 'Depth', day: 'Day', night: 'Night', exportScale: 'Export scale', png: 'Export PNG', svg: 'Export SVG', factory: 'Original design', concrete: 'Concrete', steel: 'Steel', timber: 'Timber', technical: 'Technical', isometric: 'Isometric', front: 'Front', side: 'Side', top: 'Top', hero: 'Large', card: 'Card', compact: 'Compact', personal: 'Saved design', savedDesigns: 'Saved designs', designName: 'Design name', preview: 'Three.js structural preview', duplicate: 'Duplicate', restore: 'Restore', delete: 'Delete', nameRequired: 'Enter a name for the design.', duplicateName: 'A design with that name already exists.', storageError: 'This design could not be saved on this device. Free space or review browser permissions.', exportError: 'The illustration could not be exported. Try again.' },
} as const;

const familyLabels: Record<StructuralAssetFamily, string> = { portal: 'Pórticos', beam: 'Vigas', cantilever: 'Voladizos', truss: 'Armaduras', slab: 'Losas', 'space-frame': 'Marcos 3D', support: 'Apoyos', load: 'Cargas', section: 'Secciones', connection: 'Conexiones' };
const englishFamilyLabels: Record<StructuralAssetFamily, string> = { portal: 'Portal frames', beam: 'Beams', cantilever: 'Cantilevers', truss: 'Trusses', slab: 'Slabs', 'space-frame': 'Space frames', support: 'Supports', load: 'Loads', section: 'Sections', connection: 'Connections' };
const spanishAssetLabels: Record<string, string> = {
  'portal:single-bay': 'Pórtico de un vano', 'portal:two-bay': 'Pórtico de dos vanos', 'portal:two-story': 'Pórtico de dos niveles', 'portal:industrial-pitched': 'Pórtico industrial a dos aguas',
  'beam:simply-supported': 'Viga simplemente apoyada', 'beam:two-span': 'Viga continua de dos claros', 'beam:three-span': 'Viga continua de tres claros', 'beam:overhang': 'Viga con voladizo',
  'cantilever:wall': 'Muro en voladizo', 'cantilever:double': 'Voladizo doble', 'cantilever:stepped': 'Voladizo escalonado', 'cantilever:balcony': 'Balcón en voladizo',
  'truss:pratt': 'Armadura Pratt', 'truss:howe': 'Armadura Howe', 'truss:warren': 'Armadura Warren', 'truss:king-post': 'Armadura de pendolón',
  'slab:one-way': 'Losa unidireccional', 'slab:two-way': 'Losa bidireccional', 'slab:waffle': 'Losa reticular', 'slab:flat-slab': 'Losa plana',
  'space-frame:single-module': 'Módulo espacial', 'space-frame:multi-bay': 'Marco espacial de varios vanos', 'space-frame:two-story': 'Marco espacial de dos niveles', 'space-frame:industrial-shed': 'Nave industrial espacial',
  'support:pin': 'Apoyo articulado', 'support:roller': 'Apoyo de rodillo', 'support:fixed': 'Apoyo empotrado', 'support:spring': 'Apoyo con resorte',
  'load:point': 'Carga puntual', 'load:distributed': 'Carga distribuida', 'load:varying': 'Carga distribuida variable', 'load:applied-moment': 'Momento aplicado',
  'section:rectangular': 'Sección rectangular', 'section:circular': 'Sección circular', 'section:i-profile': 'Perfil I', 'section:box': 'Sección cajón',
  'connection:rigid': 'Conexión rígida', 'connection:pinned': 'Conexión articulada', 'connection:base-plate': 'Conexión con placa base', 'connection:splice': 'Empalme de miembros',
};

const uniqueName = (library: readonly PersonalStudioPreset[], base: string) => {
  let candidate = base;
  let index = 2;
  while (library.some((preset) => preset.name.toLocaleLowerCase() === candidate.toLocaleLowerCase())) candidate = `${base} ${index++}`;
  return candidate;
};

function StudioPreview({ parameters, label }: { parameters: StudioParameters; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    if (navigator.userAgent.includes('jsdom')) { setFallback(true); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer | undefined;
    let bundle: ReturnType<typeof buildStudioScene> | undefined;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      const width = Math.max(1, canvas.clientWidth || 900);
      const height = Math.max(1, Math.round(width / 1.5));
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      bundle = buildStudioScene(parameters);
      renderer.render(bundle.scene, bundle.camera);
      canvas.dataset.threeReady = 'true';
      setFallback(false);
    } catch {
      setFallback(true);
    }
    return () => {
      delete canvas.dataset.threeReady;
      if (bundle) disposeStudioScene(bundle);
      renderer?.dispose();
    };
  }, [parameters]);
  return <div className="illustration-studio__preview-shell" data-preview-theme={parameters.previewTheme} data-testid="studio-preview-shell">
    <canvas ref={canvasRef} role="img" aria-label={label} data-projection-aspect="1.5" data-structural-render="three-live" data-testid="studio-three-preview" />
    {fallback ? <StructuralIllustration className="illustration-studio__fallback" assetId={parameters.assetId} detail={parameters.detail} motion="none" /> : null}
  </div>;
}

const download = (href: string, filename: string) => {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
};

export function IllustrationStudio({ language = 'es', initialTheme = 'light', onClose }: { language?: StudioLanguage; initialTheme?: StudioPreviewTheme; onClose: () => void }) {
  const t = copy[language];
  const assetLabel = (assetId: string) => language === 'es' ? spanishAssetLabels[assetId] : STRUCTURAL_ASSET_REGISTRY.find((asset) => asset.id === assetId)?.label;
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [library, setLibrary] = useState<PersonalStudioPreset[]>(() => readPersonalPresetLibrary(localStorage));
  const [selectedPersonalId, setSelectedPersonalId] = useState<string>();
  const [parameters, setParameters] = useState<StudioParameters>(() => ({ ...FACTORY_STUDIO_PRESETS[0].parameters, previewTheme: initialTheme }));
  const [section, setSection] = useState<StudioSection>('proportions');
  const [scale, setScale] = useState<StudioExportScale>(1);
  const [renameDraft, setRenameDraft] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'status'; message: string }>();
  const activeFamily = STRUCTURAL_ASSET_REGISTRY.find((asset) => asset.id === parameters.assetId)?.family ?? 'portal';
  const activePersonal = library.find((preset) => preset.id === selectedPersonalId);

  useModalFocus({ open: true, containerRef: dialogRef, onEscape: onClose, initialFocus: () => closeRef.current, restoreFocus: false });
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => { setRenameDraft(activePersonal?.name ?? ''); }, [activePersonal?.id, activePersonal?.name]);

  const applyLibrary = (next: PersonalStudioPreset[]) => {
    setLibrary(next);
    const result = writePersonalPresetLibrary(localStorage, next);
    if (!result.ok) setFeedback({ kind: 'error', message: t.storageError });
    return result.ok;
  };

  const commit = (patch: Partial<StudioParameters>) => {
    setFeedback(undefined);
    if (activePersonal) {
      const next = updatePersonalPreset(library, activePersonal.id, patch);
      applyLibrary(next);
      setParameters({ ...next.find((preset) => preset.id === activePersonal.id)!.parameters });
      return;
    }
    const factory = FACTORY_STUDIO_PRESETS.find((preset) => preset.assetId === parameters.assetId) ?? FACTORY_STUDIO_PRESETS[0];
    const id = `personal:${crypto.randomUUID()}`;
    const created = createPersonalPreset(library, factory.assetId, uniqueName(library, `${assetLabel(factory.assetId)} — ${t.personal}`), id);
    const next = updatePersonalPreset(created, id, { ...patch, previewTheme: patch.previewTheme ?? parameters.previewTheme });
    applyLibrary(next);
    setSelectedPersonalId(id);
    setParameters({ ...next.find((preset) => preset.id === id)!.parameters });
  };

  const assets = useMemo(() => STRUCTURAL_ASSET_REGISTRY.filter((asset) => asset.family === activeFamily), [activeFamily]);
  const chooseFactory = (assetId: string) => {
    const factory = FACTORY_STUDIO_PRESETS.find((preset) => preset.assetId === assetId)!;
    const previewTheme = parameters.previewTheme;
    setSelectedPersonalId(undefined);
    setParameters({ ...factory.parameters, previewTheme });
    setFeedback(undefined);
  };
  const duplicate = () => {
    if (!activePersonal) return;
    const name = uniqueName(library, `${activePersonal.name} — ${t.duplicate}`);
    const id = `personal:${crypto.randomUUID()}`;
    const next = duplicatePersonalPreset(library, activePersonal.id, name, id);
    applyLibrary(next); setSelectedPersonalId(id); setParameters({ ...next.at(-1)!.parameters });
  };
  const restore = () => {
    if (!activePersonal) return;
    const previewTheme = parameters.previewTheme;
    const next = restorePersonalPreset(library, activePersonal.id).map((preset) => preset.id === activePersonal.id
      ? { ...preset, parameters: { ...preset.parameters, previewTheme } }
      : preset);
    applyLibrary(next); setParameters({ ...next.find((preset) => preset.id === activePersonal.id)!.parameters });
  };
  const remove = () => {
    if (!activePersonal) return;
    applyLibrary(deletePersonalPreset(library, activePersonal.id));
    chooseFactory(activePersonal.factoryAssetId);
  };
  const commitRename = () => {
    if (!activePersonal) return;
    try {
      const next = renamePersonalPreset(library, activePersonal.id, renameDraft);
      applyLibrary(next);
      setRenameDraft(next.find((preset) => preset.id === activePersonal.id)!.name);
      setFeedback(undefined);
    } catch {
      setFeedback({ kind: 'error', message: renameDraft.trim() ? t.duplicateName : t.nameRequired });
    }
  };
  const exportSvg = () => {
    let objectUrl: string | undefined;
    try {
      objectUrl = URL.createObjectURL(new Blob([serializeStudioSvg(parameters)], { type: 'image/svg+xml' }));
      download(objectUrl, `${parameters.assetId.replace(':', '-')}.svg`);
    } catch {
      setFeedback({ kind: 'error', message: t.exportError });
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  };
  const exportPng = async () => {
    try {
      download(await renderStudioPng(parameters, scale), `${parameters.assetId.replace(':', '-')}-${scale}x.png`);
    } catch {
      setFeedback({ kind: 'error', message: t.exportError });
    }
  };

  const tabs: Array<[StudioSection, string]> = [['proportions', t.proportions], ['material', t.material], ['camera', t.camera], ['detail', t.detail], ['view', t.view]];
  return <section ref={dialogRef} className="illustration-studio" data-studio-theme={parameters.previewTheme} role="dialog" aria-modal="true" aria-label={t.title} tabIndex={-1}>
    <header className="illustration-studio__header"><div><span>{t.eyebrow}</span><h1>{t.title}</h1></div><button ref={closeRef} type="button" aria-label={t.close} onClick={onClose}><X /></button></header>
    <div className="illustration-studio__body">
      <aside className="illustration-studio__library">
        <div className="illustration-studio__rail" aria-label={t.families}>{families.map((family) => <button type="button" key={family} aria-pressed={family === activeFamily} onClick={() => chooseFactory(STRUCTURAL_ASSET_REGISTRY.find((asset) => asset.family === family)!.id)}>{language === 'es' ? familyLabels[family] : englishFamilyLabels[family]}</button>)}</div>
        <div className="illustration-studio__rail illustration-studio__rail--assets" aria-label={t.assets}>{assets.map((asset) => <button type="button" key={asset.id} aria-pressed={asset.id === parameters.assetId} onClick={() => chooseFactory(asset.id)}>{assetLabel(asset.id)}</button>)}</div>
        <label className="illustration-studio__preset"><span>{t.savedDesigns}</span><select aria-label={t.savedDesigns} value={selectedPersonalId ?? ''} onChange={(event) => { const preset = library.find((item) => item.id === event.target.value); if (preset) { setSelectedPersonalId(preset.id); setParameters({ ...preset.parameters }); setFeedback(undefined); } else chooseFactory(parameters.assetId); }}><option value="">{t.factory}</option>{library.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label>
        {activePersonal ? <div className="illustration-studio__preset-actions"><input aria-label={t.designName} value={renameDraft} onChange={(event) => { setRenameDraft(event.target.value); setFeedback(undefined); }} onBlur={commitRename} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitRename(); } }} /><button type="button" aria-label={t.duplicate} onClick={duplicate}><Copy /></button><button type="button" aria-label={t.restore} onClick={restore}><RotateCcw /></button><button type="button" aria-label={t.delete} onClick={remove}><Trash2 /></button></div> : null}
      </aside>
      <main className="illustration-studio__workbench">
        <StudioPreview parameters={parameters} label={t.preview} />
        <div className="illustration-studio__tabs" role="tablist">{tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={section === id} onClick={() => setSection(id)}>{label}</button>)}</div>
        <div className="illustration-studio__panel" role="tabpanel">
          {section === 'proportions' ? (['widthScale', 'heightScale', 'depthScale'] as const).map((key) => <label key={key}><span>{t[key]}</span><input aria-label={t[key]} type="range" min="0.75" max="1.4" step="0.05" value={parameters[key]} onChange={(event) => commit({ [key]: Number(event.target.value) })} /><output>{formatFixed(parameters[key], 2, 'inspector')}</output></label>) : null}
          {section === 'material' ? <div className="illustration-studio__choices">{(['factory', 'concrete', 'steel', 'timber', 'technical'] as const).map((value) => <button type="button" key={value} aria-pressed={parameters.material === value} onClick={() => commit({ material: value })}>{t[value]}</button>)}</div> : null}
          {section === 'camera' ? <div className="illustration-studio__choices">{(['isometric', 'front', 'side', 'top'] as const).map((value) => <button type="button" key={value} aria-pressed={parameters.camera === value} onClick={() => commit({ camera: value })}>{t[value]}</button>)}</div> : null}
          {section === 'detail' ? <div className="illustration-studio__choices">{(['hero', 'card', 'compact'] as const).map((value) => <button type="button" key={value} aria-pressed={parameters.detail === value} onClick={() => commit({ detail: value })}>{t[value]}</button>)}</div> : null}
          {section === 'view' ? <div className="illustration-studio__choices"><button type="button" aria-pressed={parameters.previewTheme === 'light'} onClick={() => commit({ previewTheme: 'light' })}>{t.day}</button><button type="button" aria-pressed={parameters.previewTheme === 'dark'} onClick={() => commit({ previewTheme: 'dark' })}>{t.night}</button></div> : null}
        </div>
      </main>
    </div>
    {feedback ? <p className="illustration-studio__feedback" role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.message}</p> : null}
    <footer className="illustration-studio__export"><label>{t.exportScale}<select aria-label={t.exportScale} value={scale} onChange={(event) => setScale(Number(event.target.value) as StudioExportScale)}><option value="1">1× · 900×600</option><option value="2">2× · 1800×1200</option><option value="4">4× · 3600×2400</option></select></label><button type="button" onClick={() => void exportPng()}><Download />{t.png}</button><button type="button" onClick={exportSvg}><Download />{t.svg}</button></footer>
  </section>;
}

export function IllustrationStudioRoute() {
  const initialTheme = new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light';
  return <IllustrationStudio language={document.documentElement.lang === 'en' ? 'en' : 'es'} initialTheme={initialTheme} onClose={() => { window.location.href = '/'; }} />;
}
