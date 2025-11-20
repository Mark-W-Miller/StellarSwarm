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
import { createArenaModel, populateArenaModel, tickArenaModel } from "./model/arenaModel";
import type { ArenaModel } from "./model/arenaModel";
import { CameraController } from "./ui/camera";
import { GameSim } from "./engine/sim";
import { GameManager } from "./engine/gameManager";
import { LogOverlay } from "./ui/log/logOverlay";
import { logStartup, log } from "./ui/log/logger";
import type { StarModel } from "./model/starModel";
import { HOME_STAR_ID } from "./model/starModel";
import { SceneInteraction } from "./ui/sceneInteraction";
import { StarInfoPanel } from "./ui/starInfo";
import { HomeInfoOverlay } from "./ui/homeInfoOverlay";

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
const initialStarCount = 100;
const initialSubwarpScale = readSetting("hud:grid", 4);
populateArenaModel(arenaModel, initialStarCount, initialSubwarpScale);
const arenaAsset = new ArenaAsset(arenaModel, camera);
const cameraController = new CameraController(
  camera,
  stage3d,
  settings.camera,
  arenaModel.half,
  arenaAsset
);
// Place the camera so it looks at the home star by default.
const homeStar = arenaModel.stars.find((s) => s.id === HOME_STAR_ID);
let homeStarPosition = homeStar
  ? new Vector3(homeStar.position.x, homeStar.position.y, homeStar.position.z)
  : null;
let homeCameraOffset: Vector3 | null = null;
if (homeStarPosition) {
  const target = homeStarPosition.clone();
  const corner = new Vector3(
    homeStarPosition.x >= 0 ? arenaModel.half.x : -arenaModel.half.x,
    homeStarPosition.y >= 0 ? arenaModel.half.y : -arenaModel.half.y,
    homeStarPosition.z >= 0 ? arenaModel.half.z : -arenaModel.half.z
  );
  const halfwayOffset = corner.clone().sub(target).multiplyScalar(0.5);
  const cameraPos = target.clone().add(halfwayOffset);
  cameraController.setPosition(cameraPos, homeStarPosition);
  homeCameraOffset = camera.position.clone().sub(homeStarPosition);
} else {
  cameraController.setPosition(new Vector3(arenaModel.half.x, arenaModel.half.y, arenaModel.half.z));
  homeCameraOffset = null;
}

const sim = new GameSim();
const gameManager = new GameManager();
const logOverlay = new LogOverlay();
const homeOverlay = new HomeInfoOverlay();
const logToggle = document.createElement("button");
logToggle.className = "log-toggle";
logToggle.textContent = "Log";
logToggle.addEventListener("click", () => logOverlay.toggle());
document.body.appendChild(logToggle);

const homeInfoToggle = document.createElement("button");
homeInfoToggle.className = "home-info-toggle";
homeInfoToggle.textContent = "Home Controls";
homeInfoToggle.addEventListener("click", () => homeOverlay.toggle());
document.body.appendChild(homeInfoToggle);
gameManager.setHomeStar(arenaModel.stars.find((s) => s.id === HOME_STAR_ID));

const seedPanel = document.createElement("div");
seedPanel.className = "seed-panel";
const hudVisible = readSetting("hud:panelVisible", 1) === 1;
seedPanel.style.display = hudVisible ? "flex" : "none";

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

const brightLabel = document.createElement("label");
brightLabel.textContent = "Selected brightness:";
const brightInput = document.createElement("input");
brightInput.type = "range";
brightInput.min = "0";
brightInput.max = "1";
brightInput.step = "0.05";
brightInput.value = "1";
brightLabel.appendChild(brightInput);

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
  regenerateStars(count, subwarpScale);
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

brightInput.addEventListener("input", () => {
  const val = Number(brightInput.value);
  arenaAsset.setBrightnessForAll(val);
  log("UI", "Brightness changed", { value: val });
});

seedPanel.append(starsLabel, gridLabel, spokesLabel, simSpeedLabel, attenLabel, brightLabel, seedButton);
document.body.appendChild(seedPanel);

const seedToggle = document.createElement("button");
seedToggle.className = "log-toggle";
seedToggle.style.right = "60px";
seedToggle.textContent = "HUD";
seedToggle.addEventListener("click", () => {
  const nextVisible = seedPanel.style.display === "none";
  seedPanel.style.display = nextVisible ? "flex" : "none";
  persistSetting("hud:panelVisible", nextVisible ? 1 : 0);
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
    starInfoPanel.setStar(star ?? null);
  },
  (star) => {
    const target = new Vector3(star.position.x, star.position.y, star.position.z);
    if (star.id === HOME_STAR_ID && homeStarPosition && homeCameraOffset) {
      const desired = homeCameraOffset.length();
      if (desired > 0) {
        const yaw = Math.atan2(homeCameraOffset.z, homeCameraOffset.x);
        const pitch = Math.asin(Math.max(-1, Math.min(1, homeCameraOffset.y / desired)));
        cameraController.flyToTarget(homeStarPosition.clone(), desired, {
          targetDuration: 0.6,
          radiusDuration: 1.4,
          yaw,
          yawDuration: 1,
          pitch,
          pitchDuration: 1
        });
        return;
      }
    }
    const bounding =
      star.orbits && star.orbits.length > 0
        ? Math.max(...star.orbits.map((o) => o.radius))
        : star.radius * 1.5;
    const safeRadius = bounding + star.radius;
    const fovRad = (camera.fov * Math.PI) / 180;
    const desiredDistance = Math.max(
      safeRadius,
      (2 * safeRadius) / Math.tan(fovRad / 2)
    );
    cameraController.flyToTarget(target, desiredDistance, { targetDuration: 0.6, radiusDuration: 1.4 });
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

function regenerateStars(count: number, subwarpScale: number) {
  populateArenaModel(arenaModel, count, subwarpScale);
  arenaAsset.resetStars(arenaModel.stars);
  const nextHome = arenaModel.stars.find((s) => s.id === HOME_STAR_ID);
  homeStarPosition = nextHome
    ? new Vector3(nextHome.position.x, nextHome.position.y, nextHome.position.z)
    : null;
  homeCameraOffset = homeStarPosition ? camera.position.clone().sub(homeStarPosition) : null;
  gameManager.setHomeStar(nextHome);
}
