import type { Settings } from "../types";

import type { StarModel } from "./starModel";

export type ArenaModel = {
  width: number;
  depth: number;
  height: number;
  voxelSize: number;
  half: { x: number; y: number; z: number };
  stars: StarModel[];
};

export function tickArenaModel(arena: ArenaModel, ticks: number) {
  if (ticks <= 0) return;
  arena.stars.forEach((star) => {
    star.phase = (star.phase + ticks * 0.1) % (Math.PI * 2);
  });
}

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
    },
    stars: []
  };
}
