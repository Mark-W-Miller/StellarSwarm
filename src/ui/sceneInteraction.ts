import { Camera, Mesh, Raycaster, Vector2, Vector3 } from "three";
import { log } from "./log/logger";
import { eventBus } from "../engine/eventBus";

const CENTER_CONTROL_ID = "CTRL-CENTER";
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
  private contextMenu: HTMLDivElement;
  private cornersByMesh = new Map<Mesh, Vector3>();
  private lastCornerClick: { id: string | null; time: number } = { id: null, time: 0 };
  private lastStarClick: { id: string | null; time: number } = { id: null, time: 0 };

  private consume(event: PointerEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  }

  constructor(
    private element: HTMLElement,
    private camera: Camera,
    private arenaAsset: ArenaAsset,
    private onCornerDoubleClick?: (pos: Vector3) => void,
    private onStarSelect?: (star: any) => void,
    private onStarDoubleClick?: (pos: Vector3) => void,
    private isCameraDragging?: () => boolean
  ) {
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);
    this.hideContextMenu = this.hideContextMenu.bind(this);

    this.element.addEventListener("pointermove", this.onPointerMove);
    this.element.addEventListener("pointerdown", this.onPointerDown);
    this.element.addEventListener("pointerup", this.onPointerUp);
    this.element.addEventListener("contextmenu", this.onContextMenu);
    document.addEventListener("pointerdown", this.hideContextMenu);

    this.contextMenu = document.createElement("div");
    this.contextMenu.className = "context-menu";
    this.contextMenu.style.display = "none";
    document.body.appendChild(this.contextMenu);

    // Map corner meshes to positions for double-click reset.
    arenaAsset.getCornerMarkers().forEach(({ mesh, position }) => {
      this.cornersByMesh.set(mesh, position.clone());
    });
  }

  dispose() {
    this.element.removeEventListener("pointermove", this.onPointerMove);
    this.element.removeEventListener("pointerdown", this.onPointerDown);
    this.element.removeEventListener("pointerup", this.onPointerUp);
    this.element.removeEventListener("contextmenu", this.onContextMenu);
    document.removeEventListener("pointerdown", this.hideContextMenu);
    this.contextMenu.remove();
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
    if (this.isCameraDragging?.()) return;
    this.updateRay(event);
    const hit = this.arenaAsset.intersectStars(this.raycaster)[0];
    const star = hit?.star;

    if (this.drag.active) {
      if (star) {
        this.drag = { active: true, starId: star.id, wasDrag: true };
        if (this.currentDragOver !== star.id) {
          this.currentDragOver = star.id;
          log("M_EVENT_DRAG", "Drag over star", { star: star.id, origin: this.drag.starId });
        } else {
          log("M_EVENT_DRAG", "Drag move", { star: star.id });
        }
      } else {
        this.drag = { active: true, starId: this.drag.starId, wasDrag: true };
      }
      this.setCursor(true);
      this.consume(event);
      return;
    }

    if (star && this.currentDragOver !== star.id) {
      this.setCursor(true);
      log("M_EVENT_MOVE", "Hover star", { star: star.id });
      this.consume(event);
    } else if (hit?.mesh && this.cornersByMesh.has(hit.mesh as Mesh)) {
      this.setCursor(true);
    } else {
      this.setCursor(false);
    }
  }

  private onPointerDown(event: PointerEvent) {
    this.updateRay(event);
    const controlHit = this.arenaAsset.intersectControls(this.raycaster)[0];
    if (controlHit) {
      this.handleControlClick(controlHit.controlId, controlHit.starId, event.button);
      if (controlHit.controlId !== CENTER_CONTROL_ID) {
        this.consume(event);
        return;
      }
    }
    const hit = this.arenaAsset.intersectStars(this.raycaster)[0];
    const star = hit?.star;

    const meshControlId = (hit?.mesh as Mesh | undefined)?.userData?.controlId as string | undefined;
    if (meshControlId && star) {
      this.handleControlClick(meshControlId, star.id, event.button);
      if (meshControlId !== CENTER_CONTROL_ID) {
        this.consume(event);
        return;
      }
    }

    if (hit?.mesh && hit.mesh instanceof Mesh && this.cornersByMesh.has(hit.mesh)) {
      const pos = this.cornersByMesh.get(hit.mesh);
      const now = performance.now();
      log("M_EVENT_CLICK", "Corner candidate", {
        position: pos?.toArray(),
        meshId: hit.mesh.uuid,
        detail: event.detail
      });
      if (this.lastCornerClick.id === hit.mesh.uuid && now - this.lastCornerClick.time < 350 && pos) {
        log("CAMERA_MOVE", "Corner double-click (timer)", { position: pos.toArray() });
        this.consume(event);
        this.onCornerDoubleClick?.(pos);
        this.lastCornerClick = { id: null, time: 0 };
        return;
      }
      this.lastCornerClick = { id: hit.mesh.uuid, time: now };
    } else {
      this.lastCornerClick = { id: null, time: 0 };
    }

    if (star) {
      this.drag = { active: false };
      this.currentDragOver = null;
      const shift = event.shiftKey;
      const alreadySelected = this.arenaAsset.isSelected(star.id);
      if (shift) {
        if (alreadySelected) {
          this.arenaAsset.removeSelection(star.id);
          this.selectionChain = this.selectionChain.filter((id) => id !== star.id);
          log("M_EVENT_CLICK", "Star deselected (toggle)", { star: star.id });
        } else {
          this.arenaAsset.addSelection(star.id);
          this.selectionChain.push(star.id);
          log("M_EVENT_CLICK", "Star selected (toggle)", { star: star.id });
        }
      } else {
        this.selectionChain.push(star.id);
        this.arenaAsset.addSelection(star.id);
      }
      const now = performance.now();
      log("M_EVENT_CLICK", "Star pointerdown", { star: star.id, button: event.button });
      if (this.lastStarClick.id === star.id && now - this.lastStarClick.time < 350) {
        log("M_EVENT_CLICK", "Star double-click", { star: star.id });
        this.onStarDoubleClick?.(new Vector3(star.position.x, star.position.y, star.position.z));
      }
      this.lastStarClick = { id: star.id, time: now };
      this.onStarSelect?.(star);
      this.setCursor(true);
      this.consume(event);
      return;
    } else {
      this.lastStarClick = { id: null, time: 0 };
      if (this.selectionChain.length > 0) {
        log("M_EVENT_CLICK", "Selection chain ended", { chain: this.selectionChain });
        this.selectionChain = [];
      }
      this.setCursor(false);
    }

    if (hit?.mesh && hit.mesh instanceof Mesh && this.cornersByMesh.has(hit.mesh)) {
      const pos = this.cornersByMesh.get(hit.mesh);
      log("M_EVENT_CLICK", "Corner click", { position: pos?.toArray(), meshId: hit.mesh.uuid, detail: event.detail });
      if (event.detail === 2 && pos) {
        log("M_EVENT_CLICK", "Corner double-click", { position: pos.toArray() });
        this.consume(event);
        this.onCornerDoubleClick?.(pos);
      }
    }
  }

  private handleControlClick(controlId: string, starId: string, button: number) {
    log("COMMAND_DETECT", "Control sphere click", {
      control: controlId,
      star: starId,
      button
    });
    eventBus.emit("control-click", {
      type: "control-click",
      starId,
      controlId
    });
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

  private onContextMenu(event: PointerEvent) {
    this.updateRay(event);
    const hit = this.arenaAsset.intersectStars(this.raycaster)[0];
    const star = hit?.star;
    if (star) {
      this.consume(event);
      this.showContextMenu(event.clientX, event.clientY, star.id);
      log("M_EVENT_CLICK", "Star context menu", { star: star.id });
    }
  }

  private showContextMenu(x: number, y: number, starId: string) {
    this.contextMenu.innerHTML = "";
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = `Action on ${starId}`;
    item.className = "context-menu__item";
    item.addEventListener("click", () => {
      log("M_EVENT_CLICK", "Context action", { star: starId });
      this.hideContextMenu();
    });
    this.contextMenu.appendChild(item);
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
    this.contextMenu.style.display = "block";
  }

  private hideContextMenu() {
    this.contextMenu.style.display = "none";
  }
}
