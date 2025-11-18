import "./style.css";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer
} from "three";
import settings from "./settings.json";
import { ArenaAsset } from "./assets/arenaAsset";
import { createAxisAsset } from "./assets/axisAsset";
import { createArenaModel, tickArenaModel } from "./model/arenaModel";
import type { ArenaModel } from "./model/arenaModel";
import { CameraController } from "./ui/camera";
import { GameSim } from "./engine/sim";
import { LogOverlay } from "./ui/log/logOverlay";
import { logStartup } from "./ui/log/logger";
import type { StarModel } from "./model/starModel";
import { SceneInteraction } from "./ui/sceneInteraction";
import { StarInfoPanel } from "./ui/starInfo";

let rngSeed = Date.now();
function seedRand(seed: number) {
  rngSeed = seed >>> 0;
}
function rand() {
  rngSeed = (1664525 * rngSeed + 1013904223) >>> 0;
  return rngSeed / 0xffffffff;
}

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

function persistSetting(key: string, value: number) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("persistSetting failed", e);
  }
}

function readSetting(key: string, fallback: number) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return typeof v === "number" ? v : fallback;
  } catch {
    return fallback;
  }
}

function requireElement<T extends Element>(selector: string): T {
  const el = document.querySelector(selector);
  if (!el) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return el as T;
}

const stage3d = requireElement<HTMLDivElement>("#stage-3d");
const stage2d = requireElement<HTMLCanvasElement>("#stage-2d");

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(stage3d.clientWidth, stage3d.clientHeight);
renderer.setClearColor(new Color("#030712"));
stage3d.appendChild(renderer.domElement);

const scene = new Scene();
const camera = new PerspectiveCamera(60, stage3d.clientWidth / stage3d.clientHeight, 0.1, 5000);
const arenaModel = createArenaModel(settings.arena);
seedRand(Date.now());
const initialStarCount = 100;
addHomeStar(arenaModel);
addRandomStars(arenaModel, initialStarCount);
const arenaAsset = new ArenaAsset(arenaModel, camera);
const cameraController = new CameraController(
  camera,
  stage3d,
  settings.camera,
  arenaModel.half,
  arenaAsset
);
// Place the camera in the positive corner, looking at origin.
cameraController.setPosition(new Vector3(arenaModel.half.x, arenaModel.half.y, arenaModel.half.z));

const sim = new GameSim();
const logOverlay = new LogOverlay();
const logToggle = document.createElement("button");
logToggle.className = "log-toggle";
logToggle.textContent = "Log";
logToggle.addEventListener("click", () => logOverlay.toggle());
document.body.appendChild(logToggle);

const seedPanel = document.createElement("div");
seedPanel.className = "seed-panel";
seedPanel.style.display = "flex";

const starsLabel = document.createElement("label");
starsLabel.textContent = "Stars:";
const seedInput = document.createElement("input");
seedInput.type = "number";
seedInput.min = "1";
seedInput.value = `${readSetting("hud:stars", initialStarCount)}`;
starsLabel.appendChild(seedInput);

const gridLabel = document.createElement("label");
gridLabel.textContent = "Grid scale:";
const subwarpInput = document.createElement("input");
subwarpInput.type = "number";
subwarpInput.min = "0.5";
subwarpInput.step = "0.5";
subwarpInput.value = `${readSetting("hud:grid", 4)}`;
gridLabel.appendChild(subwarpInput);

const spokesLabel = document.createElement("label");
spokesLabel.textContent = "Radial spokes:";
const spokesInput = document.createElement("input");
spokesInput.type = "number";
spokesInput.min = "3";
spokesInput.step = "1";
spokesInput.value = `${readSetting("hud:spokes", 12)}`;
spokesLabel.appendChild(spokesInput);

const simSpeedLabel = document.createElement("label");
simSpeedLabel.textContent = "Sim speed (1-60):";
const simSpeedInput = document.createElement("input");
simSpeedInput.type = "number";
simSpeedInput.min = "1";
const simSpeedMax = settings.sim.maxTickRate ?? 360;
simSpeedInput.max = `${simSpeedMax}`;
simSpeedInput.step = "1";
const simSpeedInitial = clamp(readSetting("hud:simspeed", settings.sim.tickRate), 1, simSpeedMax);
simSpeedInput.value = `${simSpeedInitial}`;
simSpeedLabel.appendChild(simSpeedInput);

const attenLabel = document.createElement("label");
attenLabel.textContent = "Attenuation (1-100):";
const attenInput = document.createElement("input");
attenInput.type = "number";
attenInput.min = "1";
attenInput.max = "100";
attenInput.step = "1";
const attenInitial = clamp(readSetting("hud:atten", 1), 1, 100);
attenInput.value = `${attenInitial}`;
attenLabel.appendChild(attenInput);

const seedButton = document.createElement("button");
seedButton.textContent = "Regenerate";
seedButton.addEventListener("click", () => {
  const count = Number(seedInput.value) || initialStarCount;
  const subwarpScale = Number(subwarpInput.value) || 4;
  const spokes = Number(spokesInput.value) || 12;
  const simSpeed = clamp(Number(simSpeedInput.value) || settings.sim.tickRate, 1, simSpeedMax);
  const attenuation = clamp(Number(attenInput.value) || attenInitial, 1, 100);
  persistSetting("hud:stars", count);
  persistSetting("hud:grid", subwarpScale);
  persistSetting("hud:spokes", spokes);
  persistSetting("hud:simspeed", simSpeed);
  persistSetting("hud:atten", attenuation);
  settings.sim.tickRate = simSpeed;
  regenerateStars(count);
  arenaAsset.setSubwarpScale(subwarpScale);
  arenaAsset.setSubwarpSpokes(spokes);
  arenaAsset.setSpinRate(simSpeed, simSpeedMax);
  arenaAsset.setAttenuation(attenuation);
});

subwarpInput.addEventListener("change", () => {
  const subwarpScale = Number(subwarpInput.value) || 4;
  persistSetting("hud:grid", subwarpScale);
  arenaAsset.setSubwarpScale(subwarpScale);
});

spokesInput.addEventListener("change", () => {
  const spokes = Number(spokesInput.value) || 12;
  persistSetting("hud:spokes", spokes);
  arenaAsset.setSubwarpSpokes(spokes);
});

simSpeedInput.addEventListener("change", () => {
  const simSpeed = clamp(Number(simSpeedInput.value) || settings.sim.tickRate, 1, simSpeedMax);
  persistSetting("hud:simspeed", simSpeed);
  settings.sim.tickRate = simSpeed;
  arenaAsset.setSpinRate(simSpeed, simSpeedMax);
});

attenInput.addEventListener("change", () => {
  const attenuation = clamp(Number(attenInput.value) || attenInitial, 1, 100);
  persistSetting("hud:atten", attenuation);
  arenaAsset.setAttenuation(attenuation);
});

seedPanel.append(starsLabel, gridLabel, spokesLabel, simSpeedLabel, attenLabel, seedButton);
document.body.appendChild(seedPanel);

const seedToggle = document.createElement("button");
seedToggle.className = "log-toggle";
seedToggle.style.right = "60px";
seedToggle.textContent = "HUD";
seedToggle.addEventListener("click", () => {
  seedPanel.style.display = seedPanel.style.display === "none" ? "flex" : "none";
});
document.body.appendChild(seedToggle);
logStartup();

settings.sim.tickRate = simSpeedInitial;
arenaAsset.setSpinRate(simSpeedInitial, simSpeedMax);
arenaAsset.setAttenuation(attenInitial);
const starInfoPanel = new StarInfoPanel(arenaAsset);
const starInfoToggle = document.createElement("button");
starInfoToggle.className = "star-info-toggle";
starInfoToggle.textContent = "Star Info";
starInfoToggle.addEventListener("click", () => starInfoPanel.toggle());
document.body.appendChild(starInfoToggle);
const sceneInteraction = new SceneInteraction(
  stage3d,
  camera,
  arenaAsset,
  (pos) => {
    cameraController.setPosition(pos);
  },
  (star) => {
    if (star) {
      starInfoPanel.show(star);
    }
  },
  (pos) => {
    cameraController.focusOn(pos);
  },
  () => cameraController.isDragging()
);

function setupScene() {
  const ambient = new AmbientLight(0xffffff, 0.5);
  const sun = new DirectionalLight(0xffffff, 0.8);
  sun.position.set(400, 600, 400);
  scene.add(ambient, sun);

  scene.add(arenaAsset.group);

  const axisAsset = createAxisAsset(arenaModel);
  scene.add(axisAsset);
}

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

function drawOverlay() {
  const ctx = stage2d.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, stage2d.width, stage2d.height);

  const target = cameraController.getTarget().clone();
  const projected = target.project(camera);
  const x = (projected.x * 0.5 + 0.5) * stage2d.width;
  const y = (-projected.y * 0.5 + 0.5) * stage2d.height;

  const size = 8;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255, 140, 66, 0.9)";
  ctx.lineWidth = 2;
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size);
  ctx.stroke();
}

function start() {
  setupScene();
  resize();
  window.addEventListener("resize", resize);
  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(stage3d);

  let tickAccumulator = 0;

  sim.onTick((dt) => {
    tickAccumulator += dt * settings.sim.tickRate;
    const ticks = Math.floor(tickAccumulator);
    tickAccumulator -= ticks;
    if (ticks > 0) {
      tickArenaModel(arenaModel, ticks);
      arenaAsset.tick();
    }
    cameraController.update(dt);
    renderer.render(scene, camera);
    drawOverlay();
  });
  sim.start();
}

start();

function addRandomStars(arena: ArenaModel, count: number) {
  const colors = ["#808080", "#f94144", "#f3722c", "#f9c74f", "#90be6d", "#577590", "#8d6cff", "#2dd4bf"];
  const radii = [1, 3, 5, 7];
  const weights = [0.3, 0.25, 0.15, 0.05];
  for (let i = 0; i < count; i += 1) {
    const radius = pickWeighted(radii, weights);
    const pos = {
      x: (rand() * 2 - 1) * (arena.half.x * 0.9),
      y: (rand() * 2 - 1) * (arena.half.y * 0.9),
      z: (rand() * 2 - 1) * (arena.half.z * 0.9)
    };
    const color = colors[i % colors.length];
    const isGrey = color === "#808080";
    const star: StarModel = {
      id: `star-${i}-${Date.now()}`,
      position: pos,
      radius: isGrey ? radius * 1.4 : radius,
      color,
      brightness: isGrey ? 1.2 : 0.4 + rand() * 0.6,
      phase: rand() * Math.PI * 2,
      orbits: buildOrbits(radius, !isGrey)
    };
    if (!isGrey && star.orbits) {
      star.orbits.forEach((o, orbitIdx) => {
        if (o.hasPlanet) {
          o.planet = createPlanet(orbitIdx);
        }
      });
    }
    arena.stars.push(star);
  }
}

function addHomeStar(arena: ArenaModel) {
  const star: StarModel = {
    id: "home-star",
    position: {
      x: arena.half.x * 0.8,
      y: arena.half.y * 0.8,
      z: arena.half.z * 0.8
    },
    radius: 18,
    color: "#22c55e",
    brightness: 1,
    phase: rand() * Math.PI * 2,
    orbits: buildOrbits(18, true, true)
  };
  star.orbits?.forEach((o, orbitIdx) => {
    if (o.hasPlanet) {
      o.planet = createPlanet(orbitIdx);
    }
  });
  arena.stars.push(star);
}

function pickWeighted<T>(values: T[], weights: number[]) {
  const total = weights.reduce((a, b) => a + b, 0);
  const r = rand() * total;
  let acc = 0;
  for (let i = 0; i < values.length; i += 1) {
    acc += weights[i];
    if (r <= acc) return values[i];
  }
  return values[values.length - 1];
}

function buildOrbits(starRadius: number, allowPlanets: boolean, forcePlanetAll = false) {
  const orbits = [];
  const maxOrbits = 6;
  for (let i = 1; i <= maxOrbits; i += 1) {
    const r = starRadius * (1.5 + i * 0.8);
    const hasPlanet = allowPlanets ? forcePlanetAll || rand() > 0.4 : false;
    orbits.push({ radius: r, hasPlanet });
  }
  return orbits;
}

function createPlanet(idx: number) {
  const planetColors = ["#60a5fa", "#fbbf24", "#34d399", "#c084fc", "#f472b6", "#f97316"];
  const radius = 0.3 + rand() * 0.9;
  return {
    id: `planet-${Date.now()}-${idx}-${Math.floor(rand() * 1e6)}`,
    radius,
    color: planetColors[idx % planetColors.length],
    angle: rand() * Math.PI * 2,
    angularSpeed: 0.01 + rand() * 0.02
  };
}

function regenerateStars(count: number) {
  seedRand(Date.now());
  arenaModel.stars = [];
  addHomeStar(arenaModel);
  addRandomStars(arenaModel, count);
  arenaAsset.resetStars(arenaModel.stars);
}
