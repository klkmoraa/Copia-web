import { describe, expect, it } from 'vitest';
import { layoutSmartLabels, smartLabelDetailForScale, smartLabelRectsOverlap, type SmartLabelCandidate } from './labelLayout';

const bounds = { x: 0, y: 0, width: 520, height: 320 };

describe('smart label layout', () => {
  it('maps camera scale to stable detail levels', () => {
    expect(smartLabelDetailForScale(36)).toBe('essential');
    expect(smartLabelDetailForScale(52)).toBe('standard');
    expect(smartLabelDetailForScale(89)).toBe('standard');
    expect(smartLabelDetailForScale(90)).toBe('detailed');
  });

  it('is deterministic regardless of candidate input order', () => {
    const candidates: SmartLabelCandidate[] = [
      { id: 'member-M2', text: 'M2', anchor: { x: 260, y: 160 }, priority: 2 },
      { id: 'node-N1', text: 'N1', anchor: { x: 260, y: 160 }, priority: 1 },
      { id: 'selected-M1', text: 'M1 seleccionado', anchor: { x: 260, y: 160 }, priority: 0 },
    ];
    expect(layoutSmartLabels(candidates, bounds, 100)).toEqual(layoutSmartLabels([...candidates].reverse(), bounds, 100));
  });

  it('keeps every essential label and resolves collisions when space exists', () => {
    const candidates: SmartLabelCandidate[] = Array.from({ length: 8 }, (_, index) => ({
      id: `essential-${index}`,
      text: `P${index + 1}`,
      anchor: { x: 260, y: 160 },
      priority: index === 0 ? 0 : 1,
    }));
    const placed = layoutSmartLabels(candidates, bounds, 34);
    expect(placed).toHaveLength(candidates.length);
    for (let index = 0; index < placed.length; index += 1) {
      for (let other = index + 1; other < placed.length; other += 1) {
        expect(smartLabelRectsOverlap(placed[index].rect, placed[other].rect)).toBe(false);
      }
    }
  });

  it('applies level of detail and lets secondary labels yield in a saturated area', () => {
    const primary: SmartLabelCandidate = { id: 'primary', text: 'Nodo N1', anchor: { x: 40, y: 30 }, priority: 1 };
    const details: SmartLabelCandidate[] = Array.from({ length: 20 }, (_, index) => ({
      id: `detail-${index}`,
      text: `Detalle secundario ${index}`,
      anchor: { x: 40, y: 30 },
      priority: 3,
    }));
    expect(layoutSmartLabels([primary, ...details], { x: 0, y: 0, width: 130, height: 48 }, 40)).toHaveLength(1);
    expect(layoutSmartLabels([primary, ...details], { x: 0, y: 0, width: 130, height: 48 }, 120).length).toBeLessThan(details.length + 1);
  });

  it('marks a leader when collision avoidance displaces a label', () => {
    const placed = layoutSmartLabels([
      { id: 'a', text: 'Etiqueta A', anchor: { x: 260, y: 160 }, priority: 0 },
      { id: 'b', text: 'Etiqueta B', anchor: { x: 260, y: 160 }, priority: 1 },
    ], bounds, 100);
    expect(placed[0].leader).toBe(false);
    expect(placed[1].leader).toBe(true);
  });

  it('keeps a forced critical value visible below its normal detail threshold', () => {
    const placed = layoutSmartLabels([{
      id: 'critical-maximum',
      text: 'M = 42.00 kN·m',
      anchor: { x: 260, y: 160 },
      priority: 2,
      minScale: 120,
      forceVisible: true,
    }], bounds, 32);
    expect(placed).toHaveLength(1);
    expect(placed[0].id).toBe('critical-maximum');
  });
});
