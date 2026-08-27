import type { StructuralAssetDetail, StructuralAssetFamily, StructuralAssetVariantName } from './types';
import { formatFixed } from '../../utils/numberFormat';

const lineColor = 'var(--structural-asset-line, currentColor)';
const primaryColor = 'var(--structural-asset-primary, currentColor)';
const secondaryColor = 'var(--structural-asset-secondary, currentColor)';
const accentColor = 'var(--structural-asset-accent, currentColor)';

type Point2 = readonly [number, number];

const pathFromPoints = (points: readonly Point2[]) => `${points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${formatFixed(x, 2, 'canvas')} ${formatFixed(y, 2, 'canvas')}`).join('')}Z`;

/**
 * A light-weight orthographic projection of a rectangular structural member.
 *
 * The product already ships Three.js for Space 3D, but importing WebGL into
 * every Home thumbnail would turn a tiny, editable asset into a heavy runtime.
 * This primitive keeps the same 3D thinking (front, top and end planes) and
 * emits deterministic SVG geometry instead.
 */
const PrismaticMember = ({
  from,
  to,
  thickness = 9,
  depth = 6,
  accent = false,
}: {
  from: Point2;
  to: Point2;
  thickness?: number;
  depth?: number;
  accent?: boolean;
}) => {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const nx = (-dy / length) * thickness * 0.5;
  const ny = (dx / length) * thickness * 0.5;
  const extrusion: Point2 = [-depth * 0.72, -depth];
  const front: readonly Point2[] = [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]];
  const shifted = front.map(([x, y]) => [x + extrusion[0], y + extrusion[1]] as const);
  const paint = accent ? accentColor : primaryColor;

  return <g className="structural-illustration__prism" data-element="prismatic-member">
    <path className="structural-illustration__face structural-illustration__face--front" data-element="surface" d={pathFromPoints(front)} fill={paint} fillOpacity="0.3" stroke={lineColor} strokeLinejoin="round" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    <path className="structural-illustration__face structural-illustration__face--top" data-element="surface" d={pathFromPoints([shifted[0], shifted[1], front[1], front[0]])} fill={secondaryColor} fillOpacity="0.2" stroke={lineColor} strokeLinejoin="round" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    <path className="structural-illustration__face structural-illustration__face--end" data-element="surface" d={pathFromPoints([shifted[1], shifted[2], front[2], front[1]])} fill={paint} fillOpacity="0.16" stroke={lineColor} strokeLinejoin="round" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
  </g>;
};

const Members = ({ paths, accent = false }: { paths: readonly string[]; accent?: boolean }) => (
  <>
    {paths.map((d) => (
      <path
        key={d}
        className="structural-illustration__member"
        data-element="member"
        d={d}
        fill="none"
        stroke={accent ? accentColor : lineColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="7"
        vectorEffect="non-scaling-stroke"
      />
    ))}
  </>
);

const Web = ({ paths }: { paths: readonly string[] }) => (
  <>
    {paths.map((d) => (
      <path
        key={d}
        className="structural-illustration__web"
        data-element="web"
        d={d}
        fill="none"
        stroke={secondaryColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.5"
        vectorEffect="non-scaling-stroke"
      />
    ))}
  </>
);

const Face = ({ d, accent = false, opacity = 0.14 }: { d: string; accent?: boolean; opacity?: number }) => (
  <path
    className="structural-illustration__face"
    data-element="surface"
    d={d}
    fill={accent ? accentColor : primaryColor}
    fillOpacity={opacity}
    stroke={lineColor}
    strokeLinejoin="round"
    strokeWidth="2"
    vectorEffect="non-scaling-stroke"
  />
);

const Nodes = ({ points }: { points: ReadonlyArray<readonly [number, number]> }) => (
  <>
    {points.map(([cx, cy]) => (
      <circle
        key={`${cx}:${cy}`}
        className="structural-illustration__node"
        data-element="node"
        cx={cx}
        cy={cy}
        r="4.2"
        fill={primaryColor}
        stroke={lineColor}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    ))}
  </>
);

const Ground = ({ x1 = 30, x2 = 210, y = 132 }: { x1?: number; x2?: number; y?: number }) => (
  <g className="structural-illustration__ground" data-element="ground">
    <path d={`M${x1} ${y}H${x2}`} fill="none" stroke={secondaryColor} strokeWidth="2" />
    <path
      d={`M${x1 + 8} ${y}l-7 8m27-8-7 8m27-8-7 8m27-8-7 8m27-8-7 8m27-8-7 8m27-8-7 8`}
      fill="none"
      stroke={secondaryColor}
      strokeWidth="1.5"
    />
  </g>
);

type SupportKind = 'pin' | 'roller' | 'fixed' | 'spring';

const SupportGlyph = ({ kind, x, y, scale = 1 }: { kind: SupportKind; x: number; y: number; scale?: number }) => (
  <g
    className={`structural-illustration__support structural-illustration__support--${kind}`}
    data-element="support"
    transform={`translate(${x} ${y}) scale(${scale})`}
  >
    {kind === 'pin' ? (
      <>
        <path d="M0 0-13 22H13Z" fill={primaryColor} fillOpacity="0.12" stroke={lineColor} strokeWidth="2.2" />
        <path d="M-18 24H18M-14 24l-6 7m18-7-6 7m18-7-6 7" fill="none" stroke={lineColor} strokeWidth="2" />
      </>
    ) : null}
    {kind === 'roller' ? (
      <>
        <path d="M0 0-13 18H13Z" fill={primaryColor} fillOpacity="0.12" stroke={lineColor} strokeWidth="2.2" />
        <circle cx="-7" cy="23" r="4" fill="none" stroke={lineColor} strokeWidth="2" />
        <circle cx="7" cy="23" r="4" fill="none" stroke={lineColor} strokeWidth="2" />
        <path d="M-18 29H18" fill="none" stroke={lineColor} strokeWidth="2" />
      </>
    ) : null}
    {kind === 'fixed' ? (
      <>
        <path d="M0-24V26" fill="none" stroke={lineColor} strokeWidth="5" />
        <path d="M0-22 12-31M0-9 12-18M0 4l12-9M0 17l12-9M0 30l12-9" fill="none" stroke={secondaryColor} strokeWidth="2" />
      </>
    ) : null}
    {kind === 'spring' ? (
      <>
        <path d="M0 0v8l-10 6 20 8-20 8 20 8-10 6v7" fill="none" stroke={lineColor} strokeWidth="2.8" />
        <path d="M-18 51H18M-14 51l-6 7m18-7-6 7m18-7-6 7" fill="none" stroke={secondaryColor} strokeWidth="2" />
      </>
    ) : null}
  </g>
);

const PortalGeometry = ({ variant }: { variant: StructuralAssetVariantName }) => {
  if (variant === 'single-bay') {
    return <>
      <Face d="M30 128H194L218 141 54 151 30 138Z" opacity={0.12} />
      <Face d="M48 50H64V129H48Z" opacity={0.28} /><Face d="M42 44 48 50V129L42 123Z" opacity={0.14} />
      <Face d="M178 50H194V129H178Z" opacity={0.28} /><Face d="M172 44 178 50V129L172 123Z" opacity={0.14} />
      <Face d="M48 50H194V64H48Z" opacity={0.3} /><Face d="M42 44H188L194 50H48Z" opacity={0.16} />
      <Face d="M45 48H67V57H45Z" accent opacity={0.5} /><Face d="M175 48H197V57H175Z" accent opacity={0.5} />
      <Face d="M44 124H68V132H44Z" accent opacity={0.38} /><Face d="M174 124H198V132H174Z" accent opacity={0.38} />
    </>;
  }
  if (variant === 'two-bay') {
    return <>
      <Face d="M17 130H207L225 141 35 151 17 140Z" opacity={0.12} />
      <Face d="M30 55H43V130H30Z" opacity={0.27} /><Face d="M25 50 30 55V130L25 125Z" opacity={0.13} />
      <Face d="M112 55H125V130H112Z" opacity={0.27} /><Face d="M107 50 112 55V130L107 125Z" opacity={0.13} />
      <Face d="M194 55H207V130H194Z" opacity={0.27} /><Face d="M189 50 194 55V130L189 125Z" opacity={0.13} />
      <Face d="M30 55H207V67H30Z" opacity={0.3} /><Face d="M25 50H202L207 55H30Z" opacity={0.16} />
      <Face d="M27 53H46V61H27Z" accent opacity={0.48} /><Face d="M109 53H128V61H109Z" accent opacity={0.48} /><Face d="M191 53H210V61H191Z" accent opacity={0.48} />
    </>;
  }
  if (variant === 'two-story') {
    return <>
      <Face d="M30 132H196L217 143 52 152 30 142Z" opacity={0.12} />
      <Face d="M48 36H63V133H48Z" opacity={0.28} /><Face d="M42 30 48 36V133L42 127Z" opacity={0.14} />
      <Face d="M179 36H194V133H179Z" opacity={0.28} /><Face d="M173 30 179 36V133L173 127Z" opacity={0.14} />
      <Face d="M48 36H194V49H48Z" opacity={0.3} /><Face d="M42 30H188L194 36H48Z" opacity={0.16} />
      <Face d="M48 78H194V91H48Z" opacity={0.3} /><Face d="M42 72H188L194 78H48Z" opacity={0.16} />
      <Face d="M45 76H66V85H45Z" accent opacity={0.5} /><Face d="M176 76H197V85H176Z" accent opacity={0.5} />
      <Face d="M45 34H66V43H45Z" accent opacity={0.5} /><Face d="M176 34H197V43H176Z" accent opacity={0.5} />
    </>;
  }
  return <>
    <Face d="M27 132H202L222 143 48 152 27 142Z" opacity={0.1} />
    <Face d="M40 76H54V132H40Z" opacity={0.32} /><Face d="M34 70 40 76V132L34 126Z" opacity={0.15} />
    <Face d="M188 76H202V132H188Z" opacity={0.32} /><Face d="M182 70 188 76V132L182 126Z" opacity={0.15} />
    <Face d="M40 76 116 28 125 39 49 87Z" opacity={0.34} /><Face d="M116 28 193 72 187 83 125 39Z" opacity={0.34} />
    <Face d="M34 70 110 22 116 28 40 76Z" opacity={0.16} /><Face d="M110 22 199 70 193 76 116 28Z" opacity={0.16} />
    <Face d="M37 72 57 78 53 88 36 83Z" accent opacity={0.55} /><Face d="M184 72 204 72 202 84 187 83Z" accent opacity={0.55} /><Face d="M110 25 124 32 121 43 108 35Z" accent opacity={0.55} />
    <Web paths={['M52 126 92 78M52 78l40 48', 'M150 78l38 48m0-48-38 48', 'M72 67 116 91 169 61']} />
  </>;
};

const BeamGeometry = ({ variant }: { variant: StructuralAssetVariantName }) => {
  const supports: Array<{ kind: SupportKind; x: number }> = [];
  if (variant === 'simply-supported') supports.push({ kind: 'pin', x: 45 }, { kind: 'roller', x: 195 });
  if (variant === 'two-span') supports.push({ kind: 'pin', x: 35 }, { kind: 'roller', x: 120 }, { kind: 'roller', x: 205 });
  if (variant === 'three-span') supports.push({ kind: 'pin', x: 25 }, { kind: 'roller', x: 88 }, { kind: 'roller', x: 152 }, { kind: 'roller', x: 215 });
  if (variant === 'overhang') {
    supports.push({ kind: 'pin', x: 65 }, { kind: 'roller', x: 170 });
  }
  const [beamStart, beamEnd] = variant === 'overhang' ? [20, 220] : [35, 205];
  return <>
    <PrismaticMember from={[beamStart, 70]} to={[beamEnd, 70]} thickness={11} depth={7} accent={variant === 'overhang'} />
    {supports.map((support) => <SupportGlyph key={`${support.kind}:${support.x}`} kind={support.kind} x={support.x} y={77} scale={0.72} />)}
    <Nodes points={supports.map(({ x }) => [x, 70] as const)} />
  </>;
};

const CantileverGeometry = ({ variant }: { variant: StructuralAssetVariantName }) => {
  if (variant === 'wall') {
    return <><SupportGlyph kind="fixed" x={46} y={78} scale={1.3} /><PrismaticMember from={[46, 78]} to={[205, 78]} thickness={12} depth={8} /><Nodes points={[[205, 78]]} /></>;
  }
  if (variant === 'double') {
    return <><PrismaticMember from={[24, 76]} to={[216, 76]} thickness={11} depth={7} /><PrismaticMember from={[120, 76]} to={[120, 128]} thickness={12} depth={7} /><Face d="M107 128h26l10 9H97Z" /><Nodes points={[[24, 76], [120, 76], [216, 76]]} /></>;
  }
  if (variant === 'stepped') {
    return <><SupportGlyph kind="fixed" x={38} y={92} scale={1.15} /><PrismaticMember from={[38, 92]} to={[104, 92]} thickness={11} /><PrismaticMember from={[104, 92]} to={[104, 68]} thickness={11} /><PrismaticMember from={[104, 68]} to={[164, 68]} thickness={11} /><PrismaticMember from={[164, 68]} to={[164, 46]} thickness={11} /><PrismaticMember from={[164, 46]} to={[214, 46]} thickness={11} /><Nodes points={[[104, 92], [104, 68], [164, 68], [164, 46], [214, 46]]} /></>;
  }
  return <><SupportGlyph kind="fixed" x={42} y={92} scale={1.15} /><Face d="M42 70 205 50l20 18L58 92Z" opacity={0.2} /><Web paths={['M58 92 42 70', 'M205 50l20 18', 'M95 65l17 18', 'M153 58l18 18']} /><Nodes points={[[42, 70], [58, 92], [205, 50], [225, 68]]} /></>;
};

const TrussGeometry = ({ variant }: { variant: StructuralAssetVariantName }) => {
  const bottom = <PrismaticMember from={[25, 118]} to={[215, 118]} thickness={7} depth={4.5} />;
  if (variant === 'pratt') {
    return <>{bottom}<PrismaticMember from={[25, 118]} to={[50, 58]} thickness={7} depth={4.5} /><PrismaticMember from={[50, 58]} to={[190, 58]} thickness={7} depth={4.5} /><PrismaticMember from={[190, 58]} to={[215, 118]} thickness={7} depth={4.5} /><Web paths={['M50 58V118M85 58V118M120 58V118M155 58V118M190 58V118', 'M50 58 85 118', 'M85 58 120 118', 'M190 58 155 118', 'M155 58 120 118']} /><Nodes points={[[25, 118], [50, 58], [85, 58], [120, 58], [155, 58], [190, 58], [215, 118], [50, 118], [85, 118], [120, 118], [155, 118], [190, 118]]} /></>;
  }
  if (variant === 'howe') {
    return <>{bottom}<PrismaticMember from={[25, 118]} to={[50, 58]} thickness={7} depth={4.5} /><PrismaticMember from={[50, 58]} to={[190, 58]} thickness={7} depth={4.5} /><PrismaticMember from={[190, 58]} to={[215, 118]} thickness={7} depth={4.5} /><Web paths={['M50 58V118M85 58V118M120 58V118M155 58V118M190 58V118', 'M50 118 85 58', 'M85 118 120 58', 'M190 118 155 58', 'M155 118 120 58']} /><Nodes points={[[25, 118], [50, 58], [85, 58], [120, 58], [155, 58], [190, 58], [215, 118], [50, 118], [85, 118], [120, 118], [155, 118], [190, 118]]} /></>;
  }
  if (variant === 'warren') {
    return <>{bottom}<PrismaticMember from={[25, 118]} to={[55, 62]} thickness={7} depth={4.5} /><PrismaticMember from={[55, 62]} to={[185, 62]} thickness={7} depth={4.5} /><PrismaticMember from={[185, 62]} to={[215, 118]} thickness={7} depth={4.5} /><Web paths={['M25 118 55 62l32 56 33-56 33 56 32-56 30 56']} /><Nodes points={[[25, 118], [55, 62], [87, 118], [120, 62], [153, 118], [185, 62], [215, 118]]} /></>;
  }
  return <>{bottom}<PrismaticMember from={[25, 118]} to={[120, 40]} thickness={7} depth={4.5} /><PrismaticMember from={[120, 40]} to={[215, 118]} thickness={7} depth={4.5} /><Web paths={['M120 40v78', 'M72 79l48 39m48-39-48 39']} /><Nodes points={[[25, 118], [72, 79], [120, 40], [168, 79], [215, 118]]} /></>;
};

const SlabGeometry = ({ variant }: { variant: StructuralAssetVariantName }) => {
  const outline = <Face d="M35 58 166 35l42 55-132 28Z" opacity={0.18} />;
  if (variant === 'one-way') {
    return <>{outline}<Web paths={['M55 55l42 55', 'M82 50l42 54', 'M109 45l42 54', 'M136 40l42 53']} /><Members paths={['M76 118v20', 'M208 90v20']} /></>;
  }
  if (variant === 'two-way') {
    return <>{outline}<Web paths={['M55 55l42 55', 'M82 50l42 54', 'M109 45l42 54', 'M136 40l42 53', 'M46 72l132-25', 'M58 88l132-26', 'M69 103l132-26']} /></>;
  }
  if (variant === 'waffle') {
    return <>{outline}<Web paths={['M50 55l42 55', 'M74 51l42 54', 'M98 47l42 53', 'M122 43l42 52', 'M146 39l42 51', 'M42 68l132-24', 'M51 80l132-25', 'M61 92l132-25', 'M70 104l132-26']} /><Face d="M75 118 207 90v10L77 130Z" opacity={0.1} /></>;
  }
  return <>{outline}<Members paths={['M64 105v32', 'M184 80v32', 'M52 74v31', 'M170 49v31']} /><Face d="M56 132h17l6 5H50Z" /><Face d="M176 107h17l6 5h-29Z" /><Face d="M44 100h17l6 5H38Z" /><Face d="M162 75h17l6 5h-29Z" /></>;
};

const SpaceFrameGeometry = ({ variant }: { variant: StructuralAssetVariantName }) => {
  if (variant === 'single-module') {
    return <><Members paths={['M48 126V62L118 42l68 34v62', 'M48 62l68 34 70-20', 'M116 96v42', 'M48 126l68 18 70-6']} /><Nodes points={[[48, 62], [118, 42], [186, 76], [116, 96]]} /></>;
  }
  if (variant === 'multi-bay') {
    return <><Members paths={['M24 128V72L94 52l70 30v56', 'M94 52l48-16 72 28v56', 'M24 72l70 28 70-18 50 20', 'M94 100v38', 'M164 82v56', 'M142 36v102', 'M24 128l70 18 70-8 50-18']} /><Web paths={['M58 62v75', 'M129 66v76', 'M178 50v79']} /><Nodes points={[[24, 72], [94, 52], [142, 36], [164, 82], [214, 64]]} /></>;
  }
  if (variant === 'two-story') {
    return <><Members paths={['M42 138V45', 'M116 22v120', 'M194 57v82', 'M42 45l74-23 78 35', 'M42 87l74-21 78 31', 'M42 138l74-17 78 18', 'M116 66v76']} /><Web paths={['M42 45l74 21 78-9', 'M42 87l74 34 78-24']} /><Nodes points={[[42, 45], [116, 22], [194, 57], [42, 87], [116, 66], [194, 97]]} /></>;
  }
  return <><Members paths={['M30 136V78L80 44l44 20 42-31 48 30v73', 'M30 78l50 18 44-32 42 28 48-29', 'M80 96v40', 'M124 64v72', 'M166 92v44']} accent /><Web paths={['M50 64l30 32', 'M102 54l22 10', 'M145 48l21 44', 'M190 48l24 15']} /><Nodes points={[[30, 78], [80, 44], [124, 64], [166, 33], [214, 63]]} /></>;
};

const SupportGeometry = ({ variant }: { variant: StructuralAssetVariantName }) => {
  if (variant === 'pin') return <><Members paths={['M48 55H192']} /><SupportGlyph kind="pin" x={120} y={55} scale={1.6} /></>;
  if (variant === 'roller') return <><Members paths={['M48 48H192']} /><SupportGlyph kind="roller" x={120} y={48} scale={1.55} /></>;
  if (variant === 'fixed') return <><SupportGlyph kind="fixed" x={68} y={82} scale={1.7} /><Members paths={['M68 82H205']} /><Nodes points={[[205, 82]]} /></>;
  return <><Members paths={['M55 38H185']} /><SupportGlyph kind="spring" x={120} y={38} scale={1.55} /></>;
};

const Arrow = ({ x, y1, y2 }: { x: number; y1: number; y2: number }) => (
  <g className="structural-illustration__load" data-element="load">
    <path d={`M${x} ${y1}V${y2}`} fill="none" stroke={accentColor} strokeLinecap="round" strokeWidth="3.5" />
    <path d={`m${x - 7} ${y2 - 9} 7 9 7-9`} fill="none" stroke={accentColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" />
  </g>
);

const LoadGeometry = ({ variant }: { variant: StructuralAssetVariantName }) => {
  if (variant === 'point') return <><Members paths={['M32 112H208']} /><Arrow x={120} y1={25} y2={103} /><Nodes points={[[120, 112]]} /></>;
  if (variant === 'distributed') return <><Members paths={['M26 118H214']} /><Web paths={['M42 36H198']} />{[42, 81, 120, 159, 198].map((x) => <Arrow key={x} x={x} y1={36} y2={109} />)}</>;
  if (variant === 'varying') return <><Members paths={['M26 122H214']} /><path d="M38 105 198 30" fill="none" stroke={accentColor} strokeWidth="3" />{[[38, 105], [78, 86], [118, 68], [158, 49], [198, 30]].map(([x, y]) => <Arrow key={x} x={x} y1={y} y2={113} />)}</>;
  return <><Members paths={['M42 118H198']} /><path className="structural-illustration__load" data-element="load" d="M167 78a54 54 0 1 0-52 39" fill="none" stroke={accentColor} strokeLinecap="round" strokeWidth="5" /><path d="m105 105 10 12 14-8" fill="none" stroke={accentColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" /><Nodes points={[[120, 118]]} /></>;
};

const SectionGeometry = ({ variant }: { variant: StructuralAssetVariantName }) => {
  if (variant === 'rectangular') return <><Face d="M66 28H174V132H66Z" opacity={0.22} /><Web paths={['M82 44h76v72H82Z']} /></>;
  if (variant === 'circular') return <><circle className="structural-illustration__face" data-element="section" cx="120" cy="80" r="55" fill={primaryColor} fillOpacity="0.18" stroke={lineColor} strokeWidth="3" /><circle cx="120" cy="80" r="39" fill="none" stroke={secondaryColor} strokeWidth="2" /></>;
  if (variant === 'i-profile') return <><Face d="M52 30H188V54H137V106H188V130H52V106H103V54H52Z" opacity={0.2} /><Web paths={['M103 54h34', 'M103 106h34']} /></>;
  return <><Face d="M54 27H186V133H54ZM80 52V108H160V52Z" opacity={0.2} /><Nodes points={[[54, 27], [186, 27], [186, 133], [54, 133]]} /></>;
};

const Bolt = ({ cx, cy }: { cx: number; cy: number }) => <circle className="structural-illustration__bolt" data-element="fastener" cx={cx} cy={cy} r="4" fill={accentColor} stroke={lineColor} strokeWidth="1.5" />;

const ConnectionGeometry = ({ variant }: { variant: StructuralAssetVariantName }) => {
  if (variant === 'rigid') return <><Members paths={['M76 136V25', 'M76 75H210']} /><Face d="M66 57h30v37H66Z" accent opacity={0.22} /><Bolt cx={74} cy={66} /><Bolt cx={88} cy={66} /><Bolt cx={74} cy={84} /><Bolt cx={88} cy={84} /></>;
  if (variant === 'pinned') return <><Members paths={['M72 136V25', 'M72 76H210']} /><Face d="M68 61h24v30H68Z" accent opacity={0.18} /><Bolt cx={80} cy={76} /><path d="M92 62v28" fill="none" stroke={accentColor} strokeWidth="3" /></>;
  if (variant === 'base-plate') return <><Members paths={['M120 25V112']} /><Face d="M76 108H164L181 125H59Z" accent opacity={0.22} /><Bolt cx={78} cy={117} /><Bolt cx={162} cy={117} /><Ground x1={45} x2={195} y={132} /></>;
  return <><Members paths={['M28 80H212']} /><Face d="M92 56h56v48H92Z" accent opacity={0.18} /><Bolt cx={104} cy={68} /><Bolt cx={136} cy={68} /><Bolt cx={104} cy={92} /><Bolt cx={136} cy={92} /><path d="M120 52v56" fill="none" stroke={secondaryColor} strokeDasharray="5 4" strokeWidth="2" /></>;
};

const DetailOverlay = ({ detail }: { detail: StructuralAssetDetail }) => (
  <>
    {detail !== 'compact' ? (
      <g className="structural-illustration__detail" data-asset-detail="card" opacity="0.55">
        <path d="M24 145H216" fill="none" stroke={secondaryColor} strokeDasharray="3 5" strokeWidth="1.5" />
      </g>
    ) : null}
    {detail === 'hero' ? (
      <g className="structural-illustration__detail" data-asset-detail="hero" opacity="0.7">
        <path d="M25 137V119M25 137h18" fill="none" stroke={accentColor} strokeWidth="2" />
        <circle cx="25" cy="137" r="3" fill={accentColor} stroke="none" />
      </g>
    ) : null}
  </>
);

export const StructuralAssetGeometry = ({
  family,
  variant,
  detail,
}: {
  family: StructuralAssetFamily;
  variant: StructuralAssetVariantName;
  detail: StructuralAssetDetail;
}) => (
  <>
    <g
      className={`structural-illustration__geometry structural-illustration__geometry--${family}`}
      data-structural-geometry={`${family}:${variant}`}
    >
      {family === 'portal' ? <PortalGeometry variant={variant} /> : null}
      {family === 'beam' ? <BeamGeometry variant={variant} /> : null}
      {family === 'cantilever' ? <CantileverGeometry variant={variant} /> : null}
      {family === 'truss' ? <TrussGeometry variant={variant} /> : null}
      {family === 'slab' ? <SlabGeometry variant={variant} /> : null}
      {family === 'space-frame' ? <SpaceFrameGeometry variant={variant} /> : null}
      {family === 'support' ? <SupportGeometry variant={variant} /> : null}
      {family === 'load' ? <LoadGeometry variant={variant} /> : null}
      {family === 'section' ? <SectionGeometry variant={variant} /> : null}
      {family === 'connection' ? <ConnectionGeometry variant={variant} /> : null}
    </g>
    <DetailOverlay detail={detail} />
  </>
);
