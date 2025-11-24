import type { HomeControlModel, StarModel } from "../model/starModel";
import { log } from "../ui/log/logger";

type Listener = (state: {
  controls: ControlState[];
  centerActive: boolean;
  energy: { level: number; steps: number };
  charges: Record<string, number>;
}) => void;

export type ControlState = HomeControlModel & {
  starId: string;
  clicked: boolean;
  lastClickedAt?: number;
};

class HomeControlStore {
  private controls = new Map<string, ControlState>();
  private listeners = new Set<Listener>();
  private centerActive = false;
  private energyLevel = 0;
  private energySteps = 1;
  private charges: Record<string, number> = {};

  initFromStar(star: StarModel | null | undefined) {
    this.controls.clear();
    this.energyLevel = 0;
    this.energySteps = 1;
    this.charges = {};
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
        this.charges[id] = 0;
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
    this.charges[controlId] = ctrl.clicked ? this.charges[controlId] ?? 0 : 0;
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
      this.charges[ctrl.id] = 0;
    });
    this.notify();
  }

  getState() {
    return {
      controls: Array.from(this.controls.values()),
      centerActive: this.centerActive,
      energy: { level: this.energyLevel, steps: this.energySteps },
      charges: this.charges
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

  setEnergy(level: number, steps?: number) {
    const nextSteps = Math.max(1, steps ?? this.energySteps);
    const clamped = Math.max(0, Math.min(1, level));
    const quantized = Math.floor(clamped * nextSteps) / nextSteps;
    const changed = quantized !== this.energyLevel || nextSteps !== this.energySteps;
    this.energyLevel = quantized;
    this.energySteps = nextSteps;
    if (changed) this.notify();
  }

  setControlCharges(levels: Array<{ id: string; level: number }>) {
    let changed = false;
    levels.forEach(({ id, level }) => {
      const clamped = Math.max(0, Math.min(1, level));
      if (this.charges[id] !== clamped) {
        this.charges[id] = clamped;
        changed = true;
      }
    });
    if (changed) this.notify();
  }
}

export const homeControlStore = new HomeControlStore();
