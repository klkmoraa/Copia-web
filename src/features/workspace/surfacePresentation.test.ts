import { describe, expect, it } from 'vitest';
import {
  BROKER_SURFACE_IDS,
  SURFACE_ACTIVITY_CLASS,
  SURFACE_PRESENTATION_TABLE,
  closeSurfaceIntent,
  createSurfaceBrokerState,
  openSurfaceIntent,
  resolveSurfaceActivity,
  resolveSurfacePresentation,
  setSurfaceExtent,
  surfaceActivityClass,
  validateSurfaceCombination,
  type SurfaceActivityClass,
  type SurfaceId,
  type SurfacePresentation,
} from './surfacePresentation';

const expectedTable: Record<'X2' | 'M1' | 'K0', Record<SurfaceId, SurfacePresentation>> = {
  X2: { detail: 'dock', analysisSetup: 'dock', view: 'dock', results: 'dock', dense: 'drawer', datasheet: 'drawer', doctor: 'drawer', palette: 'overlay', candidatePicker: 'floating', contextualActions: 'inset' },
  M1: { detail: 'inset', analysisSetup: 'inset', view: 'inset', results: 'inset', dense: 'drawer', datasheet: 'drawer', doctor: 'drawer', palette: 'overlay', candidatePicker: 'floating', contextualActions: 'inset' },
  K0: { detail: 'sheet', analysisSetup: 'sheet', view: 'sheet', results: 'sheet', dense: 'fullscreen', datasheet: 'fullscreen', doctor: 'fullscreen', palette: 'sheet', candidatePicker: 'sheet', contextualActions: 'inset' },
};

describe('surface presentation table', () => {
  it('is the literal X2/M1/K0 matrix for every broker-owned surface', () => {
    expect(BROKER_SURFACE_IDS).toEqual(['detail', 'analysisSetup', 'view', 'results', 'dense', 'datasheet', 'doctor', 'palette', 'candidatePicker', 'contextualActions']);
    expect(SURFACE_PRESENTATION_TABLE).toEqual(expectedTable);

    for (const shellClass of ['X2', 'M1', 'K0'] as const) {
      for (const surface of BROKER_SURFACE_IDS) {
        expect(resolveSurfacePresentation(shellClass, surface)).toBe(expectedTable[shellClass][surface]);
      }
    }
  });

  it('migrates an open detail surface without changing its logical intent', () => {
    const state = openSurfaceIntent(createSurfaceBrokerState(), 'detail');

    expect(resolveSurfaceActivity('X2', state).detail).toMatchObject({ status: 'active', presentation: 'dock' });
    expect(resolveSurfaceActivity('M1', state).detail).toMatchObject({ status: 'active', presentation: 'inset' });
    expect(resolveSurfaceActivity('K0', state).detail).toMatchObject({ status: 'active', presentation: 'sheet' });
    expect(resolveSurfaceActivity('X2', state).detail).toMatchObject({ status: 'active', presentation: 'dock' });
    expect(state.surfaces.detail.open).toBe(true);
  });
});

describe('surface exclusivity', () => {
  it('keeps only the latest contextual layer active in Compact and resumes the prior layer after close', () => {
    let state = createSurfaceBrokerState(['results']);
    state = openSurfaceIntent(state, 'detail');
    state = openSurfaceIntent(state, 'datasheet');

    const compact = resolveSurfaceActivity('K0', state);
    expect(compact.datasheet.status).toBe('active');
    expect(compact.detail.status).toBe('suspended');
    expect(compact.results.status).toBe('suspended');

    state = closeSurfaceIntent(state, 'datasheet');
    const resumed = resolveSurfaceActivity('K0', state);
    expect(resumed.detail.status).toBe('active');
    expect(resumed.results.status).toBe('suspended');
    expect(state.surfaces.detail.open).toBe(true);
  });

  it('never activates two drawer/fullscreen presentations in any class', () => {
    let state = createSurfaceBrokerState();
    state = openSurfaceIntent(state, 'datasheet');
    state = openSurfaceIntent(state, 'doctor');

    for (const shellClass of ['X2', 'M1', 'K0'] as const) {
      const activity = resolveSurfaceActivity(shellClass, state);
      const activeModal = BROKER_SURFACE_IDS.filter((surface) => (
        activity[surface].status === 'active'
        && ['drawer', 'fullscreen'].includes(activity[surface].presentation)
      ));
      expect(activeModal).toEqual(['doctor']);
      expect(validateSurfaceCombination(shellClass, activity)).toEqual([]);
    }
  });

  it('retains suspended logical state instead of destructively closing it', () => {
    let state = createSurfaceBrokerState();
    state = openSurfaceIntent(state, 'datasheet');
    const datasheetRequest = state.surfaces.datasheet.requestVersion;
    state = openSurfaceIntent(state, 'doctor');

    expect(resolveSurfaceActivity('X2', state).datasheet.status).toBe('suspended');
    expect(state.surfaces.datasheet).toMatchObject({ open: true, requestVersion: datasheetRequest });

    state = closeSurfaceIntent(state, 'doctor');
    expect(resolveSurfaceActivity('X2', state).datasheet.status).toBe('active');
  });

  it('treats the candidate picker as one contextual Compact layer and migrates it without a selection-side effect', () => {
    let state = openSurfaceIntent(createSurfaceBrokerState(['detail']), 'candidatePicker');

    expect(resolveSurfaceActivity('K0', state).candidatePicker).toMatchObject({ status: 'active', presentation: 'sheet' });
    expect(resolveSurfaceActivity('K0', state).detail.status).toBe('suspended');
    expect(resolveSurfaceActivity('X2', state).candidatePicker).toMatchObject({ status: 'active', presentation: 'floating' });
    expect(resolveSurfaceActivity('K0', state).candidatePicker.status).toBe('active');
  });

  it('gives the Candidate Picker precedence over contextual-actions in Compact whichever opens last, and resumes the derived surface without changing its intent', () => {
    // Precedence is the broker's, by role — not a race the picker wins by
    // re-activating itself from the canvas (CRI-108). So it must hold in both
    // opening orders, including the one where the zócalo is the latest.
    for (const order of [['contextualActions', 'candidatePicker'], ['candidatePicker', 'contextualActions']] as const) {
      let state = createSurfaceBrokerState();
      for (const surface of order) state = openSurfaceIntent(state, surface);

      const compact = resolveSurfaceActivity('K0', state);
      expect(compact.candidatePicker).toMatchObject({ status: 'active', presentation: 'sheet' });
      expect(compact.contextualActions).toMatchObject({ status: 'suspended', presentation: 'inset' });
      expect(validateSurfaceCombination('K0', compact)).toEqual([]);
      // Suspended is retained, never destroyed: the intent survives intact.
      expect(state.surfaces.contextualActions.open).toBe(true);

      state = closeSurfaceIntent(state, 'candidatePicker');
      expect(resolveSurfaceActivity('K0', state).contextualActions).toMatchObject({ status: 'active', presentation: 'inset' });
    }
  });
});

// ---------------------------------------------------------------------------
// CRI-108 — la actividad se resuelve por rol de superficie, no por "la última
// activación gana". Una apertura derivada de la selección no puede desbancar a
// la herramienta modal que el usuario está usando.
// ---------------------------------------------------------------------------
describe('activity classes', () => {
  it('declares one explicit activity class per broker surface', () => {
    const expected: Record<SurfaceId, SurfaceActivityClass> = {
      detail: 'layer',
      analysisSetup: 'layer',
      view: 'layer',
      results: 'layer',
      dense: 'tool',
      datasheet: 'tool',
      doctor: 'tool',
      palette: 'layer',
      candidatePicker: 'layer',
      contextualActions: 'derived',
    };
    expect(SURFACE_ACTIVITY_CLASS).toEqual(expected);
    for (const surface of BROKER_SURFACE_IDS) expect(surfaceActivityClass(surface)).toBe(expected[surface]);
    // `contextual-actions` es la única derivada: es la única superficie cuya
    // apertura no es un acto del usuario (CRI-97).
    expect(BROKER_SURFACE_IDS.filter((surface) => surfaceActivityClass(surface) === 'derived')).toEqual(['contextualActions']);
  });

  it('K0 · contextual-actions no roba la actividad al Datasheet abierto en default', () => {
    let state = openSurfaceIntent(createSurfaceBrokerState(), 'datasheet');
    expect(resolveSurfaceActivity('K0', state).datasheet).toMatchObject({ status: 'active', extent: 'default', presentation: 'fullscreen' });

    // Seleccionar una fila abre la superficie derivada, y es lo último que pasa.
    state = openSurfaceIntent(state, 'contextualActions');

    const activity = resolveSurfaceActivity('K0', state);
    expect(activity.datasheet).toMatchObject({ open: true, status: 'active', extent: 'default', presentation: 'fullscreen' });
    // No se elimina: queda retenida, con su intención intacta, lista para reanudarse.
    expect(activity.contextualActions).toMatchObject({ open: true, status: 'suspended', presentation: 'inset' });
    expect(validateSurfaceCombination('K0', activity)).toEqual([]);
  });

  it('K0 · Localizar deja el Datasheet active + peek, nunca suspended, con las dos superficies retenidas', () => {
    let state = openSurfaceIntent(createSurfaceBrokerState(), 'datasheet');
    state = openSurfaceIntent(state, 'contextualActions');
    state = setSurfaceExtent(state, 'K0', 'datasheet', 'peek');

    const activity = resolveSurfaceActivity('K0', state);
    expect(activity.datasheet).toMatchObject({ open: true, status: 'active', extent: 'peek', presentation: 'fullscreen' });
    expect(activity.datasheet.status).not.toBe('suspended');
    // En `peek` la hoja deja de tapar el lienzo, así que el zócalo vuelve con él.
    expect(activity.contextualActions).toMatchObject({ open: true, status: 'active', presentation: 'inset' });
    expect(validateSurfaceCombination('K0', activity)).toEqual([]);
  });

  it('K0 · restaurar devuelve el Datasheet a default y cerrar deja resolver la siguiente superficie', () => {
    let state = openSurfaceIntent(createSurfaceBrokerState(), 'datasheet');
    state = openSurfaceIntent(state, 'contextualActions');
    state = setSurfaceExtent(state, 'K0', 'datasheet', 'peek');
    state = setSurfaceExtent(state, 'K0', 'datasheet', 'default');

    const restored = resolveSurfaceActivity('K0', state);
    expect(restored.datasheet).toMatchObject({ status: 'active', extent: 'default', presentation: 'fullscreen' });
    expect(restored.contextualActions.status).toBe('suspended');
    expect(validateSurfaceCombination('K0', restored)).toEqual([]);

    // Al cerrar el Datasheet, la superficie derivada se reanuda si la selección
    // que la justifica sigue ahí — que es justamente lo que su intención dice.
    const closed = resolveSurfaceActivity('K0', closeSurfaceIntent(state, 'datasheet'));
    expect(closed.datasheet).toMatchObject({ status: 'closed', extent: 'default' });
    expect(closed.contextualActions.status).toBe('active');
    expect(validateSurfaceCombination('K0', closed)).toEqual([]);
  });

  it('K0 · una capa contextual sí desbanca al Datasheet: la precedencia es por rol, no una excepción para el Datasheet', () => {
    let state = openSurfaceIntent(createSurfaceBrokerState(), 'datasheet');
    state = openSurfaceIntent(state, 'detail');

    const activity = resolveSurfaceActivity('K0', state);
    expect(activity.detail.status).toBe('active');
    expect(activity.datasheet).toMatchObject({ open: true, status: 'suspended' });
  });

  it('K0 · el Model Doctor tiene el mismo ciclo de peek que el Datasheet, por ser el mismo rol', () => {
    let state = openSurfaceIntent(createSurfaceBrokerState(), 'doctor');
    state = openSurfaceIntent(state, 'contextualActions');
    expect(resolveSurfaceActivity('K0', state).doctor).toMatchObject({ status: 'active', extent: 'default', presentation: 'fullscreen' });

    state = setSurfaceExtent(state, 'K0', 'doctor', 'peek');
    const peeked = resolveSurfaceActivity('K0', state);
    expect(peeked.doctor).toMatchObject({ status: 'active', extent: 'peek', presentation: 'fullscreen' });
    expect(peeked.contextualActions.status).toBe('active');
    expect(validateSurfaceCombination('K0', peeked)).toEqual([]);

    state = setSurfaceExtent(state, 'K0', 'doctor', 'default');
    expect(resolveSurfaceActivity('K0', state).doctor).toMatchObject({ status: 'active', extent: 'default' });
  });

  it('X2 y M1 no cambian: la ranura única es sólo de Compact', () => {
    let state = openSurfaceIntent(createSurfaceBrokerState(['results', 'detail']), 'datasheet');
    state = openSurfaceIntent(state, 'contextualActions');

    for (const shellClass of ['X2', 'M1'] as const) {
      const activity = resolveSurfaceActivity(shellClass, state);
      // Los carriles residentes y el zócalo conviven con la herramienta modal,
      // exactamente como antes de este cambio.
      expect(activity.datasheet).toMatchObject({ status: 'active', presentation: 'drawer' });
      expect(activity.contextualActions).toMatchObject({ status: 'active', presentation: 'inset' });
      expect(activity.detail.status).toBe('active');
      expect(activity.results.status).toBe('active');
      expect(validateSurfaceCombination(shellClass, activity)).toEqual([]);
    }

    // Y `peek` sigue sin alterar a nadie en X2/M1.
    const peeking = setSurfaceExtent(state, 'X2', 'datasheet', 'peek');
    const activity = resolveSurfaceActivity('X2', peeking);
    expect(activity.datasheet).toMatchObject({ status: 'active', extent: 'peek' });
    expect(activity.contextualActions.status).toBe('active');
  });

  it('denuncia una superficie derivada activa detrás de algo que tapa el lienzo', () => {
    // El validador contaba superficies activas, no capas contextuales, así que
    // daba por bueno el estado defectuoso; ahora tiene una regla que lo dice.
    let state = openSurfaceIntent(createSurfaceBrokerState(), 'datasheet');
    state = openSurfaceIntent(state, 'contextualActions');
    const activity = resolveSurfaceActivity('K0', state);

    expect(validateSurfaceCombination('K0', activity)).toEqual([]);
    expect(validateSurfaceCombination('K0', {
      ...activity,
      contextualActions: { ...activity.contextualActions, status: 'active' },
    })).toEqual(['Una superficie derivada no puede estar activa mientras datasheet ocupa el lienzo.']);
  });
});

describe('peek state', () => {
  it('admite `peek` sobre la superficie densa en las tres clases, porque es modal en todas', () => {
    // `dense` es invocada, nunca residente: en X2/M1 llega como `drawer` y en
    // K0 como `fullscreen`, así que `peek` es válido en las tres (CRI-101).
    for (const shellClass of ['X2', 'M1', 'K0'] as const) {
      const opened = openSurfaceIntent(createSurfaceBrokerState(), 'dense');
      const peeking = setSurfaceExtent(opened, shellClass, 'dense', 'peek');
      const activity = resolveSurfaceActivity(shellClass, peeking);
      expect(activity.dense).toMatchObject({
        presentation: shellClass === 'K0' ? 'fullscreen' : 'drawer',
        extent: 'peek',
        status: 'active',
      });
      expect(validateSurfaceCombination(shellClass, activity)).toEqual([]);
      // Y no queda abierta al cerrarla: no hay residencia que recordar.
      const closed = resolveSurfaceActivity(shellClass, closeSurfaceIntent(peeking, 'dense'));
      expect(closed.dense).toMatchObject({ status: 'closed', extent: 'default' });
    }
  });

  it('allows peek only as state of a drawer/fullscreen presentation', () => {
    let state = openSurfaceIntent(createSurfaceBrokerState(), 'datasheet');
    state = setSurfaceExtent(state, 'X2', 'datasheet', 'peek');
    expect(resolveSurfaceActivity('X2', state).datasheet.extent).toBe('peek');
    expect(resolveSurfaceActivity('K0', state).datasheet).toMatchObject({ presentation: 'fullscreen', extent: 'peek' });

    const detail = openSurfaceIntent(createSurfaceBrokerState(), 'detail');
    expect(() => setSurfaceExtent(detail, 'K0', 'detail', 'peek')).toThrow(/drawer|fullscreen/i);
  });
});
