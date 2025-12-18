import "./style.css";
import { startDimensionGate } from "./dimensionGate";
import { startStellarSwarm } from "./stellarSwarm";

function normalizePath(pathname: string) {
  if (!pathname) return "/";
  const trimmed = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  return trimmed || "/";
}

function startScene() {
  const path = normalizePath(window.location.pathname);
  if (path === "/dim-gate") {
    document.title = "Dimension Gate";
    startDimensionGate();
    return;
  }

  document.title = "Stellar Swarm";
  startStellarSwarm();
}

startScene();
