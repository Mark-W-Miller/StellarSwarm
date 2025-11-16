import { PerspectiveCamera, Vector3 } from "three";
import type { Settings } from "../types";

type PointerState = {
  active: boolean;
  lastX: number;
  lastY: number;
  button: number;
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
  private pointer: PointerState = { active: false, lastX: 0, lastY: 0, button: 0 };
  private keyState = new Set<string>();

  constructor(
    camera: PerspectiveCamera,
    domElement: HTMLElement,
    settings: Settings["camera"],
    bounds: { x: number; y: number; z: number }
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.settings = settings;
    this.target = new Vector3(0, 0, 0);
    this.yaw = -Math.PI / 4;
    this.pitch = -Math.PI / 8;
    this.radius = settings.radius;
    this.bounds = new Vector3(bounds.x, bounds.y, bounds.z);

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
    const forwardDistance = panDistance * 10;
    const rotAmount = this.settings.rotationSpeed * delta;
    const forward = new Vector3();
    const right = new Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, new Vector3(0, 1, 0)).normalize().negate();

    if (this.keyState.has("ArrowUp")) {
      this.target.addScaledVector(forward, forwardDistance);
    }
    if (this.keyState.has("ArrowDown")) {
      this.target.addScaledVector(forward, -forwardDistance);
    }
    const forwardHeld = this.keyState.has("ArrowUp") || this.keyState.has("ArrowDown");
    if (forwardHeld && this.keyState.has("ArrowLeft")) {
      this.yaw -= rotAmount;
    }
    if (forwardHeld && this.keyState.has("ArrowRight")) {
      this.yaw += rotAmount;
    }

    this.clampToBounds();
    this.updateCamera();
  }

  getTarget() {
    return this.target.clone();
  }

  private handlePointerDown(event: PointerEvent) {
    this.pointer = { active: true, lastX: event.clientX, lastY: event.clientY, button: event.button ?? 0 };
    this.domElement.setPointerCapture(event.pointerId);
  }

  private handlePointerMove(event: PointerEvent) {
    if (!this.pointer.active) return;
    const dx = event.clientX - this.pointer.lastX;
    const dy = event.clientY - this.pointer.lastY;
    this.pointer.lastX = event.clientX;
    this.pointer.lastY = event.clientY;

    if (this.pointer.button === 2) {
      // Right button: pan in screen space.
      const panX = -dx * this.settings.panSpeed * 0.05;
      const panZ = dy * this.settings.panSpeed * 0.05;
      const right = new Vector3();
      const forward = new Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      right.crossVectors(forward, new Vector3(0, 1, 0)).normalize().negate();
      this.target.addScaledVector(right, panX);
      this.target.addScaledVector(forward, panZ);
    } else {
      this.yaw += dx * this.settings.dragSensitivity;
      const minPitch = -Math.PI + 0.1;
      const maxPitch = Math.PI / 2 - 0.05;
      this.pitch = Math.max(minPitch, Math.min(maxPitch, this.pitch + dy * this.settings.dragSensitivity));
    }
    this.clampToBounds();
    this.updateCamera();
  }

  private handlePointerUp(event: PointerEvent) {
    this.pointer.active = false;
    this.domElement.releasePointerCapture(event.pointerId);
  }

  private handleWheel(event: WheelEvent) {
    event.preventDefault();
    const delta = Math.sign(event.deltaY);
    const radiusChange = delta * 10;
    this.radius = Math.min(this.settings.maxRadius, Math.max(this.settings.minRadius, this.radius + radiusChange));
    this.clampToBounds();
    this.updateCamera();
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      this.keyState.add(event.key);
    }
  }

  private handleKeyUp(event: KeyboardEvent) {
    this.keyState.delete(event.key);
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
