import { BufferGeometry, Color, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from "three";
import type { ArenaModel } from "../model/arenaModel";
import type { StarModel } from "../model/starModel";
import { StarAsset } from "./starAsset";

type StarInstance = {
  model: StarModel;
  mesh: Mesh;
  selection?: Mesh;
};

export class ArenaAsset {
  group: Group;
  private stars: StarInstance[] = [];
  private starAsset: StarAsset;
  private starMap = new Map<Mesh, StarModel>();
  private cornerMarkers: Mesh[] = [];

  constructor(private model: ArenaModel) {
    this.group = new Group();

    this.starAsset = new StarAsset();

    this.buildBounds();
    this.buildCornerMarkers();
    if (model.stars.length > 0) {
      model.stars.forEach((star) => this.addStar(star));
    }
  }

  addStar(star: StarModel) {
    const mesh = this.starAsset.createMesh(star);
    this.group.add(mesh);
    this.stars.push({ model: star, mesh });
    this.starMap.set(mesh, star);
  }

  resetStars(nextStars: StarModel[]) {
    this.stars.forEach((s) => {
      this.group.remove(s.mesh);
      if (s.selection) this.group.remove(s.selection);
    });
    this.stars = [];
    this.starMap.clear();
    nextStars.forEach((star) => this.addStar(star));
  }

  tick() {
    this.stars.forEach(({ model, mesh }) => {
      this.starAsset.tick(model, mesh);
    });
  }

  intersectStars(raycaster: Raycaster) {
    const intersects = raycaster.intersectObjects([...this.stars.map((s) => s.mesh), ...this.cornerMarkers], false);
    return intersects.map((hit) => ({
      mesh: hit.object as Mesh,
      star: this.starMap.get(hit.object as Mesh)
    }));
  }

  addSelection(starId: string) {
    const target = this.stars.find((s) => s.model.id === starId);
    if (!target || target.selection) return;
    const selection = this.starAsset.createSelectionMesh(target.model);
    target.selection = selection;
    this.group.add(selection);
  }

  getCornerMarkers() {
    return this.cornerMarkers.map((mesh) => ({ mesh, position: mesh.position.clone() }));
  }

  private buildCornerMarkers() {
    const markerGeom = this.starAsset.createCornerMarkerGeometry();
    const markerMat = new MeshStandardMaterial({
      color: new Color("#ff3b30"),
      emissive: new Color("#ff3b30"),
      emissiveIntensity: 0.5
    });
    const corners: Vector3[] = [
      new Vector3(this.model.half.x, this.model.half.y, this.model.half.z),
      new Vector3(this.model.half.x, this.model.half.y, -this.model.half.z),
      new Vector3(this.model.half.x, -this.model.half.y, this.model.half.z),
      new Vector3(this.model.half.x, -this.model.half.y, -this.model.half.z),
      new Vector3(-this.model.half.x, this.model.half.y, this.model.half.z),
      new Vector3(-this.model.half.x, this.model.half.y, -this.model.half.z),
      new Vector3(-this.model.half.x, -this.model.half.y, this.model.half.z),
      new Vector3(-this.model.half.x, -this.model.half.y, -this.model.half.z)
    ];
    corners.forEach((pos) => {
      const mesh = new Mesh(markerGeom.clone(), markerMat.clone());
      mesh.position.copy(pos);
      this.group.add(mesh);
      this.cornerMarkers.push(mesh);
    });
  }

  private buildBounds() {
    const { half, height, width, depth, voxelSize } = this.model;

    // Bounding box lines.
    const points = [
      new Vector3(-half.x, -height / 2, -half.z),
      new Vector3(half.x, -height / 2, -half.z),

      new Vector3(half.x, -height / 2, -half.z),
      new Vector3(half.x, -height / 2, half.z),

      new Vector3(half.x, -height / 2, half.z),
      new Vector3(-half.x, -height / 2, half.z),

      new Vector3(-half.x, -height / 2, half.z),
      new Vector3(-half.x, -height / 2, -half.z),

      // top
      new Vector3(-half.x, height / 2, -half.z),
      new Vector3(half.x, height / 2, -half.z),

      new Vector3(half.x, height / 2, -half.z),
      new Vector3(half.x, height / 2, half.z),

      new Vector3(half.x, height / 2, half.z),
      new Vector3(-half.x, height / 2, half.z),

      new Vector3(-half.x, height / 2, half.z),
      new Vector3(-half.x, height / 2, -half.z),

      // verticals
      new Vector3(-half.x, -height / 2, -half.z),
      new Vector3(-half.x, height / 2, -half.z),

      new Vector3(half.x, -height / 2, -half.z),
      new Vector3(half.x, height / 2, -half.z),

      new Vector3(half.x, -height / 2, half.z),
      new Vector3(half.x, height / 2, half.z),

      new Vector3(-half.x, -height / 2, half.z),
      new Vector3(-half.x, height / 2, half.z)
    ];

    const boxGeometry = new BufferGeometry().setFromPoints(points);
    const boxMaterial = new LineBasicMaterial({ color: new Color("#f5d000") });
    this.group.add(new LineSegments(boxGeometry, boxMaterial));

    // Grid lines on faces.
    const gridColor = new Color("#7a6400");
    const gridGeomPoints: Vector3[] = [];

    const linesX = Math.max(1, Math.floor(width / voxelSize / 10));
    const linesY = Math.max(1, Math.floor(height / voxelSize / 10));
    const linesZ = Math.max(1, Math.floor(depth / voxelSize / 10));
    const stepX = width / linesX;
    const stepY = height / linesY;
    const stepZ = depth / linesZ;

    // Front/back (XY planes at +/- z).
    for (let i = 1; i < linesX; i += 1) {
      const x = -half.x + i * stepX;
      gridGeomPoints.push(new Vector3(x, -half.y, half.z), new Vector3(x, half.y, half.z));
      gridGeomPoints.push(new Vector3(x, -half.y, -half.z), new Vector3(x, half.y, -half.z));
    }
    for (let i = 1; i < linesY; i += 1) {
      const y = -half.y + i * stepY;
      gridGeomPoints.push(new Vector3(-half.x, y, half.z), new Vector3(half.x, y, half.z));
      gridGeomPoints.push(new Vector3(-half.x, y, -half.z), new Vector3(half.x, y, -half.z));
    }

    // Left/right (YZ planes at +/- x).
    for (let i = 1; i < linesZ; i += 1) {
      const z = -half.z + i * stepZ;
      gridGeomPoints.push(new Vector3(-half.x, -half.y, z), new Vector3(-half.x, half.y, z));
      gridGeomPoints.push(new Vector3(half.x, -half.y, z), new Vector3(half.x, half.y, z));
    }
    for (let i = 1; i < linesY; i += 1) {
      const y = -half.y + i * stepY;
      gridGeomPoints.push(new Vector3(-half.x, y, -half.z), new Vector3(-half.x, y, half.z));
      gridGeomPoints.push(new Vector3(half.x, y, -half.z), new Vector3(half.x, y, half.z));
    }

    // Top/bottom (XZ planes at +/- y).
    for (let i = 1; i < linesX; i += 1) {
      const x = -half.x + i * stepX;
      gridGeomPoints.push(new Vector3(x, -half.y, -half.z), new Vector3(x, -half.y, half.z));
      gridGeomPoints.push(new Vector3(x, half.y, -half.z), new Vector3(x, half.y, half.z));
    }
    for (let i = 1; i < linesZ; i += 1) {
      const z = -half.z + i * stepZ;
      gridGeomPoints.push(new Vector3(-half.x, -half.y, z), new Vector3(half.x, -half.y, z));
      gridGeomPoints.push(new Vector3(-half.x, half.y, z), new Vector3(half.x, half.y, z));
    }

    const gridGeometry = new BufferGeometry().setFromPoints(gridGeomPoints);
    const gridMaterial = new LineBasicMaterial({ color: gridColor });
    this.group.add(new LineSegments(gridGeometry, gridMaterial));
  }
}
