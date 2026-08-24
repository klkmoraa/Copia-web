// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStableCanvasEvent } from './useStableCanvasEvent';

afterEach(cleanup);

describe('useStableCanvasEvent', () => {
  it('mantiene la misma identidad de función entre renders', () => {
    const { result, rerender } = renderHook(({ callback }) => useStableCanvasEvent(callback), {
      initialProps: { callback: () => 1 },
    });
    const first = result.current;
    rerender({ callback: () => 2 });
    expect(result.current).toBe(first);
  });

  it('siempre invoca la versión más reciente del callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ callback }) => useStableCanvasEvent(callback), {
      initialProps: { callback: first },
    });
    rerender({ callback: second });
    result.current('a', 1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('a', 1);
  });
});
