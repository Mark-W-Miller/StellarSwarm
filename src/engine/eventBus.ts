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
  private listeners = new Map<keyof GameEventMap, Set<Handler<keyof GameEventMap>>>();

  on<K extends keyof GameEventMap>(type: K, handler: Handler<K>) {
    const existing = this.listeners.get(type) as Set<Handler<K>> | undefined;
    const set =
      existing ??
      (() => {
        const created = new Set<Handler<K>>();
        this.listeners.set(type, created as Set<Handler<keyof GameEventMap>>);
        return created;
      })();
    set.add(handler);
    return () => this.off(type, handler);
  }

  off<K extends keyof GameEventMap>(type: K, handler: Handler<K>) {
    const set = this.listeners.get(type) as Set<Handler<K>> | undefined;
    set?.delete(handler);
  }

  emit<K extends keyof GameEventMap>(type: K, event: GameEventMap[K]) {
    const set = this.listeners.get(type) as Set<Handler<K>> | undefined;
    set?.forEach((handler) => handler(event));
  }
}

export const eventBus = new EventBus();
