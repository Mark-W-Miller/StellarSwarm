import type { HomeControlModel, StarModel } from "../model/starModel";

type Listener = (controls: ControlState[]) => void;

export type ControlState = HomeControlModel & {
  starId: string;
  clicked: boolean;
  lastClickedAt?: number;
};

class HomeControlStore {
  private controls = new Map<string, ControlState>();
  private listeners = new Set<Listener>();

  initFromStar(star: StarModel | null | undefined) {
    this.controls.clear();
    if (star?.controls) {
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

  markClicked(controlId: string) {
    const ctrl = this.controls.get(controlId);
    if (!ctrl) return;
    ctrl.clicked = true;
    ctrl.lastClickedAt = Date.now();
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
    return Array.from(this.controls.values());
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
