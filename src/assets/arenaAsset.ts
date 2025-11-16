import { BufferGeometry, Color, Group, LineBasicMaterial, LineSegments, Vector3 } from "three";
import type { ArenaModel } from "../model/arenaModel";

export function createArenaAsset(model: ArenaModel) {
  const group = new Group();

  // Bounding box, centered at origin.
  const { half } = model;
  const points = [
    // base
    new Vector3(-half.x, -model.height / 2, -half.z),
    new Vector3(half.x, -model.height / 2, -half.z),

    new Vector3(half.x, -model.height / 2, -half.z),
    new Vector3(half.x, -model.height / 2, half.z),

    new Vector3(half.x, -model.height / 2, half.z),
    new Vector3(-half.x, -model.height / 2, half.z),

    new Vector3(-half.x, -model.height / 2, half.z),
    new Vector3(-half.x, -model.height / 2, -half.z),

    // top
    new Vector3(-half.x, model.height / 2, -half.z),
    new Vector3(half.x, model.height / 2, -half.z),

    new Vector3(half.x, model.height / 2, -half.z),
    new Vector3(half.x, model.height / 2, half.z),

    new Vector3(half.x, model.height / 2, half.z),
    new Vector3(-half.x, model.height / 2, half.z),

    new Vector3(-half.x, model.height / 2, half.z),
    new Vector3(-half.x, model.height / 2, -half.z),

    // verticals
    new Vector3(-half.x, -model.height / 2, -half.z),
    new Vector3(-half.x, model.height / 2, -half.z),

    new Vector3(half.x, -model.height / 2, -half.z),
    new Vector3(half.x, model.height / 2, -half.z),

    new Vector3(half.x, -model.height / 2, half.z),
    new Vector3(half.x, model.height / 2, half.z),

    new Vector3(-half.x, -model.height / 2, half.z),
    new Vector3(-half.x, model.height / 2, half.z)
  ];

  const geometry = new BufferGeometry().setFromPoints(points);
  const material = new LineBasicMaterial({ color: new Color("#f5d000") });
  const lines = new LineSegments(geometry, material);
  group.add(lines);

  // Grid lines on all faces, darker color.
  const gridColor = new Color("#7a6400");
  const gridGeomPoints: Vector3[] = [];

  const linesX = Math.max(1, Math.floor(model.width / model.voxelSize / 10));
  const linesY = Math.max(1, Math.floor(model.height / model.voxelSize / 10));
  const linesZ = Math.max(1, Math.floor(model.depth / model.voxelSize / 10));
  const stepX = model.width / linesX;
  const stepY = model.height / linesY;
  const stepZ = model.depth / linesZ;

  // Front/back faces (parallel to XY, at Z +/- half.z).
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

  // Left/right faces (parallel to YZ, at X +/- half.x).
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

  // Top/bottom faces (parallel to XZ, at Y +/- half.y).
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
  const gridLines = new LineSegments(gridGeometry, gridMaterial);
  group.add(gridLines);

  return group;
}
