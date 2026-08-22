/**
 * Política de capacidad de Space 3D.
 *
 * Pura y sin efectos: recibe un informe medido y decide qué escalón queda
 * aprobado. Vive aparte del script que lo ejecuta para poder probarla con
 * informes sintéticos, incluidos los que fallan — que son justamente los que no
 * se pueden provocar a voluntad en una máquina real.
 *
 * Un escalón se aprueba sólo si las tres condiciones se cumplen a la vez:
 * tiempo de resolución, memoria estimada de matrices y finitud de resultados.
 * Al primer escalón que falla se corta: la capacidad publicada es el último
 * escalón aprobado, nunca uno posterior que «casi» pasa.
 */

export const SPACE3D_CAPACITY_POLICY = Object.freeze({
  maxSolveMilliseconds: 2000,
  maxAdditionalBytes: 256 * 1024 * 1024,
});

const MARKER = 'SPACE3D_CAPACITY_JSON=';

export const evaluateSpace3DCapacity = (report) => {
  if (!report || typeof report !== 'object') throw new Error('El report de capacidad es obligatorio.');
  if (report.schemaVersion !== 1) throw new Error(`schemaVersion no soportada: ${String(report.schemaVersion)}`);
  if (!Array.isArray(report.steps) || report.steps.length === 0) throw new Error('El report no contiene steps.');

  const failures = [];
  let approved = null;

  for (const step of report.steps) {
    const reasons = [];
    if (!Number.isFinite(step.solveMilliseconds) || step.solveMilliseconds > SPACE3D_CAPACITY_POLICY.maxSolveMilliseconds) {
      reasons.push('solve-time');
    }
    if (!Number.isFinite(step.estimatedBytes) || step.estimatedBytes > SPACE3D_CAPACITY_POLICY.maxAdditionalBytes) {
      reasons.push('memory');
    }
    if (step.finite !== true) reasons.push('non-finite');

    if (reasons.length > 0) {
      failures.push({
        nodes: step.nodes,
        members: step.members,
        reason: reasons[0],
        reasons,
        solveMilliseconds: step.solveMilliseconds,
        estimatedBytes: step.estimatedBytes,
      });
      break;
    }
    approved = { nodes: step.nodes, members: step.members };
  }

  return {
    ok: failures.length === 0 && approved !== null,
    approved,
    failures,
    policy: SPACE3D_CAPACITY_POLICY,
    measured: report.steps,
  };
};

export const parseSpace3DCapacityReport = (stdout) => {
  const line = String(stdout).split(/\r?\n/).find((candidate) => candidate.includes(MARKER));
  if (!line) throw new Error(`No se encontró el marcador ${MARKER} en la salida de vitest.`);
  const payload = line.slice(line.indexOf(MARKER) + MARKER.length).trim();
  try {
    return JSON.parse(payload);
  } catch (error) {
    throw new Error(`El marcador ${MARKER} no contenía JSON válido: ${error.message}`);
  }
};

export const SPACE3D_CAPACITY_MARKER = MARKER;
