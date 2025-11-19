import { EventBus, eventBus, GameEventMap } from "./eventBus";
import { log } from "../ui/log/logger";
import type { StarModel } from "../model/starModel";
import { homeControlStore } from "../state/homeControls";

export class GameManager {
  private unsubscribes: Array<() => void> = [];

  constructor(private bus: EventBus = eventBus) {
    this.unsubscribes.push(this.bus.on("control-click", this.onControlClick));
  }

  setHomeStar(star: StarModel | null | undefined) {
    homeControlStore.initFromStar(star);
  }

  dispose() {
    this.unsubscribes.forEach((off) => off());
    this.unsubscribes = [];
  }

  private onControlClick: (event: GameEventMap["control-click"]) => void = (event) => {
    log("COMMAND", "GameManager control click", { control: event.controlId, star: event.starId });
    homeControlStore.markClicked(event.controlId);
    // Future: translate control clicks into gameplay actions.
  };
}
