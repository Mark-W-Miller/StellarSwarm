import { PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";
import { log } from "./log/logger";
import type { Settings } from "../types";
import type { ArenaAsset } from "../assets/arenaAsset";

type PointerState = {
  active: boolean;
  lastX: number;
  lastY: number;
  button: number;
  mode: "orbit" | "pan";
};

export class CameraController {
  private camera: PerspectiveCamera;
  private domElement: HTMLElement;
  private target: Vector3;
  private yaw: number;
  private pitch: number;
  private radius: number;
  private settings: Settings["camera"];
  private bounds: Vector3;
  private pointer: PointerState = { active: false, lastX: 0, lastY: 0, button: 0, mode: "orbit" };
  private keyState = new Set<string>();
  private raycaster = new Raycaster();
  private ndc = new Vector2();
  private arenaAsset?: ArenaAsset;

  constructor(
    camera: PerspectiveCamera,
    domElement: HTMLElement,
    settings: Settings["camera"],
    bounds: { x: number; y: number; z: number },
    arenaAsset?: ArenaAsset
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.settings = settings;
    this.target = new Vector3(0, 0, 0);
    this.yaw = -Math.PI / 4;
    this.pitch = -Math.PI / 8;
    this.radius = settings.radius;
    this.bounds = new Vector3(bounds.x, bounds.y, bounds.z);
    this.arenaAsset = arenaAsset;

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    this.domElement.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    this.domElement.addEventListener("wheel", this.handleWheel, { passive: false });
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);

    this.updateCamera();
  }

  dispose() {
    this.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    this.domElement.removeEventListener("wheel", this.handleWheel);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  update(delta: number) {
    const panDistance = this.settings.panSpeed * delta;
    const forwardMultiplier = this.keyState.has("Shift") ? 10 : 1;
    const forwardDistance = panDistance * 10 * forwardMultiplier;
    const rotAmount = this.settings.rotationSpeed * delta;
    const forward = new Vector3();
    const right = new Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, new Vector3(0, 1, 0)).normalize().negate();

    const shift = this.keyState.has("Shift");

    if (this.keyState.has("ArrowUp")) {
      this.target.addScaledVector(forward, forwardDistance);
      log("CAMERA", shift ? "Move forward (boost)" : "Move forward", {
        target: this.target.toArray()
      });
    }
    if (this.keyState.has("ArrowDown")) {
      this.target.addScaledVector(forward, -forwardDistance);
      log("CAMERA", shift ? "Move backward (boost)" : "Move backward", {
        target: this.target.toArray()
      });
    }
    const forwardHeld = this.keyState.has("ArrowUp") || this.keyState.has("ArrowDown");
    if (forwardHeld && this.keyState.has("ArrowLeft")) {
      this.yaw -= rotAmount;
      log("CAMERA", "Turn left", { yaw: this.yaw });
    }
    if (forwardHeld && this.keyState.has("ArrowRight")) {
      this.yaw += rotAmount;
      log("CAMERA", "Turn right", { yaw: this.yaw });
    }
    if (!forwardHeld && this.keyState.has("ArrowLeft")) {
      this.yaw -= rotAmount;
      log("CAMERA", "Rotate CCW in place", { yaw: this.yaw });
    }
    if (!forwardHeld && this.keyState.has("ArrowRight")) {
      this.yaw += rotAmount;
      log("CAMERA", "Rotate CW in place", { yaw: this.yaw });
    }

    this.clampToBounds();
    this.updateCamera();
  }

  getTarget() {
    return this.target.clone();
  }

  isDragging() {
    return this.pointer.active;
  }

  setPosition(position: Vector3, target = new Vector3(0, 0, 0)) {
    this.target.copy(target);
    const offset = new Vector3().subVectors(position, target);
    const radius = offset.length();
    if (radius > 0) {
      this.radius = Math.min(this.settings.maxRadius, Math.max(this.settings.minRadius, radius));
      this.yaw = Math.atan2(offset.z, offset.x);
      const ratio = offset.y / radius;
      this.pitch = Math.asin(Math.max(-1, Math.min(1, ratio)));
    }
    this.clampToBounds();
    this.updateCamera();
  }

  focusOn(target: Vector3) {
    this.target.copy(target);
    const offset = this.camera.position.clone().sub(this.target);
    const radius = offset.length();
    if (radius > 0) {
      this.radius = Math.min(this.settings.maxRadius, Math.max(this.settings.minRadius, radius));
      this.yaw = Math.atan2(offset.z, offset.x);
      const ratio = offset.y / radius;
      this.pitch = Math.asin(Math.max(-1, Math.min(1, ratio)));
    }
    // Keep the camera where it is; just realign its orientation to the new target.
    this.camera.lookAt(this.target);
  }

  private hitSceneObject(event: PointerEvent) {
    if (!this.arenaAsset) return false;
    const rect = this.domElement.getBoundingClientRect();
    this.ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.arenaAsset.intersectStars(this.raycaster)[0];
    return Boolean(hit && (hit.star || hit.mesh));
  }

  private handlePointerDown(event: PointerEvent) {
    log("CAMERA_MOVE", "Pointer down", { button: event.button });
    if (!(event.target instanceof HTMLElement)) return;
    if (
      event.target.closest(".log-toggle, .log-overlay, .seed-panel, .star-info, .star-info-toggle")
    ) {
      return;
    }
    if (event.target !== this.domElement && !this.domElement.contains(event.target)) return;
    if (this.hitSceneObject(event)) return;
    const mode = event.shiftKey && event.button === 0 ? "pan" : "orbit";
    this.pointer = {
      active: true,
      lastX: event.clientX,
      lastY: event.clientY,
      button: event.button ?? 0,
      mode
    };
    log("CAMERA_MOVE", mode === "pan" ? "Pan start" : "Orbit start", { button: event.button });
  }

  private handlePointerMove(event: PointerEvent) {
    if (!this.pointer.active) return;
    const dx = event.clientX - this.pointer.lastX;
    const dy = event.clientY - this.pointer.lastY;
    this.pointer.lastX = event.clientX;
    this.pointer.lastY = event.clientY;

    if (this.pointer.mode === "pan") {
      const right = new Vector3();
      const up = new Vector3(0, 1, 0);
      this.camera.getWorldDirection(right);
      right.crossVectors(right, up).normalize();
      const panScale = this.settings.panSpeed * 0.1;
      this.target.addScaledVector(right, -dx * panScale);
      this.target.addScaledVector(up, dy * panScale);
      this.clampToBounds();
      this.updateCamera();
      log("CAMERA_MOVE", "Pan drag", { dx, dy, target: this.target.toArray() });
      return;
    }

    log("CAMERA_MOVE", "Orbit drag", this.pointer.active);
    this.yaw += dx * this.settings.dragSensitivity;
    const minPitch = -Math.PI + 0.1;
    const maxPitch = Math.PI / 2 - 0.05;
    this.pitch = Math.max(minPitch, Math.min(maxPitch, this.pitch + dy * this.settings.dragSensitivity));
    this.clampToBounds();
    this.updateCamera();
  }

  private handlePointerUp(event: PointerEvent) {
    log("CAMERA_MOVE", "Pointer up", { button: event.button });
    if (
      event.target instanceof HTMLElement &&
      event.target.closest(".log-toggle, .log-overlay, .seed-panel, .star-info, .star-info-toggle")
    ) {
      return;
    }
    this.pointer.active = false;
  }

  private handleWheel(event: WheelEvent) {
    event.preventDefault();
    const delta = Math.sign(event.deltaY);
    const radiusChange = delta * 10;
    let proposed = this.radius + radiusChange;
    if (proposed < this.settings.minRadius) {
      // Move target forward along view direction instead of flipping.
      const forward = new Vector3();
      this.camera.getWorldDirection(forward);
      forward.normalize().multiplyScalar(this.settings.minRadius * 0.5);
      this.target.add(forward);
      this.radius = this.settings.minRadius;
      log("CAMERA_MOVE", "Zoom push-forward", {
        radius: this.radius,
        target: this.target.toArray()
      });
    } else {
      this.radius = Math.min(this.settings.maxRadius, proposed);
    }
    this.clampToBounds();
    log("CAMERA", "Zoom", { radius: this.radius });
    this.updateCamera();
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Shift"].includes(event.key)) {
      event.preventDefault();
      if (!this.keyState.has(event.key)) {
        this.keyState.add(event.key);
        if (event.key === "Shift") {
          log("CAMERA", "Shift engaged");
        }
      }
    }
  }

  private handleKeyUp(event: KeyboardEvent) {
    if (this.keyState.delete(event.key) && event.key === "Shift") {
      log("CAMERA", "Shift released");
    }
  }

  private clampToBounds() {
    this.target.x = Math.max(-this.bounds.x, Math.min(this.bounds.x, this.target.x));
    this.target.y = Math.max(-this.bounds.y, Math.min(this.bounds.y, this.target.y));
    this.target.z = Math.max(-this.bounds.z, Math.min(this.bounds.z, this.target.z));
  }

  private updateCamera() {
    const clampedPitch = Math.max(-Math.PI + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
    const x = this.target.x + this.radius * Math.cos(clampedPitch) * Math.cos(this.yaw);
    const y = this.target.y + this.radius * Math.sin(clampedPitch);
    const z = this.target.z + this.radius * Math.cos(clampedPitch) * Math.sin(this.yaw);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }
}
