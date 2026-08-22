/**
 * Viewport Three.js de Space 3D.
 *
 * Reglas visuales heredadas del brandbook: **el dibujo estructural es plano**.
 * Nada de clay, brillos ni materiales físicos sobre la geometría; el volumen
 * táctil vive en los controles de la interfaz, no en el modelo. Aquí sólo hay
 * líneas nítidas, colores con significado técnico fijo y una rejilla que sitúa
 * el plano de suelo sin competir con la estructura.
 *
 * Los colores se leen de los tokens del sistema en tiempo de ejecución, de modo
 * que el tema Día/Noche del producto gobierna también la escena.
 *
 * Render bajo demanda: no hay bucle de animación. Un marco espacial estático no
 * cambia entre fotogramas, y mantener la GPU despierta sólo gasta batería.
 */
// Importaciones nombradas, no `import * as THREE`: el paquete `three` exporta
// cientos de clases (geometrías, loaders, curvas, animación...) que este
// visor nunca toca, y una importación de espacio de nombres completo le
// impide al bundler descartar lo que no se usa.
import {
  ArrowHelper, BoxGeometry, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute,
  GridHelper, Group, LineBasicMaterial, LineDashedMaterial, LineSegments, MathUtils, Mesh,
  MeshBasicMaterial, PerspectiveCamera, Points, PointsMaterial, Raycaster, Scene, Sprite,
  SpriteMaterial, Vector2, Vector3, WebGLRenderer,
  type Camera, type Material, type Object3D,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { computeSpace3DCameraPlacement, type Space3DViewPreset } from './cameraModel';
import type { Space3DSceneModel } from './sceneModel';
import type { Space3DSelection } from '../store/Space3DProjectContext';


export const SPACE3D_SCENE_LAYERS = Object.freeze([
  'grid', 'world-axes', 'members', 'nodes', 'supports', 'loads', 'local-axes', 'deformed', 'labels',
] as const);
export type Space3DSceneLayer = (typeof SPACE3D_SCENE_LAYERS)[number];

export interface Space3DLayerVisibility {
  readonly grid: boolean;
  readonly loads: boolean;
  readonly supports: boolean;
  readonly labels: boolean;
  readonly deformed: boolean;
}

export const SPACE3D_DEFAULT_LAYERS: Space3DLayerVisibility = Object.freeze({
  grid: true, loads: true, supports: true, labels: true, deformed: true,
});

export interface Space3DRendererLike {
  setPixelRatio(value: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: Scene, camera: Camera): void;
  dispose(): void;
  forceContextLoss?(): void;
}

export interface Space3DControlsLike {
  target: Vector3;
  enableDamping: boolean;
  update(): void;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
  dispose(): void;
}

export interface Space3DViewportOptions {
  readonly canvas: HTMLCanvasElement;
  readonly model: Space3DSceneModel;
  readonly layers?: Space3DLayerVisibility;
  readonly initialView?: Space3DViewPreset;
  readonly createRenderer?: (canvas: HTMLCanvasElement) => Space3DRendererLike;
  readonly createControls?: (camera: PerspectiveCamera, canvas: HTMLCanvasElement) => Space3DControlsLike;
}

export interface Space3DViewport {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly controlsTarget: Vector3;
  setModel(model: Space3DSceneModel): void;
  setLayers(layers: Space3DLayerVisibility): void;
  setView(preset: Space3DViewPreset): void;
  zoomBy(factor: number): void;
  resize(): void;
  render(): void;
  requestRender(): void;
  pickAt(offsetX: number, offsetY: number): Space3DSelection | null;
  dispose(): void;
}

/**
 * Paleta técnica. Los valores por defecto son los tokens del sistema; en el
 * navegador se sobreescriben con el valor calculado.
 *
 * Los roles técnicos y de selección ya no tienen "valor de Día": desde el
 * cierre cromático son el mismo HEX en ambos temas, así que el respaldo es el
 * valor real y no una aproximación clara. Sólo los neutros (miembro, nodo,
 * rejilla, etiqueta) siguen siendo los de Día.
 *
 * `axisY` usa el TRAZO de marca, no el relleno: el relleno lima mide 1,8:1
 * contra el lienzo claro y un eje pintado con él desaparecería.
 */
const TOKEN_COLORS = {
  member: ['--sc-color-canvas-member', '#23312c'],
  memberSelected: ['--sc-color-selection-stroke', '#6a5df2'],
  node: ['--sc-color-text-primary', '#23312c'],
  nodeSelected: ['--sc-color-selection-stroke', '#6a5df2'],
  support: ['--sc-color-technical-reaction', '#3a72e3'],
  load: ['--sc-color-technical-load', '#3a72e3'],
  moment: ['--sc-color-technical-moment', '#ed4b46'],
  deformed: ['--sc-color-technical-deformed', '#8b5cf6'],
  grid: ['--sc-color-canvas-grid', '#e8e1d7'],
  gridStrong: ['--sc-color-canvas-grid-strong', '#d9d0c4'],
  axisX: ['--sc-color-technical-axis', '#ad5e18'],
  axisY: ['--sc-color-action-ink', '#468c09'],
  axisZ: ['--sc-color-brand-secondary', '#0f95d1'],
  label: ['--sc-color-text-secondary', '#607068'],
} as const;

type ColorRole = keyof typeof TOKEN_COLORS;

const readPalette = (): Record<ColorRole, Color> => {
  let computed: CSSStyleDeclaration | null = null;
  try {
    computed = typeof document === 'undefined' ? null : getComputedStyle(document.documentElement);
  } catch {
    computed = null;
  }
  const entries = Object.entries(TOKEN_COLORS).map(([role, [token, fallback]]) => {
    const raw = computed?.getPropertyValue(token).trim();
    let color: Color;
    try {
      color = new Color(raw && raw.length > 0 ? raw : fallback);
    } catch {
      color = new Color(fallback);
    }
    return [role, color] as const;
  });
  return Object.fromEntries(entries) as Record<ColorRole, Color>;
};

const positionsOf = (segments: readonly { start: readonly number[]; end: readonly number[] }[]): number[] =>
  segments.flatMap((segment) => [...segment.start, ...segment.end]);

const lineGeometry = (values: readonly number[]): BufferGeometry => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(values.length > 0 ? [...values] : [], 3));
  return geometry;
};

/**
 * Etiqueta como sprite de textura. Devuelve `null` cuando el entorno no ofrece
 * un contexto 2D (jsdom, algunos webviews): el visor sigue siendo usable sin
 * texto y no se cae por un accesorio.
 */
let labelsSupported: boolean | null = null;

const makeLabel = (text: string, color: Color, size: number): Sprite | null => {
  if (typeof document === 'undefined' || labelsSupported === false) return null;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  // Se sondea una sola vez: sin contexto 2D no habrá etiquetas en toda la
  // sesión, y volver a preguntarlo por cada nudo sólo genera ruido.
  labelsSupported = context !== null;
  if (!context) return null;
  const scale = 128;
  canvas.width = scale;
  canvas.height = scale / 2;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = '600 44px "IBM Plex Mono", ui-monospace, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = `#${color.getHexString()}`;
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(size * 2, size, 1);
  return sprite;
};

export const createSpace3DViewport = (options: Space3DViewportOptions): Space3DViewport => {
  const { canvas } = options;
  let model = options.model;
  let layers = options.layers ?? SPACE3D_DEFAULT_LAYERS;
  const palette = readPalette();

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 1_000);
  const renderer = (options.createRenderer ?? defaultRenderer)(canvas);
  const controls = (options.createControls ?? defaultControls)(camera, canvas);
  controls.enableDamping = false;

  renderer.setPixelRatio(Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2));

  const groups = new Map<Space3DSceneLayer, Group>();
  for (const name of SPACE3D_SCENE_LAYERS) {
    const group = new Group();
    group.name = name;
    groups.set(name, group);
    scene.add(group);
  }

  // Índices paralelos: el picking traduce el vértice tocado a un identificador
  // de dominio sin buscar por coordenadas ni por tolerancias inventadas.
  let nodeIds: string[] = [];
  let memberIds: string[] = [];
  let nodePoints: Points | null = null;
  let memberLines: LineSegments | null = null;

  let disposed = false;
  let frame = 0;

  const render = () => {
    if (disposed) return;
    renderer.render(scene, camera);
  };

  const requestRender = () => {
    if (disposed || frame !== 0) return;
    frame = requestAnimationFrame(() => { frame = 0; render(); });
  };

  const clearGroup = (name: Space3DSceneLayer) => {
    const group = groups.get(name)!;
    for (const child of [...group.children]) {
      group.remove(child);
      disposeObject(child);
    }
  };

  const buildStatic = () => {
    // Rejilla en el plano de suelo XZ. Three la orienta ya en ese plano, que es
    // el correcto con Y vertical: no hay que rotarla como en un visor planar.
    const gridGroup = groups.get('grid')!;
    const size = Math.max(model.bounds.span * 3, 12);
    const divisions = 24;
    const grid = new GridHelper(size, divisions, palette.gridStrong, palette.grid);
    grid.position.set(model.bounds.center[0], model.bounds.min[1], model.bounds.center[2]);
    (grid.material as Material).transparent = true;
    (grid.material as Material).opacity = 0.75;
    gridGroup.add(grid);

    const axesGroup = groups.get('world-axes')!;
    const axisLength = Math.max(model.bounds.span * 0.28, 1);
    const origin = new Vector3(model.bounds.min[0], model.bounds.min[1], model.bounds.min[2]);
    const axes: [Vector3, Color, string][] = [
      [new Vector3(1, 0, 0), palette.axisX, 'X'],
      [new Vector3(0, 1, 0), palette.axisY, 'Y'],
      [new Vector3(0, 0, 1), palette.axisZ, 'Z'],
    ];
    for (const [direction, color, letter] of axes) {
      axesGroup.add(new ArrowHelper(direction, origin, axisLength, color, axisLength * 0.18, axisLength * 0.1));
      const label = makeLabel(letter, color, axisLength * 0.22);
      if (label) {
        label.position.copy(origin).addScaledVector(direction, axisLength * 1.14);
        axesGroup.add(label);
      }
    }
  };

  const buildModel = () => {
    for (const name of ['members', 'nodes', 'supports', 'loads', 'local-axes', 'deformed', 'labels'] as const) clearGroup(name);

    const span = model.bounds.span;

    memberIds = model.members.map((member) => member.id);
    const memberGeometry = lineGeometry(positionsOf(model.members));
    const colors: number[] = [];
    for (const member of model.members) {
      const color = member.selected ? palette.memberSelected : palette.member;
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }
    memberGeometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    memberLines = new LineSegments(memberGeometry, new LineBasicMaterial({ vertexColors: true }));
    memberLines.name = 'member-lines';
    groups.get('members')!.add(memberLines);

    nodeIds = model.nodes.map((node) => node.id);
    const nodeGeometry = lineGeometry([]);
    nodeGeometry.setAttribute('position', new Float32BufferAttribute(model.nodes.flatMap((node) => [...node.position]), 3));
    nodeGeometry.setAttribute('color', new Float32BufferAttribute(model.nodes.flatMap((node) => {
      const color = node.selected ? palette.nodeSelected : palette.node;
      return [color.r, color.g, color.b];
    }), 3));
    nodePoints = new Points(nodeGeometry, new PointsMaterial({
      size: Math.max(span * 0.022, 0.05), sizeAttenuation: true, vertexColors: true,
    }));
    nodePoints.name = 'node-points';
    groups.get('nodes')!.add(nodePoints);

    // Apoyo: un prisma bajo el nudo, orientado al suelo. Un empotramiento se
    // dibuja lleno; un apoyo parcial, en alambre — la forma distingue el tipo
    // sin depender del color.
    const supportsGroup = groups.get('supports')!;
    const supportSize = Math.max(span * 0.035, 0.08);
    for (const support of model.supports) {
      const geometry = new BoxGeometry(supportSize * 2, supportSize, supportSize * 2);
      const material = new MeshBasicMaterial({
        color: palette.support,
        wireframe: !support.fullyFixed,
        transparent: true,
        opacity: support.fullyFixed ? 0.55 : 0.9,
      });
      const mesh = new Mesh(geometry, material);
      mesh.position.set(support.position[0], support.position[1] - supportSize * 0.75, support.position[2]);
      supportsGroup.add(mesh);
    }

    const loadsGroup = groups.get('loads')!;
    const loadLength = Math.max(span * 0.18, 0.3);
    for (const load of model.loads) {
      const direction = new Vector3(...load.direction);
      const length = loadLength * (0.45 + 0.55 * load.relative);
      const color = load.kind === 'force' ? palette.load : palette.moment;
      // La flecha apunta hacia el nudo: el vector nace fuera y termina donde actúa.
      const tail = new Vector3(...load.origin).addScaledVector(direction, -length);
      loadsGroup.add(new ArrowHelper(direction, tail, length, color, length * 0.26, length * 0.14));
      if (load.kind === 'moment') {
        // Doble punta: la convención de la regla de la mano derecha.
        const second = new Vector3(...load.origin).addScaledVector(direction, -length * 0.72);
        loadsGroup.add(new ArrowHelper(direction, second, length * 0.72, color, length * 0.26, length * 0.14));
      }
    }

    const axesGroup = groups.get('local-axes')!;
    if (model.localAxes) {
      const origin = new Vector3(...model.localAxes.origin);
      const length = Math.max(model.localAxes.length, span * 0.06);
      const triad: [readonly number[], Color, string][] = [
        [model.localAxes.basis.x, palette.axisX, 'x'],
        [model.localAxes.basis.y, palette.axisY, 'y'],
        [model.localAxes.basis.z, palette.axisZ, 'z'],
      ];
      for (const [vector, color, letter] of triad) {
        const direction = new Vector3(vector[0], vector[1], vector[2]).normalize();
        axesGroup.add(new ArrowHelper(direction, origin, length, color, length * 0.22, length * 0.12));
        const label = makeLabel(letter, color, length * 0.3);
        if (label) {
          label.position.copy(origin).addScaledVector(direction, length * 1.16);
          axesGroup.add(label);
        }
      }
    }

    const deformedGroup = groups.get('deformed')!;
    if (model.deformed) {
      const geometry = lineGeometry(positionsOf(model.deformed.members));
      const line = new LineSegments(geometry, new LineDashedMaterial({
        color: palette.deformed, dashSize: Math.max(span * 0.03, 0.05), gapSize: Math.max(span * 0.018, 0.03),
      }));
      line.computeLineDistances();
      deformedGroup.add(line);
    }

    const labelsGroup = groups.get('labels')!;
    const labelSize = Math.max(span * 0.05, 0.12);
    for (const node of model.nodes) {
      const label = makeLabel(node.id, palette.label, labelSize);
      if (!label) break;
      label.position.set(node.position[0], node.position[1] + labelSize * 0.9, node.position[2]);
      labelsGroup.add(label);
    }

    applyLayers();
  };

  const applyLayers = () => {
    groups.get('grid')!.visible = layers.grid;
    groups.get('loads')!.visible = layers.loads;
    groups.get('supports')!.visible = layers.supports;
    groups.get('labels')!.visible = layers.labels;
    groups.get('local-axes')!.visible = model.localAxes !== null;
    groups.get('deformed')!.visible = layers.deformed && model.deformed !== null;
  };

  const setView = (preset: Space3DViewPreset) => {
    const placement = computeSpace3DCameraPlacement(model.bounds, preset);
    camera.position.set(...placement.position);
    camera.up.set(...placement.up);
    camera.near = placement.near;
    camera.far = placement.far;
    camera.fov = placement.fovDegrees;
    camera.updateProjectionMatrix();
    controls.target.set(...placement.target);
    controls.update();
    camera.lookAt(controls.target);
    camera.updateMatrixWorld(true);
    render();
  };

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || 1);
    const height = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  };

  const zoomBy = (factor: number) => {
    const offset = camera.position.clone().sub(controls.target);
    const current = Math.max(offset.length(), 1e-4);
    const next = MathUtils.clamp(
      current * factor,
      Math.max(model.bounds.span * 0.05, 0.05),
      Math.max(model.bounds.span * 80, 80),
    );
    offset.setLength(next);
    camera.position.copy(controls.target).add(offset);
    camera.updateMatrixWorld(true);
    controls.update();
    render();
  };

  const raycaster = new Raycaster();
  const pointer = new Vector2();

  const pickAt = (offsetX: number, offsetY: number): Space3DSelection | null => {
    if (disposed) return null;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.clientWidth || 1;
    const height = rect.height || canvas.clientHeight || 1;
    pointer.set((offsetX / width) * 2 - 1, -(offsetY / height) * 2 + 1);
    if (Math.abs(pointer.x) > 1 || Math.abs(pointer.y) > 1) return null;

    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    const span = model.bounds.span;
    raycaster.params.Points.threshold = Math.max(span * 0.03, 0.06);
    raycaster.params.Line.threshold = Math.max(span * 0.015, 0.03);

    // El nudo gana al miembro cuando ambos caen bajo el puntero: es el objetivo
    // más pequeño y el que el usuario apunta deliberadamente.
    if (nodePoints) {
      const hit = raycaster.intersectObject(nodePoints, false)[0];
      if (hit?.index !== undefined && nodeIds[hit.index]) return { kind: 'node', id: nodeIds[hit.index] };
    }
    if (memberLines) {
      const hit = raycaster.intersectObject(memberLines, false)[0];
      if (hit?.index !== undefined) {
        const id = memberIds[Math.floor(hit.index / 2)];
        if (id) return { kind: 'member', id };
      }
    }
    return null;
  };

  const onControlsChange = () => requestRender();
  controls.addEventListener('change', onControlsChange);

  buildStatic();
  buildModel();
  setView(options.initialView ?? 'isometric');
  resize();

  return {
    scene,
    camera,
    get controlsTarget() { return controls.target; },
    setModel(next) {
      if (disposed) return;
      const boundsChanged = next.bounds.span !== model.bounds.span;
      model = next;
      buildModel();
      if (boundsChanged) {
        clearGroup('grid');
        clearGroup('world-axes');
        buildStatic();
      }
      requestRender();
    },
    setLayers(next) {
      if (disposed) return;
      layers = next;
      applyLayers();
      requestRender();
    },
    setView(preset) { if (!disposed) setView(preset); },
    zoomBy(factor) { if (!disposed) zoomBy(factor); },
    resize() { if (!disposed) resize(); },
    render() { render(); },
    requestRender,
    pickAt,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
      controls.removeEventListener('change', onControlsChange);
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      // Deliberadamente NO se llama a `forceContextLoss()`: mata el contexto
      // WebGL del `<canvas>`, y React vuelve a montar sobre ese mismo elemento
      // (StrictMode en desarrollo, y cualquier remontaje en producción). El
      // segundo renderer se encontraría un lienzo envenenado y la superficie
      // caería al fallback sin que falte nada. `renderer.dispose()` ya libera
      // programas, texturas y buffers; el contexto se va con el elemento.
    },
  };
};

const disposeObject = (root: Object3D) => {
  root.traverse((object) => {
    const holder = object as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
    };
    holder.geometry?.dispose();
    const material = holder.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material?.dispose();
  });
};

const defaultRenderer = (canvas: HTMLCanvasElement): Space3DRendererLike => {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  return renderer;
};

const defaultControls = (camera: PerspectiveCamera, canvas: HTMLCanvasElement): Space3DControlsLike => {
  const controls = new OrbitControls(camera, canvas);
  controls.screenSpacePanning = true;
  controls.enableDamping = false;
  return controls as unknown as Space3DControlsLike;
};
