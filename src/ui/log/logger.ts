import settings from "../../settings.json";

type LogClass = string;

export type LogEntry = {
  time: number;
  cls: LogClass;
  message: string;
  data: unknown[];
};

type Subscriber = (state: LoggerState) => void;

export type LoggerState = {
  entries: LogEntry[];
  classes: LogClass[];
  selectedClasses: LogClass[] | null; // null means all classes selected
};

const MAX_ENTRIES = 800;
const LS_PREFIX = "stellarswarm:log:";
const LS_CLASSES = `${LS_PREFIX}classes`;
const LS_SELECTED = `${LS_PREFIX}selected`;
const LS_FORWARD = `${LS_PREFIX}forward`;

const FORWARD_URL = "http://localhost:6060/log";

const originalConsole = {
  log: console.log,
  info: console.info,
  debug: console.debug,
  warn: console.warn,
  error: console.error
};

class Logger {
  private entries: LogEntry[] = [];
  private classes = new Set<LogClass>();
  private selected: Set<LogClass> | null = null; // null => all
  private subscribers = new Set<Subscriber>();
  private forwardEnabled = false;
  private forwardConsole = true;

  constructor() {
    const storedClasses = this.readJSON<LogClass[]>(LS_CLASSES);
    if (storedClasses) storedClasses.forEach((c) => this.classes.add(c));

    const storedSelected = this.readJSON<LogClass[]>(LS_SELECTED);
    if (storedSelected && storedSelected.length > 0) {
      this.selected = new Set(storedSelected);
    }

    const storedForward = this.readJSON<boolean>(LS_FORWARD);
    const hostname = typeof window !== "undefined" ? window.location.hostname : "";
    this.forwardEnabled =
      storedForward ?? (hostname === "localhost" || hostname === "127.0.0.1");

    this.installConsoleForwarders();
    this.installErrorHandlers();
  }

  log(cls: LogClass, message: string, ...data: unknown[]) {
    this.classes.add(cls);
    this.persistClasses();
    const entry: LogEntry = { cls, message, data, time: Date.now() };
    entry.data = entry.data.map((d) => formatValue(d));
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }
    this.notify();
    this.forward(entry);
    this.echo(entry);
  }

  clear() {
    this.entries = [];
    this.notify();
  }

  getState(): LoggerState {
    return {
      entries: [...this.entries],
      classes: Array.from(this.classes),
      selectedClasses: this.selected ? Array.from(this.selected) : null
    };
  }

  subscribe(fn: Subscriber) {
    this.subscribers.add(fn);
    fn(this.getState());
    return () => this.subscribers.delete(fn);
  }

  setSelectedClasses(classes: LogClass[] | null) {
    this.selected = classes ? new Set(classes) : null;
    this.persistSelected();
    this.notify();
  }

  setForwarding(enabled: boolean) {
    this.forwardEnabled = enabled;
    this.persistForward();
  }

  getForwarding() {
    return this.forwardEnabled;
  }

  private notify() {
    const state = this.getState();
    this.subscribers.forEach((fn) => fn(state));
  }

  private shouldSend(entry: LogEntry) {
    if (!this.forwardEnabled) return false;
    if (!this.selected) return true;
    return this.selected.has(entry.cls);
  }

  private forward(entry: LogEntry) {
    if (!this.shouldSend(entry)) return;
    const payload = JSON.stringify(entry);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(FORWARD_URL, payload);
    } else if (typeof fetch !== "undefined") {
      fetch(FORWARD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(() => {
        /* swallow */
      });
    }
  }

  private echo(entry: LogEntry) {
    const line = `[${new Date(entry.time).toISOString()}] [${entry.cls}] ${entry.message}`;
    originalConsole.log(line, ...entry.data);
  }

  private persistClasses() {
    this.writeJSON(LS_CLASSES, Array.from(this.classes));
  }

  private persistSelected() {
    if (!this.selected) {
      localStorage.removeItem(LS_SELECTED);
    } else {
      this.writeJSON(LS_SELECTED, Array.from(this.selected));
    }
  }

  private persistForward() {
    this.writeJSON(LS_FORWARD, this.forwardEnabled);
  }

  private readJSON<T>(key: string): T | null {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private writeJSON(key: string, value: unknown) {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  }

  private installConsoleForwarders() {
    // console forwarding disabled
  }

  private installErrorHandlers() {
    window.addEventListener("error", (ev) => {
      this.log("error", ev.message ?? "window error", ev.error ?? ev);
    });
    window.addEventListener("unhandledrejection", (ev) => {
      this.log("error", "unhandledrejection", ev.reason);
    });
  }
}

export const logger = new Logger();

export function log(cls: LogClass, message: string, ...data: unknown[]) {
  logger.log(cls, message, ...data);
}

export function logStartup() {
  log("system", "StellarSwarm started", { camera: settings.camera, arena: settings.arena });
}
function formatValue(val: unknown): unknown {
  const seen = new WeakSet<object>();

  const inner = (v: unknown, depth: number): unknown => {
    if (typeof v === "number") return Number(v.toPrecision(2));
    if (typeof v === "string" || typeof v === "boolean" || v === null || v === undefined) return v;
    if (depth <= 0) return "[depth]";
    if (Array.isArray(v)) return v.map((item) => inner(item, depth - 1));
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      if (seen.has(obj)) return "[circular]";
      seen.add(obj);
      const entries = Object.entries(obj).map(([k, val]) => [k, inner(val, depth - 1)]);
      return Object.fromEntries(entries);
    }
    return String(v);
  };

  return inner(val, 3);
}
