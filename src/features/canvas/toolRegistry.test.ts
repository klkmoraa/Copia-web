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
  'select', 'pan', 'node', 'member', 'support', 'pointLoad',
  'distributedLoad', 'moment', 'dimension', 'cut', 'split', 'delete',
];

describe('tool registry', () => {
  it('does not expose an unused lookup map', () => {
    expect('TOOL_BY_ID' in registry).toBe(false);
  });

  it('contains every existing tool exactly once', () => {
    expect(TOOL_REGISTRY.map((tool) => tool.id)).toEqual(expectedTools);
    expect(new Set(TOOL_REGISTRY.map((tool) => tool.id)).size).toBe(expectedTools.length);
  });

  it('preserves the existing keyboard shortcuts without collisions', () => {
    expect([...TOOL_SHORTCUTS.entries()]).toEqual([
      ['v', 'select'], ['h', 'pan'], ['n', 'node'], ['m', 'member'],
      ['s', 'support'], ['p', 'pointLoad'], ['d', 'distributedLoad'],
      ['o', 'moment'], ['c', 'dimension'], ['x', 'cut'], ['b', 'split'],
    ]);
    expect(toolFromShortcut('V')).toBe('select');
    expect(toolFromShortcut('x')).toBe('cut');
    expect(toolFromShortcut('z')).toBeUndefined();
  });

  it('groups tools by intention and assigns every tool to one group', () => {
    const grouped = TOOL_GROUPS.flatMap((group) => toolsInGroup(group.id).map((tool) => tool.id));
    expect(grouped).toEqual(expectedTools);
    expect(toolsInGroup('navigate').map((tool) => tool.id)).toEqual(['select', 'pan']);
    expect(toolsInGroup('create').map((tool) => tool.id)).toEqual(['node', 'member', 'support']);
    expect(toolsInGroup('loads').map((tool) => tool.id)).toEqual(['pointLoad', 'distributedLoad', 'moment']);
    expect(toolsInGroup('inspect').map((tool) => tool.id)).toEqual(['dimension', 'cut']);
    expect(toolsInGroup('edit').map((tool) => tool.id)).toEqual(['split', 'delete']);
  });

  it('keeps five frequent mobile destinations plus More', () => {
    expect(TOOL_REGISTRY.filter((tool) => tool.mobile === 'primary').map((tool) => tool.id)).toEqual([
      'select', 'node', 'member', 'support',
    ]);
    expect(TOOL_REGISTRY.filter((tool) => tool.mobile === 'loads').map((tool) => tool.id)).toEqual([
      'pointLoad', 'distributedLoad', 'moment',
    ]);
    expect(TOOL_REGISTRY.filter((tool) => tool.mobile === 'more').map((tool) => tool.id)).toEqual([
      'pan', 'dimension', 'cut', 'split', 'delete',
    ]);
  });
});

