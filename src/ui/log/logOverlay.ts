import { logger, type LoggerState } from "./logger";

type OverlayState = {
  open: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

const LS_UI = "stellarswarm:log:ui";
const DEFAULT_STATE: OverlayState = {
  open: false,
  x: 24,
  y: 24,
  width: 440,
  height: 320
};

export class LogOverlay {
  private root: HTMLDivElement;
  private header: HTMLDivElement;
  private body: HTMLDivElement;
  private filters: HTMLDivElement;
  private list: HTMLDivElement;
  private unsubscribe: (() => void) | null = null;
  private state: OverlayState;

  constructor() {
    this.state = this.load();
    this.root = document.createElement("div");
    this.root.className = "log-overlay";
    this.root.style.width = `${this.state.width}px`;
    this.root.style.height = `${this.state.height}px`;
    this.root.style.left = `${this.state.x}px`;
    this.root.style.top = `${this.state.y}px`;
    this.root.style.display = this.state.open ? "flex" : "none";

    this.header = document.createElement("div");
    this.header.className = "log-overlay__header";
    this.header.textContent = "Log";

    const actions = document.createElement("div");
    actions.className = "log-overlay__actions";

    const btnClear = this.makeButton("Clear", () => logger.clear());
    const btnCopy = this.makeButton("Copy", () => this.copyLines());
    const btnClose = this.makeButton("Close", () => this.hide());

    actions.append(btnClear, btnCopy, btnClose);
    this.header.appendChild(actions);

    this.filters = document.createElement("div");
    this.filters.className = "log-overlay__filters";

    this.list = document.createElement("div");
    this.list.className = "log-overlay__list";

    this.body = document.createElement("div");
    this.body.className = "log-overlay__body";
    this.body.append(this.filters, this.list);

    const grip = document.createElement("div");
    grip.className = "log-overlay__grip";

    this.root.append(this.header, this.body, grip);
    document.body.appendChild(this.root);

    this.enableDrag();
    this.enableResize(grip);
    this.unsubscribe = logger.subscribe((state) => this.render(state));

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === this.root) {
          const { width, height } = entry.contentRect;
          this.state.width = Math.max(320, width);
          this.state.height = Math.max(200, height);
          this.persist();
        }
      }
    });
    ro.observe(this.root);
  }

  toggle() {
    if (this.root.style.display === "none") {
      this.show();
    } else {
      this.hide();
    }
  }

  show() {
    this.state.open = true;
    this.root.style.display = "flex";
    this.persist();
  }

  hide() {
    this.state.open = false;
    this.root.style.display = "none";
    this.persist();
  }

  destroy() {
    this.unsubscribe?.();
    this.root.remove();
  }

  private render(state: LoggerState) {
    this.renderFilters(state);
    this.renderList(state);
  }

  private renderFilters(state: LoggerState) {
    this.filters.innerHTML = "";
    const selected = state.selectedClasses ? new Set(state.selectedClasses) : null;

    const makeFilter = (label: string, cls: string | null) => {
      const wrap = document.createElement("label");
      wrap.className = "log-overlay__filter";
      const input = document.createElement("input");
      input.type = "checkbox";

      if (!cls) {
        input.checked = selected === null;
      } else {
        input.checked = selected === null || selected.has(cls);
      }

      input.addEventListener("change", () => {
        if (!cls) {
          logger.setSelectedClasses(null);
        } else {
          const next = selected ? new Set(selected) : new Set(state.classes);
          if (input.checked) {
            next.add(cls);
          } else {
            next.delete(cls);
          }
          if (next.size === state.classes.length) {
            logger.setSelectedClasses(null);
          } else {
            logger.setSelectedClasses(Array.from(next));
          }
        }
      });

      const span = document.createElement("span");
      span.textContent = label;
      wrap.append(input, span);
      return wrap;
    };

    this.filters.appendChild(makeFilter("All", null));
    state.classes.forEach((cls) => {
      this.filters.appendChild(makeFilter(cls, cls));
    });
  }

  private renderList(state: LoggerState) {
    this.list.innerHTML = "";
    const selected = state.selectedClasses ? new Set(state.selectedClasses) : null;
    state.entries.forEach((entry) => {
      if (selected && !selected.has(entry.cls)) return;
      const line = document.createElement("div");
      line.className = "log-overlay__line";
      const rawTime = new Date(entry.time);
      const time = rawTime.toLocaleTimeString(undefined, { hour12: false });
      line.textContent = `[${time}] [${entry.cls}] ${entry.message}`;
      if (entry.data.length > 0) {
        const dataStr = entry.data
          .map((d) => (typeof d === "number" ? Number(d.toPrecision(2)) : JSON.stringify(d)))
          .join(" ");
        const dataSpan = document.createElement("span");
        dataSpan.className = "log-overlay__data";
        dataSpan.textContent = ` ${dataStr}`;
        line.appendChild(dataSpan);
      }
      this.list.appendChild(line);
    });
    this.list.scrollTop = this.list.scrollHeight + 50;
  }

  private copyLines() {
    const text = Array.from(this.list.querySelectorAll(".log-overlay__line"))
      .map((node) => node.textContent ?? "")
      .join("\n");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    } else {
      const temp = document.createElement("textarea");
      temp.value = text;
      document.body.appendChild(temp);
      temp.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(temp);
    }
  }

  private makeButton(label: string, onClick: () => void) {
    const btn = document.createElement("button");
    btn.className = "log-overlay__btn";
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  private enableDrag() {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    this.header.addEventListener("pointerdown", (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".log-overlay__btn")) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = this.root.offsetLeft;
      startTop = this.root.offsetTop;
      this.header.setPointerCapture(event.pointerId);
    });

    window.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      this.state.x = startLeft + dx;
      this.state.y = startTop + dy;
      this.root.style.left = `${this.state.x}px`;
      this.root.style.top = `${this.state.y}px`;
    });

    window.addEventListener("pointerup", (event) => {
      if (!dragging) return;
      dragging = false;
      this.header.releasePointerCapture(event.pointerId);
      this.persist();
    });
  }

  private enableResize(grip: HTMLDivElement) {
    let resizing = false;
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;

    grip.addEventListener("pointerdown", (event) => {
      resizing = true;
      startX = event.clientX;
      startY = event.clientY;
      startW = this.root.offsetWidth;
      startH = this.root.offsetHeight;
      grip.setPointerCapture(event.pointerId);
    });

    window.addEventListener("pointermove", (event) => {
      if (!resizing) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      this.state.width = Math.max(320, startW + dx);
      this.state.height = Math.max(200, startH + dy);
      this.root.style.width = `${this.state.width}px`;
      this.root.style.height = `${this.state.height}px`;
    });

    window.addEventListener("pointerup", (event) => {
      if (!resizing) return;
      resizing = false;
      grip.releasePointerCapture(event.pointerId);
      this.persist();
    });
  }

  private load(): OverlayState {
    const raw = localStorage.getItem(LS_UI);
    if (!raw) return DEFAULT_STATE;
    try {
      const parsed = JSON.parse(raw) as OverlayState;
      return { ...DEFAULT_STATE, ...parsed };
    } catch {
      return DEFAULT_STATE;
    }
  }

  private persist() {
    localStorage.setItem(LS_UI, JSON.stringify(this.state));
  }
}
