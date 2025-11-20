const fs = require("fs");
const path = require("path");
const { createCanvas, registerFont } = require("canvas");

const letters = [
  { name: "phi", glyph: "Φ" },
  { name: "psi", glyph: "Ψ" },
  { name: "omega", glyph: "Ω" },
  { name: "chi", glyph: "Χ" },
  { name: "sigma", glyph: "Σ" },
  { name: "rho", glyph: "Ρ" },
  { name: "xi", glyph: "Ξ" },
  { name: "theta", glyph: "Θ" },
  { name: "eta", glyph: "Η" },
  { name: "pi", glyph: "Π" },
  { name: "gamma", glyph: "Γ" },
  { name: "delta", glyph: "Δ" },
  { name: "lambda", glyph: "Λ" },
  { name: "zeta", glyph: "Ζ" }
];

const OUT_DIR = path.join(__dirname, "../public/textures/homeControls");
fs.mkdirSync(OUT_DIR, { recursive: true });

const FONT_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
  "/System/Library/Fonts/Supplemental/Times.ttc",
  "/Library/Fonts/Times New Roman.ttf",
  "/System/Library/Fonts/Supplemental/Palatino.ttf",
  "/Library/Fonts/Georgia.ttf"
];

const registeredFont = FONT_CANDIDATES.find((fontPath) => fs.existsSync(fontPath));
if (registeredFont) {
  registerFont(registeredFont, { family: "GreekFancy" });
  console.log(`Using font: ${registeredFont}`);
} else {
  console.warn("No custom serif font found; falling back to canvas default.");
}

const WIDTH = 2048;
const HEIGHT = 1024;
const BG = "#030915";
const FG = "#fefce8";
const STROKE_OUTER = "#000000";
const STROKE_MID = "#111827";
const STROKE_INNER = "#1f2937";

letters.forEach(({ name, glyph }) => {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fontFamily = registeredFont ? '"GreekFancy"' : '\"Times New Roman\", serif';
  ctx.font = `${HEIGHT * 0.6}px ${fontFamily}`;
  ctx.lineJoin = "round";

  ctx.lineWidth = HEIGHT * 0.18;
  ctx.strokeStyle = STROKE_OUTER;
  ctx.strokeText(glyph, WIDTH / 2, HEIGHT / 2 + HEIGHT * 0.02);

  ctx.lineWidth = HEIGHT * 0.08;
  ctx.strokeStyle = STROKE_MID;
  ctx.strokeText(glyph, WIDTH / 2, HEIGHT / 2 + HEIGHT * 0.02);

  ctx.lineWidth = HEIGHT * 0.04;
  ctx.strokeStyle = STROKE_INNER;
  ctx.strokeText(glyph, WIDTH / 2, HEIGHT / 2 + HEIGHT * 0.02);

  ctx.fillStyle = FG;
  ctx.fillText(glyph, WIDTH / 2, HEIGHT / 2 + HEIGHT * 0.02);

  const buffer = canvas.toBuffer("image/png");
  const outPath = path.join(OUT_DIR, `${name}.png`);
  fs.writeFileSync(outPath, buffer);
  console.log("Created", outPath);
});
