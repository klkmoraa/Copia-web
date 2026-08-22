// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { createStructuralEditGeometryPreview, prepareStructuralEdit } from '../../data/structuralEditing';
import { CanvasStructuralEditPreviewLayer } from './CanvasStructuralEditPreviewLayer';

afterEach(() => cleanup());

describe('CanvasStructuralEditPreviewLayer', () => {
  it('renders lightweight gesture geometry without needing a cloned ProjectModel', () => {
    const project = createDefaultProject();
    const geometry = createStructuralEditGeometryPreview(project, {
      kind: 'move', selection: { kind: 'member', id: project.members[0].id }, delta: { x: 2, y: 1 },
    });
    const { container } = render(<svg><CanvasStructuralEditPreviewLayer
      project={project}
      geometry={geometry}
      size={{ width: 800, height: 600 }}
      toScreen={(x, y) => ({ x, y })}
      label="Vista previa estructural"
    /></svg>);

    expect(container.querySelector('[data-structural-edit-preview-mode="gesture"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-preview-node]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-preview-member]')).toHaveLength(2);
  });

  it('renders only prepared affected geometry and the Move control vector', () => {
    const project = createDefaultProject();
    const prepared = prepareStructuralEdit(project, {
      kind: 'move', selection: { kind: 'member', id: project.members[0].id }, delta: { x: 2, y: -1 },
    });
    const { container } = render(<svg><CanvasStructuralEditPreviewLayer
      project={project}
      prepared={prepared}
      size={{ width: 800, height: 600 }}
      toScreen={(x, y) => ({ x, y })}
      label="Vista previa estructural"
    /></svg>);
    expect(container.querySelector('[data-structural-edit-preview]')).toBeTruthy();
    expect(container.querySelectorAll('[data-preview-member]')).toHaveLength(prepared.affectedMemberIds.length);
    expect(container.querySelectorAll('[data-preview-node]')).toHaveLength(prepared.affectedNodeIds.length);
    expect(container.querySelector('[data-preview-control="vector"]')).toBeTruthy();
  });

  it('renders every copied array instance using the exact final IDs', () => {
    const project = createDefaultProject();
    const prepared = prepareStructuralEdit(project, {
      kind: 'linear-array', selection: { kind: 'member', id: project.members[0].id },
      direction: { x: 1, y: 0 }, spacing: 2, count: 3,
    });
    const { container } = render(<svg><CanvasStructuralEditPreviewLayer
      project={project}
      prepared={prepared}
      size={{ width: 800, height: 600 }}
      toScreen={(x, y) => ({ x, y })}
      label="Vista previa estructural"
    /></svg>);
    expect([...container.querySelectorAll('[data-preview-node]')].map((node) => node.getAttribute('data-preview-node'))).toEqual(prepared.createdNodeIds);
    expect([...container.querySelectorAll('[data-preview-member]')].map((member) => member.getAttribute('data-preview-member'))).toEqual(prepared.createdMemberIds);
  });

  it('renders an explicit Mirror axis and Rotate center without pointer events', () => {
    const project = createDefaultProject();
    const mirror = prepareStructuralEdit(project, {
      kind: 'mirror', mode: 'transform', selection: { kind: 'node', id: project.nodes[0].id },
      axis: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
    });
    const rendered = render(<svg><CanvasStructuralEditPreviewLayer
      project={project}
      prepared={mirror}
      size={{ width: 800, height: 600 }}
      toScreen={(x, y) => ({ x, y })}
      label="Vista previa estructural"
    /></svg>);
    expect(rendered.container.querySelector('[data-preview-control="axis"]')).toBeTruthy();
    expect(rendered.container.querySelector('[data-structural-edit-preview]')?.getAttribute('style')).toContain('pointer-events: none');
    rendered.unmount();

    const rotate = prepareStructuralEdit(project, {
      kind: 'rotate', selection: { kind: 'node', id: project.nodes[0].id }, center: { x: 2, y: 2 }, angleDeg: 45,
    });
    const rotated = render(<svg><CanvasStructuralEditPreviewLayer
      project={project}
      prepared={rotate}
      size={{ width: 800, height: 600 }}
      toScreen={(x, y) => ({ x, y })}
      label="Vista previa estructural"
    /></svg>);
    expect(rotated.container.querySelector('[data-preview-control="center"]')).toBeTruthy();
  });
});
