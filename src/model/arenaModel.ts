import type { Settings } from "../types";

export type ArenaModel = {
  width: number;
  depth: number;
  height: number;
  voxelSize: number;
  half: { x: number; y: number; z: number };
};

export function createArenaModel(settings: Settings["arena"]): ArenaModel {
  const width = settings.size.width;
  const depth = settings.size.depth;
  const height = settings.size.height;
  const voxelSize = settings.voxelSize;
  return {
    width,
    depth,
    height,
    voxelSize,
    half: {
      x: width / 2,
      y: height / 2,
      z: depth / 2
    }
  };
}
