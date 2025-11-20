const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const letters = [
  { name: "alpha", glyph: "Α" },
  { name: "beta", glyph: "Β" },
  { name: "gamma", glyph: "Γ" },
  { name: "delta", glyph: "Δ" },
  { name: "epsilon", glyph: "Ε" },
  { name: "zeta", glyph: "Ζ" },
  { name: "eta", glyph: "Η" },
  { name: "theta", glyph: "Θ" },
  { name: "iota", glyph: "Ι" },
  { name: "kappa", glyph: "Κ" },
  { name: "lambda", glyph: "Λ" },
  { name: "mu", glyph: "Μ" },
  { name: "nu", glyph: "Ν" },
  { name: "xi", glyph: "Ξ" }
];

const OUT_DIR = path.join(__dirname, "../public/textures/homeControls");
fs.mkdirSync(OUT_DIR, { recursive: true });

const pythonScript = path.join(__dirname, "render_greek_texture.py");

letters.forEach(({ name, glyph }) => {
  const outPath = path.join(OUT_DIR, `${name}.png`);
  execFileSync("python3", [pythonScript, glyph, name, outPath], { stdio: "inherit" });
});
