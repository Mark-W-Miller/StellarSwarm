import { EventBus, eventBus, GameEventMap } from "./eventBus";
import { log } from "../ui/log/logger";

export class GameManager {
  private unsubscribes: Array<() => void> = [];

  constructor(private bus: EventBus = eventBus) {
    this.unsubscribes.push(this.bus.on("control-click", this.onControlClick));
  }

  dispose() {
    this.unsubscribes.forEach((off) => off());
    this.unsubscribes = [];
  }

  private onControlClick: (event: GameEventMap["control-click"]) => void = (event) => {
    log("COMMAND", "GameManager control click", { control: event.controlId, star: event.starId });
    // Future: translate control clicks into gameplay actions.
  };
}
