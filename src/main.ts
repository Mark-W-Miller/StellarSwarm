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

let rngSeed = Date.now();
function seedRand(seed: number) {
  rngSeed = seed >>> 0;
}
function rand() {
  rngSeed = (1664525 * rngSeed + 1013904223) >>> 0;
  return rngSeed / 0xffffffff;
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
const cameraController = new CameraController(camera, stage3d, settings.camera, arenaModel.half);
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
const seedInput = document.createElement("input");
seedInput.type = "number";
seedInput.min = "1";
seedInput.value = `${initialStarCount}`;
const seedButton = document.createElement("button");
seedButton.textContent = "Regenerate";
seedButton.addEventListener("click", () => {
  const count = Number(seedInput.value) || initialStarCount;
  regenerateStars(count);
});
seedPanel.append(seedInput, seedButton);
document.body.appendChild(seedPanel);

const seedToggle = document.createElement("button");
seedToggle.className = "log-toggle";
seedToggle.style.right = "60px";
seedToggle.textContent = "Stars";
seedToggle.addEventListener("click", () => {
  seedPanel.style.display = seedPanel.style.display === "flex" ? "none" : "flex";
  seedPanel.style.display = seedPanel.style.display || "flex";
});
document.body.appendChild(seedToggle);
logStartup();

const arenaAsset = new ArenaAsset(arenaModel);
const sceneInteraction = new SceneInteraction(stage3d, camera, arenaAsset, (pos) => {
  cameraController.setPosition(pos);
});

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
    const star: StarModel = {
      id: `star-${i}-${Date.now()}`,
      position: pos,
      radius,
      color: colors[i % colors.length],
      brightness: 0.4 + rand() * 0.6,
      phase: rand() * Math.PI * 2
    };
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
    color: "#9be7ff",
    brightness: 1,
    phase: rand() * Math.PI * 2
  };
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

function regenerateStars(count: number) {
  seedRand(Date.now());
  arenaModel.stars = [];
  addHomeStar(arenaModel);
  addRandomStars(arenaModel, count);
  arenaAsset.resetStars(arenaModel.stars);
}
