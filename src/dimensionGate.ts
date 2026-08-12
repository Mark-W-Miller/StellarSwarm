import {
  AmbientLight,
  ArrowHelper,
  BufferGeometry,
  Color,
  BoxGeometry,
  CylinderGeometry,
  EdgesGeometry,
  DirectionalLight,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer
} from "three";
import settings from "./settings.json";
import { CameraController } from "./ui/camera";
import { createDimGateUI } from "./dimGateWindow";

function requireElement<T extends Element>(selector: string): T {
  const el = document.querySelector(selector);
  if (!el) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return el as T;
}

function createAxisArrows(length: number) {
  const group = new Group();
  const origin = new Vector3(0, 0, 0);
  const headLength = Math.max(4, length * 0.06);
  const headWidth = headLength * 0.4;

  const arrows: { dir: Vector3; color: number }[] = [
    { dir: new Vector3(1, 0, 0), color: 0xff4d4d },
    { dir: new Vector3(-1, 0, 0), color: 0x7f1d1d },
    { dir: new Vector3(0, 1, 0), color: 0x4ade80 },
    { dir: new Vector3(0, -1, 0), color: 0x166534 },
    { dir: new Vector3(0, 0, 1), color: 0x60a5fa },
    { dir: new Vector3(0, 0, -1), color: 0x1e3a8a }
  ];

  arrows.forEach(({ dir, color }) => {
    const arrow = new ArrowHelper(dir.normalize(), origin, length, color, headLength, headWidth);
    group.add(arrow);
  });

  return group;
}

function createBeamBetween(start: Vector3, end: Vector3, thickness: number, material: MeshStandardMaterial) {
  const dir = new Vector3().subVectors(end, start);
  const len = dir.length();
  const geometry = new BoxGeometry(len, thickness, thickness);
  const mesh = new Mesh(geometry, material);
  const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5);
  mesh.position.copy(mid);
  const dirNorm = dir.clone().normalize();
  mesh.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), dirNorm);
  return mesh;
}

type GateParams = {
  numColumns: number;
  baseRadius: number;
  baseThickness: number;
  columnStartAngle: number;
  columnRadius: number;
  columnHeight: number;
  columnRingRadius: number;
  ringThickness: number;
  spokeRadius: number;
  whiteBallRadius: number;
  colorBallRadius: number;
  columnColors: string[];
};

const defaultParams: GateParams = {
  numColumns: 8,
  baseRadius: 10,
  baseThickness: 0.5,
  columnStartAngle: 0,
  columnRadius: 0.5,
  columnHeight: 7,
  columnRingRadius: 9.5,
  ringThickness: 0.3,
  spokeRadius: 0.2,
  whiteBallRadius: 1,
  colorBallRadius: 0.7,
  columnColors: [
    "#ff4d4f",
    "#ff8c42",
    "#ffd147",
    "#22c55e",
    "#3b82f6",
    "#6366f1",
    "#a855f7",
    "#ec4899"
  ]
};

function createPieBaseFromColumns(
  tops: Vector3[],
  params: GateParams,
  material: MeshStandardMaterial,
  outlineMaterial: LineBasicMaterial
) {
  const group = new Group();
  if (!tops.length) return group;

  const twoPi = Math.PI * 2;
  const norm = (a: number) => {
    let v = a % twoPi;
    if (v < 0) v += twoPi;
    return v;
  };

  const angles = tops.map((v) => norm(Math.atan2(v.z, v.x)));
  angles.sort((a, b) => a - b);

  const startAngle = norm(params.columnStartAngle);
  let startIdx = 0;
  let minDiff = Number.POSITIVE_INFINITY;
  angles.forEach((a, idx) => {
    const diff = Math.min(norm(a - startAngle), norm(startAngle - a));
    if (diff < minDiff) {
      minDiff = diff;
      startIdx = idx;
    }
  });

  const ordered = angles.slice(startIdx).concat(angles.slice(0, startIdx));
  ordered.push(ordered[0] + twoPi);

  for (let i = 0; i < ordered.length - 1; i += 1) {
    const thetaStart = ordered[i];
    const thetaLength = ordered[i + 1] - ordered[i];

    // Wedge geometry for this slice.
    const geometry = new CylinderGeometry(
      params.baseRadius,
      params.baseRadius,
      params.baseThickness,
      64,
      1,
      false,
      thetaStart,
      thetaLength
    );
    // Slice mesh; place on ground plane.
    const slice = new Mesh(geometry, material);
    slice.position.set(0, -params.baseThickness / 2, 0);
    group.add(slice);

    // Silver outline along the slice edges.
    const edges = new EdgesGeometry(geometry);
    const outline = new LineSegments(edges, outlineMaterial);
    outline.position.copy(slice.position);
    outline.rotation.copy(slice.rotation);
    group.add(outline);

    // Baseline across the outer edge of the slice.
    const p1 = new Vector3(
      params.baseRadius * Math.cos(thetaStart),
      -params.baseThickness / 2,
      params.baseRadius * Math.sin(thetaStart)
    );
    const p2 = new Vector3(
      params.baseRadius * Math.cos(thetaStart + thetaLength),
      -params.baseThickness / 2,
      params.baseRadius * Math.sin(thetaStart + thetaLength)
    );
    const baseLineGeometry = new BufferGeometry().setFromPoints([p1, p2]);
    const baseLine = new LineSegments(baseLineGeometry, outlineMaterial);
    group.add(baseLine);
  }
  return group;
}

function createTopRim(tops: Vector3[], params: GateParams, material: MeshStandardMaterial) {
  const rim = new Group();
  const thickness = params.ringThickness;
  for (let i = 0; i < tops.length; i += 1) {
    const a = tops[i];
    const b = tops[(i + 1) % tops.length];
    const beam = createBeamBetween(a, b, thickness, material);
    rim.add(beam);
  }
  return rim;
}

function createColumns(params: GateParams, material: MeshStandardMaterial) {
  const columns: Mesh[] = [];
  const tops: Vector3[] = [];
  for (let i = 0; i < params.numColumns; i += 1) {
    const angle = params.columnStartAngle + (2 * Math.PI * i) / params.numColumns;
    const colX = params.columnRingRadius * Math.cos(angle);
    const colZ = params.columnRingRadius * Math.sin(angle);
    const colY = params.columnHeight / 2;
    const geometry = new CylinderGeometry(params.columnRadius, params.columnRadius, params.columnHeight, 32, 1, false);
    const column = new Mesh(geometry, material);
    column.position.set(colX, colY, colZ);
    columns.push(column);
    tops.push(new Vector3(colX, params.columnHeight, colZ));
  }
  return { columns, tops };
}

function createBeams(tops: Vector3[], params: GateParams, material: MeshStandardMaterial) {
  const thickness = params.spokeRadius * 2;
  return tops.map((top) =>
    createBeamBetween(new Vector3(0, params.columnHeight, 0), top, thickness, material)
  );
}

function createCenterBall(params: GateParams, material: MeshStandardMaterial) {
  const geometry = new SphereGeometry(params.whiteBallRadius, 32, 16);
  const sphere = new Mesh(geometry, material);
  sphere.position.set(0, params.columnHeight + 2 * params.whiteBallRadius, 0);
  return sphere;
}

function createColorBalls(tops: Vector3[], params: GateParams) {
  return tops.map((top, i) => {
    const color = params.columnColors[i % params.columnColors.length];
    const material = new MeshStandardMaterial({
      color: new Color(color),
      emissive: new Color(color),
      emissiveIntensity: 0.7,
      metalness: 0.15,
      roughness: 0.3
    });
    const geometry = new SphereGeometry(params.colorBallRadius, 32, 16);
    const sphere = new Mesh(geometry, material);
    sphere.position.set(top.x, top.y + params.colorBallRadius, top.z);
    return sphere;
  });
}

function buildGate() {
  const group = new Group();
  const params = defaultParams;

  const metalMaterial = new MeshStandardMaterial({
    color: new Color("#2c3444"),
    metalness: 0.6,
    roughness: 0.3
  });
  const columnMaterial = metalMaterial.clone();
  columnMaterial.emissive = new Color("#4b5563");
  columnMaterial.emissiveIntensity = 0.55;
  const silverOutline = new LineBasicMaterial({
    color: new Color("#cdd6df"),
    linewidth: 1
  });
  const beamMaterial = metalMaterial.clone();
  beamMaterial.color = new Color("#b7c2cf");
  beamMaterial.emissive = new Color("#b7c2cf");
  beamMaterial.emissiveIntensity = 0.35;

  const emissiveWhite = new MeshStandardMaterial({
    color: new Color("#ffffff"),
    emissive: new Color("#ffffff"),
    emissiveIntensity: 1.0,
    roughness: 0.25,
    metalness: 0.1
  });

  const { columns, tops } = createColumns(params, columnMaterial);
  const rim = createTopRim(tops, params, beamMaterial);
  const spokes = createBeams(tops, params, beamMaterial);
  const colorBalls = createColorBalls(tops, params);
  const base = createPieBaseFromColumns(tops, params, metalMaterial, silverOutline);

  group.add(base, rim, ...columns, ...spokes, ...colorBalls);
  return group;
}

export function startDimensionGate() {
  const stage3d = requireElement<HTMLDivElement>("#stage-3d");
  const stage2d = requireElement<HTMLCanvasElement>("#stage-2d");
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(stage3d.clientWidth, stage3d.clientHeight);
  renderer.setClearColor(new Color("#040813"));
  stage3d.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, stage3d.clientWidth / stage3d.clientHeight, 0.1, 2000);
  const bounds = new Vector3(200, 200, 200);
  const cameraSettings = {
    ...settings.camera,
    radius: 24,
    minRadius: 4,
    maxRadius: 120,
    panSpeed: 6,
    rotationSpeed: 2.5,
    dragSensitivity: 0.003
  };
  const controller = new CameraController(camera, stage3d, cameraSettings, bounds);
  controller.setPosition(new Vector3(0, 8, 20), new Vector3(0, 0, 0));

  const ambient = new AmbientLight(0xffffff, 0.4);
  const keyLight = new DirectionalLight(0xffffff, 0.9);
  keyLight.position.set(18, 24, 16);
  scene.add(ambient, keyLight);

  const axisLength = 48;
  const axisGroup = createAxisArrows(axisLength);
  axisGroup.visible = false;
  scene.add(axisGroup);

  createDimGateUI("/dim-gate");

  const gate = buildGate();
  scene.add(gate);

  function resize() {
    const rect = stage3d.getBoundingClientRect();
    const { width, height } = rect;
    const dpr = window.devicePixelRatio || 1;
    stage2d.width = width;
    stage2d.height = height;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = `${width}px`;
    renderer.domElement.style.height = `${height}px`;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  resize();
  window.addEventListener("resize", resize);
  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(stage3d);

  let lastTime = performance.now();
  function renderFrame(now: number) {
    const delta = (now - lastTime) / 1000;
    lastTime = now;
    controller.update(delta);
    renderer.render(scene, camera);
    requestAnimationFrame(renderFrame);
  }

  requestAnimationFrame(renderFrame);
}
