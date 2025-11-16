import "./style.css";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer
} from "three";
import settings from "./settings.json";
import { createArenaAsset } from "./assets/arenaAsset";
import { createAxisAsset } from "./assets/axisAsset";
import { createArenaModel } from "./model/arenaModel";
import { CameraController } from "./ui/camera";
import { GameSim } from "./engine/sim";

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
const cameraController = new CameraController(camera, stage3d, settings.camera, arenaModel.half);

const sim = new GameSim();

function setupScene() {
  const ambient = new AmbientLight(0xffffff, 0.5);
  const sun = new DirectionalLight(0xffffff, 0.8);
  sun.position.set(400, 600, 400);
  scene.add(ambient, sun);

  const arenaAsset = createArenaAsset(arenaModel);
  scene.add(arenaAsset);

  const axisAsset = createAxisAsset(arenaModel);
  scene.add(axisAsset);
}

function resize() {
  const { clientWidth, clientHeight } = stage3d;
  stage2d.width = clientWidth;
  stage2d.height = clientHeight;
  renderer.setSize(clientWidth, clientHeight);
  camera.aspect = clientWidth / clientHeight;
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

  sim.onTick((dt) => {
    cameraController.update(dt);
    renderer.render(scene, camera);
    drawOverlay();
  });
  sim.start();
}

start();
