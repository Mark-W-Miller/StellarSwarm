import { homeControlStore, type ControlState } from "../state/homeControls";
import { eventBus } from "../engine/eventBus";

const LS_KEY = "stellarswarm:homeinfo";

const DEFAULT_STATE = {
  open: true,
  x: 80,
  y: 80,
  width: 320,
  height: 360
};

type OverlayState = typeof DEFAULT_STATE;

export class HomeInfoOverlay {
  private root: HTMLDivElement;
  private header: HTMLDivElement;
  private summary: HTMLDivElement;
  private grid: HTMLDivElement;
  private details: HTMLDivElement;
  private centerButton: HTMLButtonElement;
  private grip: HTMLDivElement;
  private state: OverlayState;
  private unsubscribe: (() => void) | null = null;
  private controls: ControlState[] = [];
  private selected: string | null = null;
  private centerActive = false;
  private energy = { level: 0, steps: 1 };
  private charges: Record<string, number> = {};

  constructor() {
    this.state = this.load();
    this.root = document.createElement("div");
    this.root.className = "home-overlay";
    this.root.style.left = `${this.state.x}px`;
    this.root.style.top = `${this.state.y}px`;
    this.root.style.width = `${this.state.width}px`;
    this.root.style.height = `${this.state.height}px`;
    this.root.style.display = this.state.open ? "flex" : "none";

    this.header = document.createElement("div");
    this.header.className = "home-overlay__header";
    this.header.textContent = "Home Control Panel";

    const actions = document.createElement("div");
    actions.className = "home-overlay__actions";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close";
    close.className = "home-overlay__btn";
    close.addEventListener("click", () => this.hide());
    actions.appendChild(close);
    this.header.appendChild(actions);

    this.summary = document.createElement("div");
    this.summary.className = "home-overlay__summary";

    this.grid = document.createElement("div");
    this.grid.className = "home-overlay__grid";

    this.details = document.createElement("div");
    this.details.className = "home-overlay__details";

    const centerWrap = document.createElement("div");
    centerWrap.className = "home-overlay__center";
    this.centerButton = document.createElement("button");
    this.centerButton.type = "button";
    this.centerButton.className = "home-overlay__center-btn";
    this.centerButton.textContent = "Center Core";
    this.centerButton.addEventListener("click", () => {
      homeControlStore.setCenterActive(!this.centerActive);
    });
    centerWrap.appendChild(this.centerButton);

    this.grip = document.createElement("div");
    this.grip.className = "home-overlay__grip";

    const body = document.createElement("div");
    body.className = "home-overlay__body";
    body.append(this.summary, centerWrap, this.grid, this.details);

    this.root.append(this.header, body, this.grip);
    document.body.appendChild(this.root);

    this.enableDrag();
    this.enableResize();

    this.unsubscribe = homeControlStore.subscribe(({ controls, centerActive, energy, charges }) => {
      this.centerActive = centerActive;
      this.energy = energy;
      this.charges = charges;
      this.render(controls);
    });
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

  private render(controls: ControlState[]) {
    this.controls = controls;
    if (!this.selected || !this.controls.find((c) => c.id === this.selected)) {
      this.selected = this.controls[0]?.id ?? null;
    }
    const clicked = this.controls.filter((c) => c.clicked).length;
    const starId = this.controls[0]?.starId ?? "S-1";
    const energyPct = Math.round((this.energy.level ?? 0) * 100);
    const stepPercent = 100 / Math.max(1, this.energy.steps);
    this.summary.innerHTML = `
      <div><strong>Home Star:</strong> ${starId}</div>
      <div><strong>Controls:</strong> ${this.controls.length}</div>
      <div><strong>Activated:</strong> ${clicked}</div>
      <div class="home-overlay__energy">
        <div class="home-overlay__energy-bar">
          <div class="home-overlay__energy-fill" style="width:${energyPct}%"></div>
          <div class="home-overlay__energy-steps" style="background-size:${stepPercent}% 100%"></div>
        </div>
        <span class="home-overlay__energy-value">${energyPct}%</span>
      </div>
    `;
    this.centerButton.classList.toggle("active", this.centerActive);
    this.renderGrid();
    this.renderDetails();
  }

  private renderGrid() {
    this.grid.innerHTML = "";
    if (this.controls.length === 0) {
      const empty = document.createElement("div");
      empty.className = "home-overlay__empty";
      empty.textContent = "No controls initialized";
      this.grid.appendChild(empty);
      return;
    }
    this.controls.forEach((ctrl) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "home-overlay__cell";
      if (ctrl.clicked) cell.classList.add("clicked");
      if (ctrl.id === this.selected) cell.classList.add("selected");
      const charge = ctrl.clicked ? this.charges[ctrl.id] ?? 0 : 0;
      const chargePct = Math.round(charge * 100);
      const label = ctrl.symbol ?? ctrl.id.replace(/^CTRL-/, "");
      cell.style.setProperty("--charge-level", `${charge}`);
      cell.style.setProperty("--charge-height", `${chargePct}%`);
      cell.innerHTML = `
        <span class="home-overlay__cell-fill"></span>
        <span class="home-overlay__cell-label">${label}</span>
      `;
      cell.title = `${ctrl.name ?? ctrl.id} (${ctrl.id})`;
      cell.addEventListener("click", () => {
        this.selected = ctrl.id;
        eventBus.emit("control-click", {
          type: "control-click",
          starId: ctrl.starId,
          controlId: ctrl.id
        });
      });
      this.grid.appendChild(cell);
    });
  }

  private renderDetails() {
    if (!this.selected) {
      this.details.textContent = "Select a control to inspect";
      return;
    }
    const ctrl = this.controls.find((c) => c.id === this.selected);
    if (!ctrl) {
      this.details.textContent = "Control not found";
      return;
    }
    const lastClicked = ctrl.lastClickedAt
      ? new Date(ctrl.lastClickedAt).toLocaleTimeString()
      : "—";
    this.details.innerHTML = `
      <div><strong>Control:</strong> ${ctrl.id}</div>
      <div><strong>Symbol:</strong> ${ctrl.symbol ?? "—"} (${ctrl.name ?? ""})</div>
      <div><strong>Status:</strong> ${ctrl.clicked ? "Activated" : "Idle"}</div>
      <div><strong>Position:</strong> (${ctrl.position.x.toFixed(1)}, ${ctrl.position.y.toFixed(
        1
      )}, ${ctrl.position.z.toFixed(1)})</div>
      <div><strong>Last clicked:</strong> ${lastClicked}</div>
    `;
  }

  private enableDrag() {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    this.header.addEventListener("pointerdown", (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".home-overlay__btn")) return;
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

  private enableResize() {
    let resizing = false;
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;

    this.grip.addEventListener("pointerdown", (event) => {
      resizing = true;
      startX = event.clientX;
      startY = event.clientY;
      startW = this.root.offsetWidth;
      startH = this.root.offsetHeight;
      this.grip.setPointerCapture(event.pointerId);
    });

    window.addEventListener("pointermove", (event) => {
      if (!resizing) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      this.state.width = Math.max(280, startW + dx);
      this.state.height = Math.max(240, startH + dy);
      this.root.style.width = `${this.state.width}px`;
      this.root.style.height = `${this.state.height}px`;
    });

    window.addEventListener("pointerup", (event) => {
      if (!resizing) return;
      resizing = false;
      this.grip.releasePointerCapture(event.pointerId);
      this.persist();
    });
  }

  private load(): OverlayState {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    try {
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  private persist() {
    localStorage.setItem(LS_KEY, JSON.stringify(this.state));
  }
}
