import type { Language } from '../../i18n/catalogs';
import type { ModelDoctorCategory, ModelDoctorFinding } from './modelDoctorDiagnostics';

export interface PresentedModelDoctorFinding {
  title: string;
  explanation: string;
  whyItMatters: string;
  suggestedAction: string;
}

const englishImpact: Record<ModelDoctorCategory, string> = {
  geometry: 'Geometry controls connectivity, length, and orientation; an inconsistency can change the structural model being interpreted.',
  topology: 'Connectivity determines how forces pass between members, nodes, supports, and loads.',
  properties: 'Properties and end conditions determine the stiffness and behavior assigned to the member.',
  supports: 'An incompatible or disconnected restraint does not represent the support or imposed movement the user expects.',
  loads: 'An invalid, orphaned, or incompatible action cannot be applied reliably to the intended model.',
  references: 'A broken reference prevents the data from being associated with the node, member, or load case it is meant to describe.',
  configuration: 'This configuration prevents an unambiguous interpretation of the scenario being reviewed.',
};

const englishAction: Record<ModelDoctorCategory, string> = {
  geometry: 'Review the indicated geometry before analysis.',
  topology: 'Review and explicitly connect the indicated objects.',
  properties: 'Correct the indicated property or end condition using physically consistent values.',
  supports: 'Review the support and keep only compatible restraints.',
  loads: 'Correct the load or assign it to a compatible object.',
  references: 'Assign the reference to an object that exists in the model.',
  configuration: 'Review the indicated configuration before continuing.',
};

const ids = (finding: ModelDoctorFinding): string[] => finding.affectedObjects.map((object) => object.id);
const subject = (finding: ModelDoctorFinding): string => ids(finding).join(' and ') || finding.sourceIssueId;

const englishSpecific = (finding: ModelDoctorFinding): Pick<PresentedModelDoctorFinding, 'title' | 'explanation'> => {
  const id = finding.sourceIssueId;
  const affected = ids(finding);
  if (id.startsWith('near-node-')) return {
    title: 'Coincident or nearly coincident nodes',
    explanation: `${affected[0] ?? 'One node'} and ${affected[1] ?? 'another node'} occupy practically the same position but remain distinct nodes.`,
  };
  if (id.startsWith('node-coordinate-')) return {
    title: 'Invalid node coordinate',
    explanation: `${affected[0] ?? 'The indicated node'} contains a coordinate that is not a finite number.`,
  };
  if (id.startsWith('node-on-member-')) return {
    title: 'Node on member without a connection',
    explanation: `${affected[0] ?? 'The node'} lies on ${affected[1] ?? 'a member'}, but it is not a structural joint.`,
  };
  if (id.startsWith('zero-')) return { title: 'Zero or nearly zero member length', explanation: `${subject(finding)} has no usable structural length.` };
  if (id.startsWith('dup-')) return { title: 'Overlapping member', explanation: `${subject(finding)} overlaps another member between the same nodes.` };
  if (id.startsWith('isolated-')) return { title: 'Isolated node', explanation: `${subject(finding)} is not connected to any member.` };
  if (id.startsWith('E-')) return { title: 'Invalid elastic modulus', explanation: `The elastic modulus E of ${subject(finding)} must be finite and greater than zero.` };
  if (id.startsWith('A-')) return { title: 'Invalid cross-sectional area', explanation: `The area A of ${subject(finding)} must be finite and greater than zero.` };
  if (id.startsWith('I-')) return { title: 'Invalid second moment of area', explanation: `The inertia I of ${subject(finding)} must be finite and greater than zero.` };
  if (/^(EA|EI|GAs)-/.test(id)) return { title: 'Structural stiffness outside the numeric range', explanation: `The combined stiffness values of ${subject(finding)} exceed the available numeric range.` };
  if (/^(G|As|density|timoshenko|release-type|rotational-spring|rigid-offset)-/.test(id)) return { title: 'Invalid or incompatible member property', explanation: `StructureCo detected an invalid property or end condition on ${subject(finding)}.` };
  if (id.startsWith('combination-factor-')) return {
    title: 'Invalid load-combination factor',
    explanation: `${subject(finding)} contains a load-case factor that is not a finite number.`,
  };
  if (/^prescribed-(?!node-|case-|support-|component-|value-)/.test(id)) return {
    title: 'Invalid prescribed displacement',
    explanation: `The prescribed support displacement affecting ${subject(finding)} is not a finite number.`,
  };
  if (/^(missing|nodal-node|nodal-case|member-load-member|member-load-case|prescribed-node|prescribed-case|initial-effect-member|initial-effect-case|combination)-/.test(id)) return { title: 'Broken model reference', explanation: `${subject(finding)} refers to a node, member, or load case that does not exist.` };
  if (/^(support|spring|prescribed-support|prescribed-component|prescribed-value)-/.test(id)) return { title: 'Invalid or incompatible restraint', explanation: `StructureCo detected an invalid support, spring, or prescribed displacement affecting ${subject(finding)}.` };
  if (/^(distributed-domain|distributed-value)-/.test(id)) return { title: 'Invalid distributed-load interval', explanation: `${subject(finding)} has an invalid interval or non-finite distributed-load value.` };
  if (/^(rigid-load|truss-member-load|free-rotation-moment|hinge-moment)-/.test(id)) return { title: 'Load incompatible with its structural target', explanation: `${subject(finding)} cannot act on the selected member or degree of freedom with the current model definition.` };
  if (/^(nodal-value|point-position|point-value|horizontal-basis|vertical-basis|self-weight)-/.test(id)) return { title: 'Invalid load definition', explanation: `${subject(finding)} contains a non-finite value, invalid position, or incompatible length basis.` };
  if (id.startsWith('initial-effect-')) return { title: 'Invalid or incompatible initial effect', explanation: `${subject(finding)} contains an invalid value or is assigned to an incompatible member.` };
  if (id.startsWith('hinge-')) return { title: 'Internal hinge needs review', explanation: `${subject(finding)} does not have the connectivity required for its internal-hinge definition.` };
  if (id.startsWith('duplicate-')) return { title: 'Repeated identifier', explanation: `${subject(finding)} uses an identifier that is already present in the same model collection.` };
  if (id === 'nodes-min' || id === 'members-min') return { title: 'Incomplete model', explanation: 'The model needs at least two nodes and one connecting member.' };
  if (id === 'load-cases-empty' || id === 'no-active-case') return { title: 'Load-case configuration needs review', explanation: 'The model needs an existing active load case, or a selected load combination.' };
  if (id === 'no-loads') return { title: 'No structural loads', explanation: 'The current model contains no non-zero loads.' };
  if (id === 'no-supports') return { title: 'Structure without grounding', explanation: 'The model has no direct support constraint or positive nodal spring connected to ground.' };
  if (id === 'classroom-relative-stiffness') return {
    title: 'Indeterminate exercise in Classroom mode',
    explanation: 'The basic static count found structural redundancies, so the diagrams depend on the automatic stiffness values hidden by Classroom mode.',
  };
  return { title: `${finding.category[0].toUpperCase()}${finding.category.slice(1)} issue`, explanation: `StructureCo detected a ${finding.category} condition affecting ${subject(finding)}.` };
};

export const presentModelDoctorFinding = (finding: ModelDoctorFinding, language: Language | undefined): PresentedModelDoctorFinding => {
  if (language !== 'en') return {
    title: finding.title,
    explanation: finding.explanation,
    whyItMatters: finding.whyItMatters,
    suggestedAction: finding.suggestedAction,
  };
  const specific = englishSpecific(finding);
  const whyItMatters = finding.sourceIssueId.startsWith('near-node-')
    ? 'They can look like one joint while transferring forces through different connectivity.'
    : finding.sourceIssueId.startsWith('node-on-member-')
      ? 'The support, load, or imposed displacement will not participate as the drawing suggests until a real joint exists.'
      : englishImpact[finding.category];
  return { ...specific, whyItMatters, suggestedAction: englishAction[finding.category] };
};
