import { Camera, Raycaster, Vector2 } from "three";
import { log } from "./log/logger";
import type { ArenaAsset } from "../assets/arenaAsset";

type DragState =
  | { active: false }
  | { active: true; starId: string; wasDrag: boolean };

export class SceneInteraction {
  private raycaster = new Raycaster();
  private ndc = new Vector2();
  private drag: DragState = { active: false };
  private currentDragOver: string | null = null;
  private selectionChain: string[] = [];

  private consume(event: PointerEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  }

  constructor(
    private element: HTMLElement,
    private camera: Camera,
    private arenaAsset: ArenaAsset
  ) {
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    this.element.addEventListener("pointermove", this.onPointerMove);
    this.element.addEventListener("pointerdown", this.onPointerDown);
    this.element.addEventListener("pointerup", this.onPointerUp);
  }

  dispose() {
    this.element.removeEventListener("pointermove", this.onPointerMove);
    this.element.removeEventListener("pointerdown", this.onPointerDown);
    this.element.removeEventListener("pointerup", this.onPointerUp);
  }

  private setCursor(hit: boolean) {
    this.element.style.cursor = hit ? "crosshair" : "default";
  }

  private updateRay(event: PointerEvent) {
    const rect = this.element.getBoundingClientRect();
    this.ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  private onPointerMove(event: PointerEvent) {
    this.updateRay(event);
    const hit = this.arenaAsset.intersectStars(this.raycaster)[0];

    if (this.drag.active) {
      if (hit && hit.star) {
        this.drag = { active: true, starId: hit.star.id, wasDrag: true };
        if (this.currentDragOver !== hit.star.id) {
          this.currentDragOver = hit.star.id;
          log("M_EVENT_DRAG", "Drag over star", { star: hit.star.id, origin: this.drag.starId });
        } else {
          log("M_EVENT_DRAG", "Drag move", { star: hit.star.id });
        }
      } else {
        this.drag = { active: true, starId: this.drag.starId, wasDrag: true };
      }
      this.setCursor(true);
      this.consume(event);
      return;
    }

    if (hit && hit.star) {
      this.setCursor(true);
      log("M_EVENT_MOVE", "Hover star", { star: hit.star.id });
      this.consume(event);
    } else {
      this.setCursor(false);
    }
  }

  private onPointerDown(event: PointerEvent) {
    this.updateRay(event);
    const hit = this.arenaAsset.intersectStars(this.raycaster)[0];
    if (hit && hit.star) {
      this.drag = { active: true, starId: hit.star.id, wasDrag: false };
      this.currentDragOver = hit.star.id;
      this.selectionChain.push(hit.star.id);
      this.arenaAsset.addSelection(hit.star.id);
      log("M_EVENT_CLICK", "Star pointerdown", { star: hit.star.id, button: event.button });
      this.setCursor(true);
      this.consume(event);
    } else {
      if (this.selectionChain.length > 0) {
        log("M_EVENT_CLICK", "Selection chain ended", { chain: this.selectionChain });
        this.selectionChain = [];
      }
      this.setCursor(false);
    }
  }

  private onPointerUp(event: PointerEvent) {
    if (!this.drag.active) return;
    const starId = this.drag.starId;
    const wasDrag = this.drag.wasDrag;
    this.drag = { active: false };
    this.currentDragOver = null;
    log("M_EVENT_DRAG", wasDrag ? "Star drag end" : "Star click release", {
      star: starId
    });
    this.setCursor(false);
    this.consume(event);
  }
}
