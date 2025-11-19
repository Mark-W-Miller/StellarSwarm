import type { StarModel } from "../model/starModel";
import type { ArenaAsset } from "../assets/arenaAsset";

const LS_KEY = "stellarswarm:starinfo";
type PanelState = {
  open: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

export class StarInfoPanel {
  private root: HTMLDivElement;
  private header: HTMLDivElement;
  private body: HTMLDivElement;
  private visible = false;
  private lastStar: StarModel | null = null;
  private state: PanelState;

  constructor(private arenaAsset: ArenaAsset) {
    this.state = this.loadState();
    this.root = document.createElement("div");
    this.root.className = "star-info";
    this.root.style.left = `${this.state.x}px`;
    this.root.style.top = `${this.state.y}px`;
    this.root.style.width = `${this.state.width}px`;
    this.root.style.height = `${this.state.height}px`;
    this.root.style.display = this.state.open ? "block" : "none";
    this.visible = this.state.open;
    this.root.innerHTML = `
      <div class="star-info__header">
        <span>Star Info</span>
        <button class="star-info__close" aria-label="Close">×</button>
      </div>
    `;
    this.header = this.root.querySelector<HTMLDivElement>(".star-info__header")!;
    this.body = document.createElement("div");
    this.body.className = "star-info__body";
    this.root.appendChild(this.body);
    document.body.appendChild(this.root);

    this.root.querySelector<HTMLButtonElement>(".star-info__close")?.addEventListener("click", () => this.hide());
    this.enableDrag();
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === this.root) {
          const { width, height } = entry.contentRect;
          this.state.width = Math.max(220, width);
          this.state.height = Math.max(120, height);
          this.persist();
        }
      }
    });
    ro.observe(this.root);

    if (this.visible) {
      this.render();
    } else {
      this.body.innerHTML = "<div>No star selected</div>";
    }
  }

  setStar(star: StarModel | null) {
    this.lastStar = star;
    if (this.visible) {
      this.render();
    }
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    this.root.style.display = "block";
    this.render();
    this.persist();
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.root.style.display = "none";
    this.persist();
  }

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  isVisible() {
    return this.visible;
  }

  private render() {
    if (!this.visible) return;
    if (!this.lastStar) {
      this.body.innerHTML = "<div>No star selected</div>";
      return;
    }
    const star = this.lastStar;
    const dist = Math.sqrt(star.position.x ** 2 + star.position.y ** 2 + star.position.z ** 2);
    const intensity = this.arenaAsset.attenuationForStar(star);
    const activePlanets =
      star.orbits?.filter((o) => o.planet && o.hasPlanet).map((o, idx) => ({ orbit: idx + 1, o })) ?? [];
    const planetInfo =
      activePlanets
        .map(({ orbit, o }) => {
          const angleDeg = ((o.planet?.angle ?? 0) * 180) / Math.PI;
          const rawR = o.radius;
          const pathMajor = rawR * 0.8;
          const pathMinor = pathMajor * (0.7 / 1.3);
          return `
            <li>
              Shell ${orbit} (orbit r=${rawR.toFixed(2)}):
              planet ${o.planet?.id}
              radius=${o.planet?.radius.toFixed(2)}
              color=${o.planet?.color}
              angle=${angleDeg.toFixed(1)}°
              speed=${o.planet?.angularSpeed.toFixed(3)}
              | ellipse (display) major=${pathMajor.toFixed(2)} minor=${pathMinor.toFixed(2)}
              | path calc major=${pathMajor.toFixed(2)} minor=${pathMinor.toFixed(2)}
            </li>`;
        })
        .join("") ?? "";
    this.body.innerHTML = `
      <div><strong>ID:</strong> ${star.id}</div>
      <div><strong>Color:</strong> ${star.color}</div>
      <div><strong>Radius:</strong> ${star.radius.toFixed(2)}</div>
      <div><strong>Brightness:</strong> ${star.brightness.toFixed(2)}</div>
      <div><strong>Position:</strong> (${star.position.x.toFixed(2)}, ${star.position.y.toFixed(2)}, ${star.position.z.toFixed(2)})</div>
      <div><strong>Distance:</strong> ${dist.toFixed(2)}</div>
      <div><strong>Intensity:</strong> ${intensity.toFixed(3)}</div>
      <div><strong>Planets:</strong> ${activePlanets.length}</div>
      <ul>${planetInfo || "<li>None</li>"}</ul>
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
      if (target?.closest(".star-info__close")) return;
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

  private loadState(): PanelState {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      return { open: false, x: 10, y: 50, width: 260, height: 200 };
    }
    try {
      const parsed = JSON.parse(raw) as PanelState;
      return {
        open: parsed.open ?? false,
        x: parsed.x ?? 10,
        y: parsed.y ?? 50,
        width: parsed.width ?? 260,
        height: parsed.height ?? 200
      };
    } catch {
      return { open: false, x: 10, y: 50, width: 260, height: 200 };
    }
  }

  private persist() {
    const state: PanelState = {
      open: this.visible,
      x: this.state.x,
      y: this.state.y,
      width: this.state.width,
      height: this.state.height
    };
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }
}
