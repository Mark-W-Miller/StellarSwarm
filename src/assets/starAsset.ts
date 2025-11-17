import { Color, Mesh, MeshStandardMaterial, SphereGeometry } from "three";
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
      emissiveIntensity: 0.3,
      roughness: 0.25,
      metalness: 0.05
    });
    const mesh = new Mesh(this.geometry.clone(), material);
    mesh.scale.setScalar(star.radius);
    mesh.position.set(star.position.x, star.position.y, star.position.z);
    return mesh;
  }

  createSelectionMesh(star: StarModel) {
    const mesh = new Mesh(this.selectionGeometry.clone(), this.selectionMaterial.clone());
    mesh.scale.setScalar(star.radius);
    mesh.position.set(star.position.x, star.position.y, star.position.z);
    return mesh;
  }

  tick(star: StarModel, mesh: Mesh) {
    const intensity = 0.2 + 0.2 * Math.sin(star.phase);
    const mat = mesh.material as MeshStandardMaterial;
    mat.emissiveIntensity = intensity;
  }
}
