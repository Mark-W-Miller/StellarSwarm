# StellarSwarm (skeleton)

This is a stripped-down starter: one full-page Three.js canvas with a 2D canvas layered on top for overlays. No UI chrome yet—just enough structure to build the new game from scratch.

## Quick start

```bash
npm install
npm run dev
```

Open the printed local URL. You’ll see the 3D stage with a simple spinning cube and a 2D overlay crosshair.

## Build & preview

```bash
npm run build
npm run preview
```

`npm run build` emits `dist/`, and `npm run preview` serves the production bundle locally.

## Layout

- `index.html` mounts a `#stage` container with a 3D div and a 2D canvas stacked over it.
- `src/main.js` wires the canvases, sizes them to the viewport, and draws a placeholder overlay.
- `src/ui/board3d.js` owns the Three.js scene/loop; currently a cube + grid to keep the pipeline live.
- `src/style.css` forces the stage to fill the viewport and layer the canvases.

Swap the cube for your own scene and draw whatever 2D HUD you need on `#stage-2d`.
