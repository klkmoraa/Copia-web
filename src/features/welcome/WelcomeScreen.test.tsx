// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankProject, exampleProjects } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import { ClassroomSessionProvider } from '../../store/ClassroomSessionContext';
import { WelcomeScreen } from './WelcomeScreen';

beforeAll(() => {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
    window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
  }
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
});

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

const renderWelcome = (language: 'es' | 'en' = 'es') => {
  const project = createBlankProject();
  project.settings = { ...project.settings, language };
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  const onOpenWorkspace = vi.fn();
  const result = render(
    <ProjectProvider>
      <ClassroomSessionProvider projectId="welcome-test">
        <WelcomeScreen onOpenWorkspace={onOpenWorkspace} />
      </ClassroomSessionProvider>
    </ProjectProvider>,
  );
  return { ...result, onOpenWorkspace };
};

const templateCards = (container: HTMLElement) => [...container.querySelectorAll('.welcome-template-card')];

describe('WelcomeScreen template showcase', () => {
  it('lists every built-in example with a category badge', () => {
    const { container } = renderWelcome();

    const cards = templateCards(container);
    expect(cards).toHaveLength(exampleProjects.length);
    for (const card of cards) {
      expect(card.querySelector('.welcome-category-badge')?.textContent?.trim()).toBeTruthy();
    }
  });

  it('filters templates by category and restores the full list', async () => {
    const user = userEvent.setup();
    const { container } = renderWelcome();
    const total = exampleProjects.length;

    await user.click(screen.getByRole('tab', { name: 'Académicos' }));
    await waitFor(() => expect(templateCards(container).length).toBeLessThan(total));
    const academic = templateCards(container);
    expect(academic.length).toBeGreaterThan(0);
    for (const card of academic) {
      expect(card.querySelector('.welcome-category-badge')?.textContent).toContain('Académico');
    }

    await user.click(screen.getByRole('tab', { name: 'Modelos' }));
    await waitFor(() => expect(templateCards(container).length).toBe(total - academic.length));
    for (const card of templateCards(container)) {
      expect(card.querySelector('.welcome-category-badge')?.textContent).not.toContain('Académico');
    }

    await user.click(screen.getByRole('tab', { name: 'Todos' }));
    await waitFor(() => expect(templateCards(container)).toHaveLength(total));
  });

  it('marks the active filter for assistive technology', async () => {
    const user = userEvent.setup();
    renderWelcome();

    expect(screen.getByRole('tab', { name: 'Todos' }).getAttribute('aria-selected')).toBe('true');
    await user.click(screen.getByRole('tab', { name: 'Académicos' }));
    expect(screen.getByRole('tab', { name: 'Académicos' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Todos' }).getAttribute('aria-selected')).toBe('false');
  });

  it('opens the workspace with the chosen template loaded', async () => {
    const user = userEvent.setup();
    const { container, onOpenWorkspace } = renderWelcome();

    const [firstCard] = templateCards(container);
    await user.click(firstCard);

    expect(onOpenWorkspace).toHaveBeenCalledOnce();
  });
});

describe('WelcomeScreen launcher', () => {
  it('reports the current project size on the continue card', () => {
    const { container } = renderWelcome();
    const recent = container.querySelector('.welcome-launcher-card--recent');

    // A blank project starts empty; the card must state that rather than omit the counts.
    expect(recent?.querySelector('.welcome-project-stats')?.textContent).toBe('0 nudos · 0 barras');
  });

  it('localizes the launcher and filters in English', () => {
    const { container } = renderWelcome('en');

    expect(screen.getByRole('tab', { name: 'All' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Academic' })).toBeTruthy();
    expect(container.querySelector('.welcome-launcher-card--recent .welcome-project-stats')?.textContent)
      .toBe('0 nodes · 0 members');
    expect(within(container).queryByText('Académicos')).toBeNull();
  });
});
