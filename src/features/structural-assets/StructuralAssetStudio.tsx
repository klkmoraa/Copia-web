import { useMemo, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { STRUCTURAL_ASSET_REGISTRY } from './registry';
import { ThreeStructuralImage } from './ThreeStructuralImage';
import { isThreeStructuralAssetId } from './threeStructuralRender';
import type { StructuralAssetFamily } from './types';
import './structuralAssetStudio.css';

const FAMILY_LABELS: Record<StructuralAssetFamily, string> = {
  portal: 'Pórticos',
  beam: 'Vigas',
  cantilever: 'Voladizos',
  truss: 'Armaduras',
  slab: 'Losas',
  'space-frame': 'Estructuras espaciales',
  support: 'Apoyos',
  load: 'Cargas',
  section: 'Secciones',
  connection: 'Conexiones',
};

const families = Object.keys(FAMILY_LABELS) as StructuralAssetFamily[];

export function StructuralAssetStudio() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const groups = useMemo(() => families.map((family) => ({
    family,
    assets: STRUCTURAL_ASSET_REGISTRY.filter((asset) => asset.family === family).map((asset) => {
      if (!isThreeStructuralAssetId(asset.id)) throw new Error(`Atlas asset is missing its Three.js scene: ${asset.id}`);
      return { asset, assetId: asset.id };
    }),
  })), []);

  return <main className="asset-studio" data-theme={theme} data-testid="structural-asset-studio">
    <header className="asset-studio__header">
      <div>
        <p>StructureCo · biblioteca estructural 3D</p>
        <h1>Atlas estructural</h1>
        <span>40 escenas Three.js editables, transparentes y preparadas para Día y Noche.</span>
      </div>
      <button type="button" onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Ver modo Noche' : 'Ver modo Día'}>
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        <span>{theme === 'light' ? 'Noche' : 'Día'}</span>
      </button>
    </header>

    <div className="asset-studio__body">
      {groups.map(({ family, assets }) => <section key={family} className="asset-studio__family" data-asset-family={family} aria-labelledby={`asset-family-${family}`}>
        <header><h2 id={`asset-family-${family}`}>{FAMILY_LABELS[family]}</h2><span>{assets.length} variantes</span></header>
        <div className="asset-studio__grid">
          {assets.map(({ asset, assetId }) => <article key={asset.id} className="asset-studio__card" data-asset-card={asset.id}>
            <div className="asset-studio__canvas"><ThreeStructuralImage assetId={assetId} theme={theme} alt={asset.label} /></div>
            <div className="asset-studio__meta"><strong>{asset.label}</strong><code>{asset.id}</code><span>{asset.material}</span></div>
          </article>)}
        </div>
      </section>)}
    </div>
  </main>;
}
