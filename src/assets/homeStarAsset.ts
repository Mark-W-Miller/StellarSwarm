import {
  Color,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3
} from "three";
import type { StarModel } from "../model/starModel";

type ControlMesh = {
  mesh: Mesh;
  id: string;
};

export class HomeStarAsset {
  mesh: Mesh;
  orbitGroup?: Group;
  private controls: ControlMesh[] = [];
  private baseColor = new Color("#14532d");
  private centerMaterial: MeshStandardMaterial;
  private readonly centerControlId = "CTRL-CENTER";

  constructor(star: StarModel) {
    const geom = new SphereGeometry(star.radius * 0.3, 24, 24);
    this.centerMaterial = new MeshStandardMaterial({
      color: this.baseColor.clone(),
      emissive: this.baseColor.clone(),
      emissiveIntensity: star.brightness,
      roughness: 0.95,
      metalness: 0.02
    });
    this.mesh = new Mesh(geom, this.centerMaterial);
    this.mesh.userData.controlId = this.centerControlId;
    const edges = new LineSegments(new EdgesGeometry(geom), new LineBasicMaterial({ color: new Color("#000000"), transparent: true, opacity: 0.9 }));
    this.mesh.add(edges);

    const controlGeom = new SphereGeometry(star.radius * 0.2, 16, 16);
    (star.controls ?? []).forEach((ctrl, idx) => {
      const mat = new MeshStandardMaterial({
        color: this.baseColor.clone(),
        emissive: this.baseColor.clone(),
        emissiveIntensity: star.brightness,
        roughness: 0.95,
        metalness: 0.02
      });
      const ctrlMesh = new Mesh(controlGeom.clone(), mat);
      const ctrlId = ctrl.id ?? `CTRL-${idx + 1}`;
      ctrlMesh.position.set(ctrl.position.x, ctrl.position.y, ctrl.position.z);
      ctrlMesh.userData.controlId = ctrlId;
      const ctrlEdges = new LineSegments(new EdgesGeometry(controlGeom), new LineBasicMaterial({ color: new Color("#000000"), transparent: true, opacity: 0.9 }));
      ctrlMesh.add(ctrlEdges);
      this.mesh.add(ctrlMesh);
      this.controls.push({ mesh: ctrlMesh, id: ctrlId });
    });
  }

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

  updateBrightness(level: number) {
    const clamped = Math.max(0, Math.min(1, level));
    this.centerMaterial.emissiveIntensity = clamped;
    this.centerMaterial.color.copy(this.baseColor).multiplyScalar(clamped);
    this.controls.forEach(({ mesh }) => {
      const mat = mesh.material as MeshStandardMaterial;
      mat.emissiveIntensity = clamped;
      mat.color.copy(this.baseColor).multiplyScalar(clamped);
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

  private createOrbitGeometry(
    star: StarModel,
    scale: number,
    spokes = 12,
    orbitColors?: string[],
    orbitRadii?: number[]
  ) {
    const planeY = star.radius * 0.2;
    const group = new Group();
    const tubeRadius = Math.max(star.radius * 0.01, 0.02);
    const step = Math.max(star.radius / 2, 1);

    const orbitCount = orbitRadii?.length ?? 0;
    if (orbitCount > 0) {
      for (let ri = 0; ri < orbitCount; ri += 1) {
        const baseR = orbitRadii![ri];
        const rx = baseR * 0.8;
        const rz = rx * (0.7 / 1.3);
        const circumference = Math.PI * (rx + rz);
        const segments = Math.max(12, Math.floor(circumference / step));
        const col = new Color(orbitColors ? orbitColors[Math.min(ri, orbitColors.length - 1)] : star.color);
        for (let i = 0; i < segments; i += 1) {
          const theta1 = (i / segments) * Math.PI * 2;
          const theta2 = ((i + 1) / segments) * Math.PI * 2;
          const y = planeY;
          const p1 = new Vector3(rx * Math.cos(theta1), y, rz * Math.sin(theta1));
          const p2 = new Vector3(rx * Math.cos(theta2), y, rz * Math.sin(theta2));
          group.add(this.makeTube(p1, p2, tubeRadius, col));
        }
      }
    } else {
      const radiusX = star.radius * scale * 1.3;
      const radiusZ = star.radius * scale * 0.7;
      const ringCount = Math.max(4, Math.floor((Math.max(radiusX, radiusZ) - step) / step));
      for (let ri = 1; ri <= ringCount; ri += 1) {
        const colorIdx = Math.min(ri - 1, (orbitColors?.length ?? 1) - 1);
        const t = ri / ringCount;
        const rx = step + (radiusX - step) * t;
        const rz = step + (radiusZ - step) * t;
        const circumference = Math.PI * (rx + rz);
        const segments = Math.max(12, Math.floor(circumference / step));
        const col = new Color(orbitColors ? orbitColors[colorIdx] : star.color);
        for (let i = 0; i < segments; i += 1) {
          const theta1 = (i / segments) * Math.PI * 2;
          const theta2 = ((i + 1) / segments) * Math.PI * 2;
          const y = planeY;
          const p1 = new Vector3(rx * Math.cos(theta1), y, rz * Math.sin(theta1));
          const p2 = new Vector3(rx * Math.cos(theta2), y, rz * Math.sin(theta2));
          group.add(this.makeTube(p1, p2, tubeRadius, col));
        }
      }
    }

    for (let i = 0; i < spokes; i += 1) {
      const theta = (i / spokes) * Math.PI * 2;
      const maxRx = orbitCount > 0 ? orbitRadii![orbitCount - 1] * 0.8 : star.radius * scale * 1.3;
      const maxRz = orbitCount > 0 ? maxRx * (0.7 / 1.3) : star.radius * scale * 0.7;
      const x = maxRx * 0.6 * Math.cos(theta);
      const z = maxRz * 0.6 * Math.sin(theta);
      const p1 = new Vector3(0, planeY, 0);
      const p2 = new Vector3(x, planeY, z);
      group.add(this.makeTube(p1, p2, tubeRadius * 0.5, new Color(star.color)));
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
