export type HomeControlModel = {
  id: string;
  position: { x: number; y: number; z: number };
  symbol: string;
  texture: string;
  name: string;
};

export type StarModel = {
  id: string;
  position: { x: number; y: number; z: number };
  radius: number;
  color: string;
  brightness: number;
  brightnessControl: number;
  phase: number; // for glow animation
  orbits?: Array<{ radius: number; hasPlanet: boolean; planet?: PlanetModel }>;
  controls?: HomeControlModel[];
};

export type PlanetModel = {
  id: string;
  radius: number;
  color: string;
  angle: number;
  angularSpeed: number;
};

export const HOME_STAR_ID = "S-1";
