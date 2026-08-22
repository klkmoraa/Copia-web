/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fontsCss = readFileSync(new URL('./fonts.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const tokensCss = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

describe('Clay identity typography', () => {
  it('self-hosts the editorial, interface and technical families', () => {
    expect(fontsCss).toContain("font-family: 'DM Serif Display'");
    expect(fontsCss).toContain("url('/fonts/dm-serif-display-latin-400.woff2')");
    expect(fontsCss).toContain("font-family: 'Manrope'");
    expect(fontsCss).toContain("url('/fonts/manrope-latin-variable.woff2')");
    expect(fontsCss).toContain("font-family: 'JetBrains Mono'");
    expect(fontsCss).toContain("url('/fonts/jetbrains-mono-latin-variable.woff2')");
    expect(fontsCss).toContain("url('/fonts/jetbrains-mono-greek-variable.woff2')");
    expect(fontsCss.match(/font-display:\s*swap/g)).toHaveLength(4);
  });

  it('assigns one family to each semantic reading role', () => {
    expect(tokensCss).toMatch(/--sc-font-display:\s*"DM Serif Display", Georgia, serif;/);
    expect(tokensCss).toMatch(/--sc-font-ui:\s*"Manrope", ui-sans-serif, system-ui, sans-serif;/);
    expect(tokensCss).toMatch(/--sc-font-mono:\s*"JetBrains Mono", ui-monospace, "Cascadia Mono", monospace;/);
    expect(fontsCss).not.toContain('IBM Plex');
    expect(tokensCss).not.toContain('"IBM Plex');
  });

  it('does not ship the superseded IBM Plex webfont bundle', () => {
    const legacy = [
      'ibm-plex-sans-400.woff2', 'ibm-plex-sans-500.woff2', 'ibm-plex-sans-600.woff2',
      'ibm-plex-sans-700.woff2', 'ibm-plex-mono-400.woff2', 'ibm-plex-mono-500.woff2',
    ];
    const present = legacy.filter((file) => existsSync(new URL(`../../public/fonts/${file}`, import.meta.url)));
    expect(present).toEqual([]);
  });
});
