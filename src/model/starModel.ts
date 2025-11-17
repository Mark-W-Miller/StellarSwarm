export type StarModel = {
  id: string;
  position: { x: number; y: number; z: number };
  radius: number;
  color: string;
  brightness: number;
  phase: number; // for glow animation
};
