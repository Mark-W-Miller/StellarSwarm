import { BufferGeometry, Color, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Vector3 } from "three";
import type { ArenaModel } from "../model/arenaModel";

export function createAxisAsset(model: ArenaModel) {
  const group = new Group();
  const { half } = model;

  const points: Vector3[] = [];
  const colors: Color[] = [];

  // X axis: red (positive bright, negative dim).
  points.push(new Vector3(-half.x, 0, 0), new Vector3(0, 0, 0));
  colors.push(new Color("#7f1d1d"), new Color("#7f1d1d"));
  points.push(new Vector3(0, 0, 0), new Vector3(half.x, 0, 0));
  colors.push(new Color("#ef4444"), new Color("#ef4444"));

  // Y axis: green.
  points.push(new Vector3(0, -half.y, 0), new Vector3(0, 0, 0));
  colors.push(new Color("#14532d"), new Color("#14532d"));
  points.push(new Vector3(0, 0, 0), new Vector3(0, half.y, 0));
  colors.push(new Color("#22c55e"), new Color("#22c55e"));

  // Z axis: blue.
  points.push(new Vector3(0, 0, -half.z), new Vector3(0, 0, 0));
  colors.push(new Color("#1d4ed8"), new Color("#1d4ed8"));
  points.push(new Vector3(0, 0, 0), new Vector3(0, 0, half.z));
  colors.push(new Color("#60a5fa"), new Color("#60a5fa"));

  const geometry = new BufferGeometry().setFromPoints(points);
  const colorArray = new Float32Array(colors.length * 3);
  colors.forEach((c, i) => {
    colorArray[i * 3] = c.r;
    colorArray[i * 3 + 1] = c.g;
    colorArray[i * 3 + 2] = c.b;
  });
  geometry.setAttribute("color", new Float32BufferAttribute(colorArray, 3));

  const material = new LineBasicMaterial({ vertexColors: true, linewidth: 2 });
  const lines = new LineSegments(geometry, material);
  group.add(lines);

  return group;
}
