export type StarModel = {
  id: string;
  position: { x: number; y: number; z: number };
  radius: number;
  color: string;
  phase: number; // for glow animation
};
