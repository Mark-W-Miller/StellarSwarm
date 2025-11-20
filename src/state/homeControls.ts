import type { HomeControlModel, StarModel } from "../model/starModel";
import { log } from "../ui/log/logger";

type Listener = (state: { controls: ControlState[]; centerActive: boolean }) => void;

export type ControlState = HomeControlModel & {
  starId: string;
  clicked: boolean;
  lastClickedAt?: number;
};

class HomeControlStore {
  private controls = new Map<string, ControlState>();
  private listeners = new Set<Listener>();
  private centerActive = false;

  initFromStar(star: StarModel | null | undefined) {
    this.controls.clear();
    if (star?.controls) {
      log(
        "GAME",
        "Initializing home controls",
        JSON.stringify(
          {
            star: star.id,
            controls: star.controls
          },
          null,
          2
        )
      );
      star.controls.forEach((ctrl, idx) => {
        const id = ctrl.id ?? `CTRL-${idx + 1}`;
        this.controls.set(id, {
          ...ctrl,
          id,
          starId: star.id,
          clicked: false
        });
      });
    }
    this.notify();
  }

  setCenterActive(active: boolean) {
    this.centerActive = active;
    this.notify();
  }

  getCenterActive() {
    return this.centerActive;
  }

  toggleControl(controlId: string) {
    const ctrl = this.controls.get(controlId);
    log("GAME", "Control lookup", {
      control: controlId,
      state: ctrl ?? null
    });
    if (!ctrl) return;
    ctrl.clicked = !ctrl.clicked;
    ctrl.lastClickedAt = ctrl.clicked ? Date.now() : undefined;
    log("GAME", ctrl.clicked ? "Control activated" : "Control cleared", {
      control: controlId,
      star: ctrl.starId
    });
    this.notify();
  }

  resetClicks() {
    this.controls.forEach((ctrl) => {
      ctrl.clicked = false;
      ctrl.lastClickedAt = undefined;
    });
    this.notify();
  }

  getState() {
    return {
      controls: Array.from(this.controls.values()),
      centerActive: this.centerActive
    };
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export const homeControlStore = new HomeControlStore();
