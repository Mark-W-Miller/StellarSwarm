# How to run StellarSwarm

## Prerequisites
- Node.js 18+ and npm installed (Vite 5 requires Node 18 or newer).

## Install dependencies
```bash
npm install
```

## Start the dev server
```bash
npm run dev
```
The console prints a local URL; open it in a browser and visit:
- `http://localhost:5173/stellar-swarm` for the original starfield
- `http://localhost:5173/dim-gate` for the new Dimension Gate sandbox

## Build for production
```bash
npm run build
```
Outputs the static bundle to `dist/`.

## Preview the production build
```bash
npm run preview
```
Serves the built bundle locally so you can verify the optimized output.
