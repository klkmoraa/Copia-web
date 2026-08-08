/**
 * Units, sign conventions, scope and declared limitations.
 *
 * An engineering memoir has to state, on its own pages, the units it uses, the sign
 * convention behind every N-V-M figure, what the analysis does and does not cover, and
 * any warning the solver raised. Until 0.8.1 the document jumped straight from the
 * executive page to the diagrams and left all of that implicit.
 */
import { unitLabel } from '../../engine/units';
import { drawSectionBand, drawVisualHeader } from './pdfChrome';
import type { ReportContext } from './reportContext';

export const drawScopePage = (context: ReportContext): void => {
  const { layout, project, analysis } = context;
  const { rgb } = layout;
  layout.newPage();
  drawVisualHeader(layout, 'Unidades y convenciones', 'Como debe leerse este documento');
  drawSectionBand(layout, '05', 'Unidades y convenciones', 'Base de lectura de todas las cifras del documento');
  layout.y = 700;

  layout.heading('Unidades de presentacion');
  const units = project.settings.units;
  for (const [label, quantity] of [
    ['Longitud y desplazamiento', 'length'],
    ['Fuerza y reaccion', 'force'],
    ['Momento', 'moment'],
    ['Carga distribuida', 'distributedForce'],
  ] as const) {
    layout.row(label, unitLabel(units, quantity));
  }
  layout.row('Rotacion', 'rad');
  layout.row('Precision interna', 'doble precision IEEE-754; el redondeo es solo de presentacion');
  layout.row('Cero mostrado', 'un valor por debajo de la tolerancia relativa del solver se presenta como 0');

  layout.heading('Convenciones de signo');
  layout.text('+X apunta a la derecha y +Y hacia arriba. El eje local x de cada miembro va del nodo i al nodo j, y el eje local y gira 90 grados en sentido antihorario respecto de x.', 8.7);
  layout.row('N axial', 'positivo en traccion, segun el eje local x del miembro');
  layout.row('V cortante', 'positivo segun el eje local y del miembro');
  layout.row('M momento', 'positivo cuando tracciona la fibra del lado local -y');
  layout.row('Reacciones', 'expresadas en ejes globales, con el signo de la fuerza que el apoyo ejerce sobre la estructura');
  layout.row('Deformada', 'desplazamientos nodales en ejes globales; la escala del dibujo es ilustrativa');

  layout.heading('Alcance del analisis');
  layout.row('Formulacion', analysis.educationTrace?.formulation ?? 'analisis estatico lineal 2D');
  layout.row('Elemento de marco', 'Euler-Bernoulli con deformacion axial y flexion');
  layout.row('Elemento de armadura', 'rigidez axial exclusivamente');
  layout.row('Hipotesis', 'comportamiento elastico lineal, pequenas deformaciones y propiedades prismaticas por miembro');

  layout.heading('Limitaciones declaradas');
  for (const limitation of [
    'No se consideran efectos de segundo orden (P-Delta) ni no linealidad geometrica.',
    'No se considera plasticidad, fluencia, fisuracion ni degradacion de rigidez.',
    'No se realiza analisis modal, dinamico, de historia en el tiempo ni espectral.',
    'No se aplica ninguna norma de diseno: el documento reporta solicitaciones, no verificaciones normativas.',
    'El pandeo, la torsion fuera del plano y el comportamiento tridimensional quedan fuera del modelo 2D.',
    'Los resultados dependen enteramente del modelo introducido; su idoneidad es responsabilidad del ingeniero que firma.',
  ]) {
    layout.text(`- ${limitation}`, 8.5, layout.fonts.regular, rgb(0.24, 0.28, 0.34), 10);
  }

  layout.heading('Advertencias del analisis');
  if (analysis.issues.length === 0) {
    layout.text('Las comprobaciones de entrada, estabilidad y equilibrio no detectaron incidencias.', 8.7, layout.fonts.regular, rgb(0.10, 0.35, 0.22), 10);
  } else {
    for (const issue of analysis.issues) {
      const severity = issue.severity === 'error' ? 'ERROR' : issue.severity === 'warning' ? 'AVISO' : 'INFO';
      const color = issue.severity === 'error' ? rgb(0.75, 0.20, 0.16) : issue.severity === 'warning' ? rgb(0.62, 0.42, 0.05) : rgb(0.24, 0.28, 0.34);
      layout.text(`[${severity}] ${issue.title}${issue.objectId ? ` (${issue.objectId})` : ''}: ${issue.message}`, 8.5, layout.fonts.regular, color, 10);
      if (issue.suggestedFix) layout.text(`Solucion sugerida: ${issue.suggestedFix}`, 8, layout.fonts.regular, rgb(0.37, 0.43, 0.39), 20);
    }
  }
};
