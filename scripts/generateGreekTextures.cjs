const fs = require("fs");
const path = require("path");
const { createCanvas, registerFont } = require("canvas");

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

const SIZE = 1024;
const BG = "#030915";
const FG = "#fefce8";
const STROKE_OUTER = "#000000";
const STROKE_MID = "#111827";
const STROKE_INNER = "#1f2937";

letters.forEach(({ name, glyph }) => {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fontFamily = registeredFont ? '"GreekFancy"' : '\"Times New Roman\", serif';
  ctx.font = `${SIZE * 0.5}px ${fontFamily}`;
  ctx.lineJoin = "round";

  ctx.lineWidth = SIZE * 0.16;
  ctx.strokeStyle = STROKE_OUTER;
  ctx.strokeText(glyph, SIZE / 2, SIZE / 2 + SIZE * 0.02);

  ctx.lineWidth = SIZE * 0.08;
  ctx.strokeStyle = STROKE_MID;
  ctx.strokeText(glyph, SIZE / 2, SIZE / 2 + SIZE * 0.02);

  ctx.lineWidth = SIZE * 0.04;
  ctx.strokeStyle = STROKE_INNER;
  ctx.strokeText(glyph, SIZE / 2, SIZE / 2 + SIZE * 0.02);

  ctx.fillStyle = FG;
  ctx.fillText(glyph, SIZE / 2, SIZE / 2 + SIZE * 0.02);

  const buffer = canvas.toBuffer("image/png");
  const outPath = path.join(OUT_DIR, `${name}.png`);
  fs.writeFileSync(outPath, buffer);
  console.log("Created", outPath);
});
