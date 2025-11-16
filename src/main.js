import "./style.css";
import { Board3D } from "./ui/board3d.js";

const stage3d = document.querySelector("#stage-3d");
const stage2d = document.querySelector("#stage-2d");
const ctx2d = stage2d.getContext("2d");

const board3d = new Board3D(stage3d);

function resize() {
  const { clientWidth, clientHeight } = stage3d;
  stage2d.width = clientWidth;
  stage2d.height = clientHeight;
  drawOverlay();
}

function drawOverlay() {
  ctx2d.clearRect(0, 0, stage2d.width, stage2d.height);
  ctx2d.strokeStyle = "rgba(111, 155, 255, 0.6)";
  ctx2d.lineWidth = 2;
  // Simple crosshair overlay as placeholder for future UI layers.
  ctx2d.beginPath();
  ctx2d.moveTo(stage2d.width / 2, stage2d.height / 2 - 20);
  ctx2d.lineTo(stage2d.width / 2, stage2d.height / 2 + 20);
  ctx2d.moveTo(stage2d.width / 2 - 20, stage2d.height / 2);
  ctx2d.lineTo(stage2d.width / 2 + 20, stage2d.height / 2);
  ctx2d.stroke();

  ctx2d.fillStyle = "rgba(225, 230, 240, 0.6)";
  ctx2d.font = "14px 'Inter', system-ui, sans-serif";
  ctx2d.textAlign = "center";
  ctx2d.fillText("StellarSwarm skeleton overlay", stage2d.width / 2, stage2d.height / 2 - 28);
}

window.addEventListener("resize", resize);
resize();
