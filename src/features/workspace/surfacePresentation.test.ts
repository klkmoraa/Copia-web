import { describe, expect, it } from 'vitest';
import { INSPECTOR_SEGMENTS } from '../inspector/inspectorSegments';
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
  X2: { detail: 'dock', data: 'drawer', palette: 'overlay', candidatePicker: 'floating', contextualActions: 'inset' },
  M1: { detail: 'inset', data: 'drawer', palette: 'overlay', candidatePicker: 'floating', contextualActions: 'inset' },
  K0: { detail: 'sheet', data: 'fullscreen', palette: 'sheet', candidatePicker: 'sheet', contextualActions: 'inset' },
};

describe('surface presentation table', () => {
  it('is the literal X2/M1/K0 matrix for every broker-owned surface', () => {
    expect(BROKER_SURFACE_IDS).toEqual(['detail', 'data', 'palette', 'candidatePicker', 'contextualActions']);
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

// ---------------------------------------------------------------------------
// El panel derecho es UNA superficie. Sus segmentos no lo son.
// ---------------------------------------------------------------------------
describe('el panel derecho es una sola superficie', () => {
  /**
   * `analysisSetup` y `view` fueron ids del broker que montaban dos copias mas
   * del mismo componente con su tablist apagado. La consecuencia real de
   * tenerlos separados no era estetica: en Compact hay UNA ranura contextual
   * (R-1), asi que los tres se desbancaban entre si, y abrir «Cargas» suspendia
   * el detalle de lo que el usuario acababa de seleccionar.
   *
   * Este gate impide que vuelvan. Un segmento se conmuta dentro del panel; una
   * superficie compite por sitio en la pantalla. No son la misma cosa y no
   * pueden volver a declararse como si lo fueran.
   */
  it('no declara ninguna superficie para un segmento del panel', () => {
    const ids: readonly string[] = BROKER_SURFACE_IDS;
    for (const segment of INSPECTOR_SEGMENTS) {
      // `detail` nombra al panel entero, que si es una superficie; los otros dos
      // segmentos no pueden aparecer aqui bajo ningun nombre.
      if (segment === 'detail') continue;
      expect(ids).not.toContain(segment);
    }
    expect(ids).not.toContain('analysisSetup');
    expect(ids).not.toContain('loads');
  });

  it('deja UNA sola superficie acoplada al borde de la pantalla', () => {
    const docked = BROKER_SURFACE_IDS.filter((surface) => resolveSurfacePresentation('X2', surface) === 'dock');
    // El panel derecho y nada más. Resultados era el otro dock —el inferior—
    // y dejó de serlo al entrar en «Datos»: el lienzo recupera ese alto.
    expect(docked).toEqual(['detail']);
  });
});

describe('surface exclusivity', () => {
  it('keeps only the latest contextual layer active in Compact and resumes the prior layer after close', () => {
    let state = createSurfaceBrokerState(['detail']);
    state = openSurfaceIntent(state, 'data');

    const compact = resolveSurfaceActivity('K0', state);
    expect(compact.data.status).toBe('active');
    expect(compact.detail.status).toBe('suspended');

    state = closeSurfaceIntent(state, 'data');
    const resumed = resolveSurfaceActivity('K0', state);
    expect(resumed.detail.status).toBe('active');
    expect(state.surfaces.detail.open).toBe(true);
  });

  /**
   * La exclusividad modal deja de necesitar arbitraje: pasa a ser estructural.
   *
   * Antes había tres superficies modales —`dense`, `datasheet` y `doctor`— y
   * el resolutor tenía que elegir cuál de ellas estaba activa. Ese arbitraje
   * era la prueba de que el corte estaba mal: tres cosas que el producto nunca
   * podía enseñar a la vez seguían declaradas como tres. Con «Datos» hay una,
   * y dos modales no pueden coexistir porque no hay dos.
   *
   * La regla de `validateSurfaceCombination` NO se retira: sigue siendo la red
   * si alguien vuelve a declarar una segunda modal.
   */
  it('declara una sola superficie modal, así que dos no pueden coexistir', () => {
    for (const shellClass of ['X2', 'M1', 'K0'] as const) {
      const modal = BROKER_SURFACE_IDS.filter((surface) => (
        ['drawer', 'fullscreen'].includes(resolveSurfacePresentation(shellClass, surface))
      ));
      expect(modal).toEqual(['data']);
    }

    const activity = resolveSurfaceActivity('X2', openSurfaceIntent(createSurfaceBrokerState(), 'data'));
    expect(activity.data).toMatchObject({ status: 'active', presentation: 'drawer' });
    expect(validateSurfaceCombination('X2', activity)).toEqual([]);
  });

  it('retains suspended logical state instead of destructively closing it', () => {
    let state = createSurfaceBrokerState(['detail']);
    const detailRequest = state.surfaces.detail.requestVersion;
    state = openSurfaceIntent(state, 'data');

    // En Compact la superficie modal ocupa la única ranura contextual y el
    // panel se suspende — retenido, nunca destruido.
    expect(resolveSurfaceActivity('K0', state).detail.status).toBe('suspended');
    expect(state.surfaces.detail).toMatchObject({ open: true, requestVersion: detailRequest });

    state = closeSurfaceIntent(state, 'data');
    expect(resolveSurfaceActivity('K0', state).detail.status).toBe('active');
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
      data: 'tool',
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

  it('K0 · contextual-actions no roba la actividad al «Datos» abierto en default', () => {
    let state = openSurfaceIntent(createSurfaceBrokerState(), 'data');
    expect(resolveSurfaceActivity('K0', state).data).toMatchObject({ status: 'active', extent: 'default', presentation: 'fullscreen' });

    // Seleccionar una fila abre la superficie derivada, y es lo último que pasa.
    state = openSurfaceIntent(state, 'contextualActions');

    const activity = resolveSurfaceActivity('K0', state);
    expect(activity.data).toMatchObject({ open: true, status: 'active', extent: 'default', presentation: 'fullscreen' });
    // No se elimina: queda retenida, con su intención intacta, lista para reanudarse.
    expect(activity.contextualActions).toMatchObject({ open: true, status: 'suspended', presentation: 'inset' });
    expect(validateSurfaceCombination('K0', activity)).toEqual([]);
  });

  it('K0 · Localizar deja el «Datos» active + peek, nunca suspended, con las dos superficies retenidas', () => {
    let state = openSurfaceIntent(createSurfaceBrokerState(), 'data');
    state = openSurfaceIntent(state, 'contextualActions');
    state = setSurfaceExtent(state, 'K0', 'data', 'peek');

    const activity = resolveSurfaceActivity('K0', state);
    expect(activity.data).toMatchObject({ open: true, status: 'active', extent: 'peek', presentation: 'fullscreen' });
    expect(activity.data.status).not.toBe('suspended');
    // En `peek` la hoja deja de tapar el lienzo, así que el zócalo vuelve con él.
    expect(activity.contextualActions).toMatchObject({ open: true, status: 'active', presentation: 'inset' });
    expect(validateSurfaceCombination('K0', activity)).toEqual([]);
  });

  it('K0 · restaurar devuelve el «Datos» a default y cerrar deja resolver la siguiente superficie', () => {
    let state = openSurfaceIntent(createSurfaceBrokerState(), 'data');
    state = openSurfaceIntent(state, 'contextualActions');
    state = setSurfaceExtent(state, 'K0', 'data', 'peek');
    state = setSurfaceExtent(state, 'K0', 'data', 'default');

    const restored = resolveSurfaceActivity('K0', state);
    expect(restored.data).toMatchObject({ status: 'active', extent: 'default', presentation: 'fullscreen' });
    expect(restored.contextualActions.status).toBe('suspended');
    expect(validateSurfaceCombination('K0', restored)).toEqual([]);

    // Al cerrar el «Datos», la superficie derivada se reanuda si la selección
    // que la justifica sigue ahí — que es justamente lo que su intención dice.
    const closed = resolveSurfaceActivity('K0', closeSurfaceIntent(state, 'data'));
    expect(closed.data).toMatchObject({ status: 'closed', extent: 'default' });
    expect(closed.contextualActions.status).toBe('active');
    expect(validateSurfaceCombination('K0', closed)).toEqual([]);
  });

  it('K0 · una capa contextual sí desbanca al «Datos»: la precedencia es por rol, no una excepción para el «Datos»', () => {
    let state = openSurfaceIntent(createSurfaceBrokerState(), 'data');
    state = openSurfaceIntent(state, 'detail');

    const activity = resolveSurfaceActivity('K0', state);
    expect(activity.detail.status).toBe('active');
    expect(activity.data).toMatchObject({ open: true, status: 'suspended' });
  });

  it('X2 y M1 no cambian: la ranura única es sólo de Compact', () => {
    let state = openSurfaceIntent(createSurfaceBrokerState(['detail']), 'data');
    state = openSurfaceIntent(state, 'contextualActions');

    for (const shellClass of ['X2', 'M1'] as const) {
      const activity = resolveSurfaceActivity(shellClass, state);
      // Los carriles residentes y el zócalo conviven con la herramienta modal,
      // exactamente como antes de este cambio.
      expect(activity.data).toMatchObject({ status: 'active', presentation: 'drawer' });
      expect(activity.contextualActions).toMatchObject({ status: 'active', presentation: 'inset' });
      expect(activity.detail.status).toBe('active');
      expect(validateSurfaceCombination(shellClass, activity)).toEqual([]);
    }

    // Y `peek` sigue sin alterar a nadie en X2/M1.
    const peeking = setSurfaceExtent(state, 'X2', 'data', 'peek');
    const activity = resolveSurfaceActivity('X2', peeking);
    expect(activity.data).toMatchObject({ status: 'active', extent: 'peek' });
    expect(activity.contextualActions.status).toBe('active');
  });

  it('denuncia una superficie derivada activa detrás de algo que tapa el lienzo', () => {
    // El validador contaba superficies activas, no capas contextuales, así que
    // daba por bueno el estado defectuoso; ahora tiene una regla que lo dice.
    let state = openSurfaceIntent(createSurfaceBrokerState(), 'data');
    state = openSurfaceIntent(state, 'contextualActions');
    const activity = resolveSurfaceActivity('K0', state);

    expect(validateSurfaceCombination('K0', activity)).toEqual([]);
    expect(validateSurfaceCombination('K0', {
      ...activity,
      contextualActions: { ...activity.contextualActions, status: 'active' },
    })).toEqual(['Una superficie derivada no puede estar activa mientras data ocupa el lienzo.']);
  });
});

describe('peek state', () => {
  it('admite `peek` sobre la superficie densa en las tres clases, porque es modal en todas', () => {
    // «Datos» es invocada, nunca residente: en X2/M1 llega como `drawer` y en
    // K0 como `fullscreen`, así que `peek` es válido en las tres. Era el
    // contrato de `dense` (CRI-101) y ahora lo hereda la superficie entera.
    for (const shellClass of ['X2', 'M1', 'K0'] as const) {
      const opened = openSurfaceIntent(createSurfaceBrokerState(), 'data');
      const peeking = setSurfaceExtent(opened, shellClass, 'data', 'peek');
      const activity = resolveSurfaceActivity(shellClass, peeking);
      expect(activity.data).toMatchObject({
        presentation: shellClass === 'K0' ? 'fullscreen' : 'drawer',
        extent: 'peek',
        status: 'active',
      });
      expect(validateSurfaceCombination(shellClass, activity)).toEqual([]);
      // Y no queda abierta al cerrarla: no hay residencia que recordar.
      const closed = resolveSurfaceActivity(shellClass, closeSurfaceIntent(peeking, 'data'));
      expect(closed.data).toMatchObject({ status: 'closed', extent: 'default' });
    }
  });

  it('allows peek only as state of a drawer/fullscreen presentation', () => {
    let state = openSurfaceIntent(createSurfaceBrokerState(), 'data');
    state = setSurfaceExtent(state, 'X2', 'data', 'peek');
    expect(resolveSurfaceActivity('X2', state).data.extent).toBe('peek');
    expect(resolveSurfaceActivity('K0', state).data).toMatchObject({ presentation: 'fullscreen', extent: 'peek' });

    const detail = openSurfaceIntent(createSurfaceBrokerState(), 'detail');
    expect(() => setSurfaceExtent(detail, 'K0', 'detail', 'peek')).toThrow(/drawer|fullscreen/i);
  });
});
