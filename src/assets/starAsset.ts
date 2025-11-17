import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3
} from "three";
import type { StarModel } from "../model/starModel";

export class StarAsset {
  private geometry: SphereGeometry;
  private selectionGeometry: SphereGeometry;
  private selectionMaterial: MeshStandardMaterial;

  constructor() {
    this.geometry = new SphereGeometry(1, 16, 16);
    this.selectionGeometry = new SphereGeometry(1.4, 12, 12);
    this.selectionMaterial = new MeshStandardMaterial({
      color: new Color("#ffffff"),
      emissive: new Color("#ffffff"),
      emissiveIntensity: 0.3,
      opacity: 0.35,
      transparent: true,
      roughness: 0.2,
      metalness: 0
    });
  }

  createMesh(star: StarModel) {
    const material = new MeshStandardMaterial({
      color: new Color(star.color),
      emissive: new Color(star.color),
      emissiveIntensity: star.brightness,
      roughness: 0.25,
      metalness: 0.05
    });
    const mesh = new Mesh(this.createGeometryForStar(star), material);
    mesh.position.set(star.position.x, star.position.y, star.position.z);
    return mesh;
  }

  createSelectionMesh(star: StarModel) {
    const geom =
      star.id === "home-star"
        ? new CylinderGeometry(star.radius * 1.1, star.radius * 1.1, star.radius * 1.8, 14)
        : this.selectionGeometry.clone();
    const mesh = new Mesh(geom, this.selectionMaterial.clone());
    mesh.position.set(star.position.x, star.position.y, star.position.z);
    return mesh;
  }

  tick(star: StarModel, mesh: Mesh) {
    const intensity = star.brightness * (0.6 + 0.4 * Math.sin(star.phase));
    const mat = mesh.material as MeshStandardMaterial;
    mat.emissiveIntensity = intensity;
  }

  private createGeometryForStar(star: StarModel) {
    if (star.id === "home-star") {
      return new CylinderGeometry(star.radius, star.radius, star.radius * 1.6, 14);
    }
    const geom = this.geometry.clone();
    geom.scale(star.radius, star.radius, star.radius);
    return geom;
  }

  createCornerMarkerGeometry() {
    const geom = this.geometry.clone();
    geom.scale(8, 8, 8);
    return geom;
  }

  createSubwarpGrid(star: StarModel, scale: number, spokes = 12) {
    const radiusX = star.radius * scale * 1.3;
    const radiusZ = star.radius * scale * 0.7;
    const height = star.radius * 0.4;
    const step = Math.max(star.radius / 2, 1);
    const points: Vector3[] = [];

    const ringCount = Math.max(4, Math.floor((Math.max(radiusX, radiusZ) - step) / step));
    for (let ri = 1; ri <= ringCount; ri += 1) {
      const t = ri / ringCount;
      const rx = step + (radiusX - step) * t;
      const rz = step + (radiusZ - step) * t;
      const circumference = Math.PI * (rx + rz);
      const segments = Math.max(12, Math.floor(circumference / step));
      for (let i = 0; i < segments; i += 1) {
        const theta1 = (i / segments) * Math.PI * 2;
        const theta2 = ((i + 1) / segments) * Math.PI * 2;
        const y = star.radius * 0.2;
        points.push(
          new Vector3(rx * Math.cos(theta1), y, rz * Math.sin(theta1)),
          new Vector3(rx * Math.cos(theta2), y, rz * Math.sin(theta2))
        );
      }
    }

    // Vertical spokes
    for (let i = 0; i < spokes; i += 1) {
      const theta = (i / spokes) * Math.PI * 2;
      const x = radiusX * Math.cos(theta);
      const z = radiusZ * Math.sin(theta);
      points.push(new Vector3(x * 0.4, -height / 2, z * 0.4), new Vector3(x, height / 2, z));
    }

    const geom = new BufferGeometry().setFromPoints(points);
    const mat = new LineBasicMaterial({
      color: new Color(star.color),
      opacity: 0.6,
      transparent: true
    });
    // Hint thicker lines; may be constrained by platform.
    (mat as any).linewidth = 2;
    return new LineSegments(geom, mat);
  }

  getSpinSpeed(star: StarModel) {
    if (star.id === "home-star") {
      return (Math.PI * 2) / 60;
    }
    // Larger stars spin slower; sync by size
    const base = (Math.PI * 2) / 60;
    return base / Math.max(1, star.radius / 3);
  }
}
