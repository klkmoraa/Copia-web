// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { THREE_STRUCTURAL_ASSET_IDS } from './threeStructuralRender';
import { ThreeAssetRenderLab } from './ThreeAssetRenderLab';

afterEach(() => {
  cleanup();
  delete window.__STRUCTURECO_RENDER_ASSET__;
  delete window.__STRUCTURECO_THREE_ASSET_IDS__;
});

describe('ThreeAssetRenderLab', () => {
  it('publishes the complete source manifest for deterministic generation', async () => {
    render(<ThreeAssetRenderLab />);
    await waitFor(() => expect(window.__STRUCTURECO_THREE_ASSET_IDS__).toEqual(THREE_STRUCTURAL_ASSET_IDS));
    expect(screen.getByText('Ready · 40 structural scenes')).toBeTruthy();
  });
});
