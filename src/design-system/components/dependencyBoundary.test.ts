/// <reference types="node" />

import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Descubre dinamicamente todos los ficheros fuente de componentes (*.tsx, *.ts) excluyendo tests y specs.
// Esto asegura que componentes nuevos como Surface queden cubiertos automaticamente por el chequeo de frontera.
const componentFiles = readdirSync(new URL('.', import.meta.url))
  .filter((file) => /\.tsx?$/.test(file) && !/\.(test|spec)\.tsx?$/.test(file))
  .sort();

const componentSources = componentFiles.map((file) => ({
  path: `./${file}`,
  source: readFileSync(new URL(file, import.meta.url), 'utf8'),
}));

const uiCss = readFileSync(new URL('./ui.css', import.meta.url), 'utf8');

describe('Phase 5 component-library boundary', () => {
  it('does not import solver, store, persistence, or domain types', () => {
    for (const { path, source } of componentSources) {
      expect(source, path).not.toMatch(/from\s+['"](?:\.\.\/)+(?:engine|workers|store|data|types)(?:\/|['"])/);
    }
  });

  it('keeps component styles on semantic tokens instead of primitive palette values', () => {
    expect(uiCss).not.toMatch(/var\(--sc-(?:white|black|green-\d+|blue-\d+|violet-\d+|orange-\d+|red-\d+|amber-\d+)\)/);
  });

  it('implements the complete Phase 5 inventory as isolated exports', () => {
    const source = componentSources.map((entry) => entry.source).join('\n');
    const inventory = [
      'Button', 'IconButton', 'Field', 'Select', 'SegmentedControl', 'Tooltip', 'Popover', 'Dialog', 'Drawer',
      'Tabs', 'Accordion', 'Badge', 'Banner', 'EmptyState', 'Spinner', 'Divider', 'ToolButton', 'ToolGroup',
      'StatusStrip', 'PanelHeader', 'PropertyRow', 'UnitField', 'ResultMetric', 'LayerToggle', 'NumericValue',
    ];
    for (const component of inventory) expect(source, component).toMatch(new RegExp(`export (?:const|function) ${component}\\b`));
  });
});
