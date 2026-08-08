// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_INSPECTOR_WIDTH, MIN_INSPECTOR_WIDTH, useWorkspaceLayoutPreferences, WORKSPACE_LAYOUT_STORAGE_KEY } from './useWorkspaceLayoutPreferences';

const Harness = () => {
  const { preferences, setPreference, togglePreference } = useWorkspaceLayoutPreferences();
  return <>
    <button onClick={() => togglePreference('fullCanvas')}>{preferences.fullCanvas ? 'full' : 'standard'}</button>
    <button onClick={() => setPreference('inspectorWidth', MAX_INSPECTOR_WIDTH + 100)}>Ancho {preferences.inspectorWidth}</button>
  </>;
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('useWorkspaceLayoutPreferences', () => {
  it('falls back safely when storage is invalid', () => {
    localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, '{invalid');
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'standard' })).toBeTruthy();
  });

  it('persists presentation preferences without project state', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'standard' }));
    expect(screen.getByRole('button', { name: 'full' })).toBeTruthy();
    await waitFor(() => expect(JSON.parse(localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY) ?? '{}')).toMatchObject({ fullCanvas: true }));
  });

  it('sanitizes persisted inspector width and keeps resizing presentation-only', async () => {
    localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify({ inspectorWidth: MIN_INSPECTOR_WIDTH - 100 }));
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('button', { name: `Ancho ${MIN_INSPECTOR_WIDTH}` })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: `Ancho ${MIN_INSPECTOR_WIDTH}` }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY) ?? '{}')).toMatchObject({ inspectorWidth: MAX_INSPECTOR_WIDTH }));
  });
});
