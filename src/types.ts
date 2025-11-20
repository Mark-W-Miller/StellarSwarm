export type Settings = {
  arena: {
    size: { width: number; depth: number; height: number };
    voxelSize: number;
    wallHeight: number;
    wallThickness: number;
  };
  camera: {
    radius: number;
    minRadius: number;
    maxRadius: number;
    rotationSpeed: number;
    panSpeed: number;
    dragSensitivity: number;
    travelSpeed: number;
  };
  sim: {
    tickRate: number;
  };
};
