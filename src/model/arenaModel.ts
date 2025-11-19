import type { Settings } from "../types";

import type { StarModel } from "./starModel";
import { HOME_STAR_ID } from "./starModel";
import { log } from "../ui/log/logger";

export type ArenaModel = {
  width: number;
  depth: number;
  height: number;
  voxelSize: number;
  half: { x: number; y: number; z: number };
  stars: StarModel[];
};

let rngSeed = Date.now();
function seedRand(seed: number) {
  rngSeed = seed >>> 0;
}
function rand() {
  rngSeed = (1664525 * rngSeed + 1013904223) >>> 0;
  return rngSeed / 0xffffffff;
}

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

function pickWeighted<T>(values: T[], weights: number[]) {
  const total = weights.reduce((a, b) => a + b, 0);
  const r = rand() * total;
  let acc = 0;
  for (let i = 0; i < values.length; i += 1) {
    acc += weights[i];
    if (r <= acc) return values[i];
  }
  return values[values.length - 1];
}

function buildOrbits(starRadius: number, allowPlanets: boolean, forcePlanetAll = false) {
  const orbits = [];
  const maxOrbits = 6;
  for (let i = 1; i <= maxOrbits; i += 1) {
    const r = starRadius * (1.5 + i * 0.8);
    const hasPlanet = allowPlanets ? forcePlanetAll || rand() > 0.4 : false;
    orbits.push({ radius: r, hasPlanet });
  }
  return orbits;
}

function createPlanet(starNumber: number, orbitIdx: number) {
  const planetColors = ["#60a5fa", "#fbbf24", "#34d399", "#c084fc", "#f472b6", "#f97316"];
  // Outer planets larger.
  const baseRadius = 0.3 + (orbitIdx - 1) * 0.2;
  const radius = baseRadius + rand() * 0.2;
  const baseSpeed = 0.01 + rand() * 0.02;
  const dir = rand() > 0.5 ? 1 : -1;
  return {
    id: `P-${starNumber}-${orbitIdx}`,
    radius,
    color: planetColors[(orbitIdx - 1) % planetColors.length],
    angle: rand() * Math.PI * 2,
    angularSpeed: baseSpeed * dir
  };
}

function systemFootprint(radius: number, subwarpScale: number) {
  const largestOrbit = radius * (1.5 + 6 * 0.8);
  const majorAxis = largestOrbit * 0.8;
  const subwarp = radius * subwarpScale * 1.3;
  const planetMax = 1.5;
  const buffer = 5;
  return Math.max(majorAxis, subwarp) + planetMax + buffer;
}

function addHomeStar(arena: ArenaModel) {
  const star: StarModel = {
    id: HOME_STAR_ID,
    position: {
      x: arena.half.x * 0.6,
      y: arena.half.y * 0.6,
      z: arena.half.z * 0.6
    },
    radius: 18,
    color: "#22c55e",
    brightness: 1,
    brightnessControl: 1,
    phase: rand() * Math.PI * 2,
    orbits: buildOrbits(18, true, true),
    controls: createHomeControls(18)
  };
  star.orbits?.forEach((o, orbitIdx) => {
    if (o.hasPlanet) {
      o.planet = createPlanet(1, orbitIdx + 1);
    }
  });
  arena.stars.push(star);
}

function addRandomStars(arena: ArenaModel, count: number, subwarpScale: number, startIndex = 2) {
  const colors = ["#808080", "#f94144", "#f3722c", "#f9c74f", "#90be6d", "#577590", "#8d6cff", "#2dd4bf"];
  const radii = [1, 3, 5, 7];
  const weights = [0.3, 0.25, 0.15, 0.05];
  const existing: { pos: { x: number; y: number; z: number }; footprint: number }[] = arena.stars.map((s) => ({
    pos: { ...s.position },
    footprint: systemFootprint(s.radius, subwarpScale)
  }));
  let starIndex = startIndex;
  let added = 0;
  let attempts = 0;
  while (added < count && attempts < count * 100) {
    attempts += 1;
    const radius = pickWeighted(radii, weights);
    const footprint = systemFootprint(radius, subwarpScale);
    let pos: { x: number; y: number; z: number } | null = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const candidate = {
        x: (rand() * 2 - 1) * (arena.half.x * 0.9),
        y: (rand() * 2 - 1) * (arena.half.y * 0.9),
        z: (rand() * 2 - 1) * (arena.half.z * 0.9)
      };
      const tooClose = existing.some((e) => {
        const dx = candidate.x - e.pos.x;
        const dy = candidate.y - e.pos.y;
        const dz = candidate.z - e.pos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return dist < e.footprint + footprint;
      });
      if (!tooClose) {
        pos = candidate;
        existing.push({ pos: candidate, footprint });
        break;
      }
    }
    if (!pos) continue;
    const color = colors[added % colors.length];
    const isGrey = color === "#808080";
    const starId = `S-${starIndex}`;
    const star: StarModel = {
      id: starId,
      position: pos,
      radius: isGrey ? radius * 1.4 : radius,
      color,
      brightness: isGrey ? 1.2 : 0.4 + rand() * 0.6,
      brightnessControl: 1,
      phase: rand() * Math.PI * 2,
      orbits: buildOrbits(radius, !isGrey)
    };
    if (!isGrey && star.orbits) {
      star.orbits.forEach((o, orbitIdx) => {
        if (o.hasPlanet) {
          o.planet = createPlanet(starIndex, orbitIdx + 1);
        }
      });
    }
    arena.stars.push(star);
    starIndex += 1;
    added += 1;
  }
}

export function populateArenaModel(arena: ArenaModel, starCount: number, subwarpScale: number) {
  seedRand(Date.now());
  arena.stars = [];
  addHomeStar(arena);
  addRandomStars(arena, starCount, subwarpScale, 2);
  applyDistanceBrightness(arena);
  log(
    "ARENA_INIT",
    JSON.stringify(
      {
        count: arena.stars.length,
        stars: arena.stars.map((s) => ({
          id: s.id,
          pos: {
            x: Number(s.position.x.toFixed(2)),
            y: Number(s.position.y.toFixed(2)),
            z: Number(s.position.z.toFixed(2))
          },
          radius: Number(s.radius.toFixed(2)),
          color: s.color,
          orbits: s.orbits?.map((o) => ({
            radius: Number(o.radius.toFixed(2)),
            hasPlanet: o.hasPlanet,
            planet: o.planet
              ? {
                  id: o.planet.id,
                  color: o.planet.color,
                  radius: Number(o.planet.radius.toFixed(2))
                }
              : null
          }))
        }))
      },
      null,
      2
    )
  );
}

function applyDistanceBrightness(arena: ArenaModel) {
  const home = arena.stars.find((s) => s.id === HOME_STAR_ID) || arena.stars[0];
  if (!home) return;
  const homePos = home.position;
  const distances = arena.stars.map((s) => {
    const dx = s.position.x - homePos.x;
    const dy = s.position.y - homePos.y;
    const dz = s.position.z - homePos.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  });
  const min = Math.min(...distances);
  const max = Math.max(...distances);
  arena.stars.forEach((star, idx) => {
    let normalized = max === min ? 1 : 1 - (distances[idx] - min) / (max - min);
    const quantized = Math.floor(normalized * 15) / 15;
    star.brightness = quantized;
  });
}

function createHomeControls(radius: number) {
  const dirs: [number, number, number][] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
    [1, 1, 1],
    [1, 1, -1],
    [1, -1, 1],
    [1, -1, -1],
    [-1, 1, 1],
    [-1, 1, -1],
    [-1, -1, 1],
    [-1, -1, -1]
  ];
  const shell = radius * 0.9;
  return dirs.map((dir, idx) => {
    const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    return {
      id: `CTRL-${idx + 1}`,
      position: {
        x: (dir[0] / len) * shell,
        y: (dir[1] / len) * shell,
        z: (dir[2] / len) * shell
      }
    };
  });
}
