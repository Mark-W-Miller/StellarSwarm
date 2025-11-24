import {
  Color,
  DoubleSide,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Texture,
  TextureLoader,
  Vector3,
  SRGBColorSpace
} from "three";
import { HOME_STAR_ID } from "../model/starModel";
import type { HomeControlModel, StarModel } from "../model/starModel";

type ControlMesh = {
  mesh: Mesh;
  id: string;
  axis: Vector3;
  spoke?: Mesh;
  fill?: Mesh;
};

export class HomeStarAsset {
  mesh: Mesh;
  orbitGroup?: Group;
  private controls: ControlMesh[] = [];
  private baseColor = new Color("#14532d");
  private highlightColor = new Color("#facc15");
  private centerMaterial!: MeshStandardMaterial;
  private readonly centerControlId = "CTRL-CENTER";
  private highlighted = new Set<string>();
  private lastBrightness = 1;
  private readonly spinAxis = new Vector3(0, 1, 0);
  private greekTextures: Map<string, Texture>;
  private energyLevel = 0;
  private readonly energySteps: number;
  private readonly controlFillSteps: number;
  private readonly controlRadius: number;
  private readonly fillColor = new Color("#14532d");
  private controlCharge = new Map<string, number>();

  private static textureLoader = new TextureLoader().setPath("/textures/homeControls/");
  private static textureNames = [
    "phi",
    "psi",
    "omega",
    "chi",
    "sigma",
    "rho",
    "xi",
    "theta",
    "eta",
    "pi",
    "gamma",
    "delta",
    "lambda",
    "zeta"
  ];
  private static cachedTextures: Map<string, Texture> | null = null;

  /**
   * Build the home star visuals and its control spheres.
   * - Samples the center sphere geometry to decide how many discrete energy steps we expose.
   * - Sizes control spheres and adds a nested fill sphere that scales up as the control charges.
   * - Applies the Greek texture set, edge outlines, and spoke lines back to the core.
   */
  constructor(star: StarModel) {
    this.greekTextures = HomeStarAsset.getTextures();
    const centerGeom = new SphereGeometry(star.radius * 0.3, 24, 24);
    this.energySteps = Math.max(1, (centerGeom.index?.count ?? 0) / 3);
    this.controlRadius = star.radius * 0.2;
    this.controlFillSteps = Math.max(1, Math.floor(this.energySteps));
    this.mesh = this.buildCenter(star, centerGeom);

    const controlGeom = new SphereGeometry(this.controlRadius, 16, 16);
    (star.controls ?? []).forEach((ctrl, idx) => {
      const control = this.buildControl(ctrl, idx, star, controlGeom);
      this.mesh.add(control.mesh);
      if (control.spoke) this.mesh.add(control.spoke);
      this.controls.push(control);
      this.controlCharge.set(control.id, 0);
    });
  }

  /** Build and return the orbit geometry around the home star (rings and spokes). */
  buildOrbitGeometry(
    star: StarModel,
    scale: number,
    spokes = 12,
    orbitColors?: string[],
    orbitRadii?: number[]
  ) {
    this.orbitGroup = this.createOrbitGeometry(star, scale, spokes, orbitColors, orbitRadii);
    return this.orbitGroup;
  }

  /** Refresh brightness on the core, controls, and orbit visuals from star state. */
  updateBrightness(level: number) {
    const clamped = Math.max(0, Math.min(1, level));
    this.lastBrightness = clamped;
    this.centerMaterial.emissiveIntensity = clamped;
    this.centerMaterial.color.copy(this.baseColor).multiplyScalar(clamped);
    this.controls.forEach(({ mesh }) => {
      this.applyControlMaterial(mesh as Mesh, clamped);
    });
    if (this.orbitGroup) {
      this.orbitGroup.traverse((obj) => {
        if (!(obj as Mesh).isMesh) return;
        const mat = (obj as Mesh).material as MeshStandardMaterial;
        if (!mat) return;
        const base =
          ((obj as any).userData?.baseColor as Color) ?? (mat.userData.baseColor as Color) ?? this.baseColor;
        mat.emissiveIntensity = clamped;
        mat.color.copy(base).multiplyScalar(clamped);
        mat.emissive.copy(base);
        mat.opacity = clamped;
        mat.transparent = true;
        mat.needsUpdate = true;
      });
    }
  }

  getControlMeshes() {
    return [
      { mesh: this.mesh, id: this.centerControlId },
      ...this.controls.map((ctrl) => ({ mesh: ctrl.mesh, id: ctrl.id }))
    ];
  }

  /** Toggle a single control highlight and reset its charge if turning off. */
  setControlHighlight(controlId: string, active: boolean) {
    const ctrl = this.controls.find((c) => c.id === controlId);
    if (!ctrl) return;
    if (active) {
      this.highlighted.add(controlId);
    } else {
      this.highlighted.delete(controlId);
      this.controlCharge.set(controlId, 0);
    }
    this.applyControlMaterial(ctrl.mesh, this.lastBrightness);
  }

  /** Sync control highlights from an external list of states. */
  syncControlHighlights(states: Array<{ id: string; clicked: boolean }>) {
    const lookup = new Map(states.map((s) => [s.id, s.clicked]));
    this.controls.forEach((ctrl) => {
      const active = lookup.get(ctrl.id) ?? false;
      if (active) this.highlighted.add(ctrl.id);
      else {
        this.highlighted.delete(ctrl.id);
        this.controlCharge.set(ctrl.id, 0);
      }
      this.applyControlMaterial(ctrl.mesh, this.lastBrightness);
    });
  }

  private applyControlMaterial(mesh: Mesh, intensity: number) {
    const ctrlId = mesh.userData.controlId as string | undefined;
    const mat = mesh.material as MeshStandardMaterial;
    if (!mat || !ctrlId) return;
    const base = this.highlighted.has(ctrlId) ? this.highlightColor : this.baseColor;
    mat.emissiveIntensity = intensity * 0.35;
    mat.emissive.copy(base);
    mat.needsUpdate = true;
    const ctrl = this.controls.find((c) => c.id === ctrlId);
    if (ctrl) {
      const charge = this.controlCharge.get(ctrlId) ?? 0;
      this.updateControlFill(ctrl, this.highlighted.has(ctrlId) ? charge : 0);
    }
  }

  rotateControlShell(angle: number) {
    if (angle === 0) return;
    this.regenerateEnergy(Math.abs(angle));
    this.controls.forEach((ctrl) => {
      const sign = ctrl.mesh.position.y >= 0 ? 1 : -1;
      ctrl.mesh.rotateOnAxis(ctrl.axis, angle * sign);
      if (ctrl.spoke) {
        ctrl.spoke.rotateOnAxis(ctrl.axis, angle * sign);
      }
    });
  }

  regenerateEnergy(angleDelta: number) {
    const delta = Math.abs(angleDelta) / (Math.PI * 2); // fraction of a full rotation
    let maxLevel = 0;
    this.controls.forEach((ctrl) => {
      const active = this.highlighted.has(ctrl.id);
      const current = this.controlCharge.get(ctrl.id) ?? 0;
      const next = active ? Math.min(1, current + delta) : 0;
      const quantized = Math.floor(next * this.controlFillSteps) / this.controlFillSteps;
      this.controlCharge.set(ctrl.id, quantized);
      maxLevel = Math.max(maxLevel, quantized);
      this.updateControlFill(ctrl, quantized);
    });
    const quantizedEnergy = Math.floor(maxLevel * this.energySteps) / this.energySteps;
    if (quantizedEnergy !== this.energyLevel) {
      this.energyLevel = quantizedEnergy;
    }
  }

  getEnergySnapshot() {
    return { level: this.energyLevel, steps: this.energySteps };
  }

  /** Expose per-control charge levels for UI sync. */
  getControlCharges() {
    return Array.from(this.controlCharge.entries()).map(([id, level]) => ({ id, level }));
  }

  /** Update visual fill of a control based on quantized charge. */
  private updateControlFill(ctrl: ControlMesh, level: number) {
    if (!ctrl.fill) return;
    const steps = this.controlFillSteps;
    const quantized = Math.floor(Math.max(0, Math.min(1, level)) * steps) / steps;
    ctrl.fill.visible = quantized > 0;
    const radius = (ctrl.fill.userData.fillRadius as number | undefined) ?? this.controlRadius * 0.82;
    const heightScale = Math.max(0.01, quantized);
    // Grow upward: keep X/Z full, scale Y, and offset so the base stays anchored.
    ctrl.fill.scale.set(1, heightScale, 1);
    const yOffset = -radius + radius * heightScale;
    ctrl.fill.position.set(0, yOffset, 0);
    const mat = ctrl.fill.material as MeshStandardMaterial;
    mat.opacity = 0.4 + quantized * 0.6;
    mat.emissiveIntensity = 0.3 + quantized * 0.7;
    mat.needsUpdate = true;
  }

  /** Build the core mesh with outline and material seeded from the star. */
  private buildCenter(star: StarModel, geom: SphereGeometry) {
    this.centerMaterial = new MeshStandardMaterial({
      color: this.baseColor.clone(),
      emissive: this.baseColor.clone(),
      emissiveIntensity: star.brightness,
      roughness: 0.95,
      metalness: 0.02
    });
    const mesh = new Mesh(geom, this.centerMaterial);
    mesh.userData.controlId = this.centerControlId;
    const edges = new LineSegments(new EdgesGeometry(geom), new LineBasicMaterial({ color: new Color("#000000"), transparent: true, opacity: 0.9 }));
    mesh.add(edges);
    return mesh;
  }

  /** Build a single control sphere with texture, outline, fill sphere, and spoke line. */
  private buildControl(
    ctrl: HomeControlModel,
    idx: number,
    star: StarModel,
    controlGeom: SphereGeometry
  ): ControlMesh {
    // Material for the physical control shell (texture gets applied below)
    const mat = new MeshStandardMaterial({
      color: new Color("#ffffff"),
      emissive: this.baseColor.clone(),
      emissiveIntensity: star.brightness,
      roughness: 0.85,
      metalness: 0.05
    });
    const texName = ctrl.texture ?? HomeStarAsset.textureNames[idx % HomeStarAsset.textureNames.length];
    const tex = this.greekTextures.get(texName);
    if (tex) {
      mat.map = tex;
      mat.needsUpdate = true;
    }
    // Control sphere itself
    const ctrlMesh = new Mesh(controlGeom.clone(), mat);
    const ctrlId = ctrl.id ?? `CTRL-${idx + 1}`;
    ctrlMesh.position.set(ctrl.position.x, ctrl.position.y, ctrl.position.z);
    ctrlMesh.userData.controlId = ctrlId;
    // Outline to keep silhouette crisp
    const ctrlEdges = new LineSegments(new EdgesGeometry(controlGeom), new LineBasicMaterial({ color: new Color("#ffffff"), transparent: true, opacity: 0.9 }));
    ctrlMesh.add(ctrlEdges);

    // Inner fill sphere that scales up as charge accumulates
    const fillGeom = new SphereGeometry(this.controlRadius * 0.82, 18, 18);
    const fillMat = new MeshStandardMaterial({
      color: this.fillColor.clone(),
      emissive: this.fillColor.clone(),
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.65,
      roughness: 0.35,
      metalness: 0.05,
      side: DoubleSide
    });
    const fillMesh = new Mesh(fillGeom, fillMat);
    fillMesh.visible = false;
    fillMesh.userData.fillRadius = this.controlRadius * 0.82;
    ctrlMesh.add(fillMesh);

    // Spoke back to the core for visual linkage
    const length = ctrlMesh.position.length();
    const dir = ctrlMesh.position.clone().normalize();
    const lineGeom = new CylinderGeometry(star.radius * 0.02, star.radius * 0.02, length, 8, 1, true);
    lineGeom.translate(0, length / 2, 0);
    const lineMat = new MeshStandardMaterial({ color: new Color("#1f2937"), roughness: 0.4, metalness: 0.1, transparent: true, opacity: 0.7 });
    const lineMesh = new Mesh(lineGeom, lineMat);
    lineMesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir);

    return { mesh: ctrlMesh, id: ctrlId, axis: this.spinAxis.clone(), spoke: lineMesh, fill: fillMesh };
  }

  private static getTextures() {
    if (this.cachedTextures) return this.cachedTextures;
    this.cachedTextures = new Map();
    this.textureNames.forEach((name) => {
      const tex = this.textureLoader.load(`${name}.png`);
      tex.colorSpace = SRGBColorSpace;
      tex.needsUpdate = true;
      this.cachedTextures!.set(name, tex);
    });
    return this.cachedTextures;
  }

  private createOrbitGeometry(
    star: StarModel,
    scale: number,
    spokes = 12,
    orbitColors?: string[],
    orbitRadii?: number[]
  ) {
    const radiusX = star.radius * scale * 1.3;
    const radiusZ = star.radius * scale * 0.7;
    const planeY = star.id === HOME_STAR_ID ? 0 : star.radius * 0.2;
    const group = new Group();
    const tubeRadius = Math.max(star.radius * 0.0125, 0.02);
    const step = Math.max(star.radius / 2, 1);

    const orbitCount = orbitRadii?.length ?? 0;
    if (orbitCount > 0) {
      for (let ri = 0; ri < orbitCount; ri += 1) {
        const baseR = orbitRadii![ri];
        const rx = baseR * 0.8;
        const rz = rx * (0.7 / 1.3);
        const circumference = Math.PI * (rx + rz);
        const baseSegments = Math.max(12, Math.floor(circumference / step));
        const segments = baseSegments * 2;
        const c = new Color(orbitColors ? orbitColors[Math.min(ri, orbitColors.length - 1)] : star.color);
        for (let i = 0; i < segments; i += 1) {
          const theta1 = (i / segments) * Math.PI * 2;
          const theta2 = ((i + 1) / segments) * Math.PI * 2;
          const y = planeY;
          const p1 = new Vector3(rx * Math.cos(theta1), y, rz * Math.sin(theta1));
          const p2 = new Vector3(rx * Math.cos(theta2), y, rz * Math.sin(theta2));
          group.add(this.makeTube(p1, p2, tubeRadius, c));
        }
      }
    } else {
      const ringCount = Math.max(4, Math.floor((Math.max(radiusX, radiusZ) - step) / step));
      for (let ri = 1; ri <= ringCount; ri += 1) {
        const colorIdx = Math.min(ri - 1, (orbitColors?.length ?? 1) - 1);
        const t = ri / ringCount;
        const rx = step + (radiusX - step) * t;
        const rz = step + (radiusZ - step) * t;
        const circumference = Math.PI * (rx + rz);
        const baseSegments = Math.max(12, Math.floor(circumference / step));
        const segments = baseSegments * 2;
        const c = new Color(orbitColors ? orbitColors[colorIdx] : star.color);
        for (let i = 0; i < segments; i += 1) {
          const theta1 = (i / segments) * Math.PI * 2;
          const theta2 = ((i + 1) / segments) * Math.PI * 2;
          const y = planeY;
          const p1 = new Vector3(rx * Math.cos(theta1), y, rz * Math.sin(theta1));
          const p2 = new Vector3(rx * Math.cos(theta2), y, rz * Math.sin(theta2));
          group.add(this.makeTube(p1, p2, tubeRadius, c));
        }
      }
    }

    return group;
  }

  private makeTube(start: Vector3, end: Vector3, radius: number, color: Color) {
    const dir = new Vector3().subVectors(end, start);
    const len = dir.length();
    const geom = new CylinderGeometry(radius, radius, len, 10, 1, true);
    const mat = new MeshStandardMaterial({
      color: color.clone(),
      emissive: color.clone(),
      emissiveIntensity: 0.8,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true
    });
    mat.userData.baseColor = color.clone();
    const mesh = new Mesh(geom, mat);
    mesh.userData.baseColor = color.clone();
    const midpoint = new Vector3().addVectors(start, end).multiplyScalar(0.5);
    mesh.position.copy(midpoint);
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize());
    return mesh;
  }
}
