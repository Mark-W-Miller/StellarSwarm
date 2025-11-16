# StellarSwarm (skeleton)

New TypeScript skeleton: one full-page Three.js canvas with a 2D overlay canvas. The arena is a voxel-style square with golden-ratio triangular walls, and a camera controller handles drag-rotate plus arrow-key panning. A small orange cross marks the view center.

## Quick start

```bash
npm install
npm run dev
```

Open the printed local URL to see the arena, camera controls, and overlay crosshair.

## Build & preview

```bash
npm run build
npm run preview
```

`npm run build` emits `dist/`, and `npm run preview` serves the production bundle locally.

## Layout

- `index.html` mounts `#stage` with stacked 3D/2D canvases.
- `src/main.ts` initializes Three.js, the camera controller, the arena asset, and the sim loop.
- `src/camera.ts` handles drag rotation, scroll zoom, and arrow-key panning; exposes the view target.
- `src/model/arenaModel.ts` holds the arena data for the game engine.
- `src/assets/arenaAsset.ts` draws only the arena bounding box from the model.
- `src/sim.ts` runs the tick loop.
- `src/settings.json` holds constants (arena size, camera speeds/ranges).
- `src/style.css` fills the viewport and layers canvases.

## Defaults

- Arena size: 1000 × 1000 on the ground plane.
- Camera: starts offset with drag-rotate, scroll zoom, and arrow-key pan.
- Overlay: small orange cross at the view center target.

Extend the sim loop and replace the arenaAsset with your actual game geometry as you build systems.
