import { Color, CylinderGeometry, Mesh, MeshStandardMaterial, SphereGeometry } from "three";
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
}
