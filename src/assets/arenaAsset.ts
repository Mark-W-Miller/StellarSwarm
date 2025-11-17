import { BufferGeometry, Color, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial, Vector3 } from "three";
import type { ArenaModel } from "../model/arenaModel";
import type { StarModel } from "../model/starModel";
import { StarAsset } from "./starAsset";

type StarInstance = {
  model: StarModel;
  mesh: Mesh;
};

export class ArenaAsset {
  group: Group;
  private stars: StarInstance[] = [];
  private starAsset: StarAsset;

  constructor(private model: ArenaModel) {
    this.group = new Group();

    this.starAsset = new StarAsset();

    this.buildBounds();
    if (model.stars.length > 0) {
      model.stars.forEach((star) => this.addStar(star));
    }
  }

  addStar(star: StarModel) {
    const mesh = this.starAsset.createMesh(star);
    this.group.add(mesh);
    this.stars.push({ model: star, mesh });
  }

  tick() {
    this.stars.forEach(({ model, mesh }) => {
      this.starAsset.tick(model, mesh);
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
