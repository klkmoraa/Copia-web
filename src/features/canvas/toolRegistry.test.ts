import { describe, expect, it } from 'vitest';
import type { Tool } from '../../types';
import {
  TOOL_GROUPS,
  TOOL_REGISTRY,
  TOOL_SHORTCUTS,
  toolFromShortcut,
  toolsInGroup,
} from './toolRegistry';
import * as registry from './toolRegistry';

const expectedTools: Tool[] = [
  'select', 'node', 'member', 'support', 'split', 'pointLoad',
  'distributedLoad', 'moment', 'dimension', 'cut',
];

describe('tool registry', () => {
  it('does not expose an unused lookup map', () => {
    expect('TOOL_BY_ID' in registry).toBe(false);
  });

  it('contains every registered tool exactly once', () => {
    expect(TOOL_REGISTRY.map((tool) => tool.id)).toEqual(expectedTools);
    expect(new Set(TOOL_REGISTRY.map((tool) => tool.id)).size).toBe(expectedTools.length);
  });

  // `pan` y `delete` no llevan botón (el gesto y Supr ya los cubren), así que
  // no están en `TOOL_REGISTRY` — pero `pan` conserva su atajo de teclado.
  it('preserves the existing keyboard shortcuts without collisions, including the buttonless pan shortcut', () => {
    expect([...TOOL_SHORTCUTS.entries()]).toEqual([
      ['v', 'select'], ['n', 'node'], ['m', 'member'],
      ['s', 'support'], ['b', 'split'], ['p', 'pointLoad'], ['d', 'distributedLoad'],
      ['o', 'moment'], ['c', 'dimension'], ['x', 'cut'], ['h', 'pan'],
    ]);
    expect(toolFromShortcut('V')).toBe('select');
    expect(toolFromShortcut('x')).toBe('cut');
    expect(toolFromShortcut('h')).toBe('pan');
    expect(toolFromShortcut('z')).toBeUndefined();
  });

  it('groups tools by intention and assigns every tool to one group', () => {
    const grouped = TOOL_GROUPS.flatMap((group) => toolsInGroup(group.id).map((tool) => tool.id));
    expect(grouped).toEqual(expectedTools);
    expect(toolsInGroup('navigate').map((tool) => tool.id)).toEqual(['select']);
    expect(toolsInGroup('create').map((tool) => tool.id)).toEqual(['node', 'member', 'support', 'split']);
    expect(toolsInGroup('loads').map((tool) => tool.id)).toEqual(['pointLoad', 'distributedLoad', 'moment']);
    expect(toolsInGroup('measure').map((tool) => tool.id)).toEqual(['dimension', 'cut']);
  });

  it('keeps four frequent mobile destinations plus Loads and More', () => {
    expect(TOOL_REGISTRY.filter((tool) => tool.mobile === 'primary').map((tool) => tool.id)).toEqual([
      'select', 'node', 'member', 'support',
    ]);
    expect(TOOL_REGISTRY.filter((tool) => tool.mobile === 'loads').map((tool) => tool.id)).toEqual([
      'pointLoad', 'distributedLoad', 'moment',
    ]);
    expect(TOOL_REGISTRY.filter((tool) => tool.mobile === 'more').map((tool) => tool.id)).toEqual([
      'split', 'dimension', 'cut',
    ]);
  });
});
