export type ControlClickEvent = {
  type: "control-click";
  starId: string;
  controlId: string;
};

export type GameEventMap = {
  "control-click": ControlClickEvent;
};

type Handler<K extends keyof GameEventMap> = (event: GameEventMap[K]) => void;

export class EventBus {
  private listeners: { [K in keyof GameEventMap]?: Set<Handler<K>> } = {};

  on<K extends keyof GameEventMap>(type: K, handler: Handler<K>) {
    if (!this.listeners[type]) {
      this.listeners[type] = new Set();
    }
    (this.listeners[type] as Set<Handler<K>>).add(handler);
    return () => this.off(type, handler);
  }

  off<K extends keyof GameEventMap>(type: K, handler: Handler<K>) {
    const set = this.listeners[type] as Set<Handler<K>> | undefined;
    set?.delete(handler);
  }

  emit<K extends keyof GameEventMap>(type: K, event: GameEventMap[K]) {
    const set = this.listeners[type] as Set<Handler<K>> | undefined;
    set?.forEach((handler) => handler(event));
  }
}

export const eventBus = new EventBus();
