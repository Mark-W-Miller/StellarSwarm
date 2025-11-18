import type { StarModel } from "../model/starModel";
import type { ArenaAsset } from "../assets/arenaAsset";

export class StarInfoPanel {
  private root: HTMLDivElement;
  private body: HTMLDivElement;
  private visible = false;
  private lastStar: StarModel | null = null;

  constructor(private arenaAsset: ArenaAsset) {
    this.root = document.createElement("div");
    this.root.className = "star-info";
    this.root.style.display = "none";
    this.root.innerHTML = `
      <div class="star-info__header">
        <span>Star Info</span>
        <button class="star-info__close" aria-label="Close">×</button>
      </div>
    `;
    this.body = document.createElement("div");
    this.body.className = "star-info__body";
    this.root.appendChild(this.body);
    document.body.appendChild(this.root);

    this.root.querySelector<HTMLButtonElement>(".star-info__close")?.addEventListener("click", () => this.hide());
  }

  show(star: StarModel) {
    const dist = Math.sqrt(star.position.x ** 2 + star.position.y ** 2 + star.position.z ** 2);
    const intensity = this.arenaAsset.attenuationForStar(star);
    const activePlanets =
      star.orbits?.filter((o) => o.planet && o.hasPlanet).map((o, idx) => ({ orbit: idx + 1, o })) ?? [];
    const planetInfo =
      activePlanets
        .map(({ orbit, o }) => {
          const angleDeg = ((o.planet?.angle ?? 0) * 180) / Math.PI;
          return `<li>Shell ${orbit} (r=${o.radius.toFixed(2)}): planet ${o.planet?.id} ` +
            `radius=${o.planet?.radius.toFixed(2)} color=${o.planet?.color} ` +
            `angle=${angleDeg.toFixed(1)}° speed=${o.planet?.angularSpeed.toFixed(3)}</li>`;
        })
        .join("") ?? "";
    this.lastStar = star;
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
    this.root.style.display = "block";
    this.visible = true;
  }

  hide() {
    this.root.style.display = "none";
    this.visible = false;
  }

  toggle(star?: StarModel) {
    if (this.visible) {
      this.hide();
    } else {
      const target = star ?? this.lastStar;
      if (target) {
        this.show(target);
      }
    }
  }
}
