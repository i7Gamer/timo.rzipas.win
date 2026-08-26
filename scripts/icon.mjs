// Regenerates public/apple-touch-icon.png from public/favicon.svg.
// Run manually: node scripts/icon.mjs
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SIZE = 180;
// iOS composites transparency onto black, so the favicon's transparent
// rounded corners are flattened onto its own background color instead
// (iOS applies the corner rounding itself).
const BACKGROUND = '#131316';
// Rasterize the 64px SVG well above target size before scaling down.
const SVG_RENDER_DENSITY = 300;

const faviconPath = fileURLToPath(
  new URL('../public/favicon.svg', import.meta.url),
);
const outputPath = fileURLToPath(
  new URL('../public/apple-touch-icon.png', import.meta.url),
);

await sharp(faviconPath, { density: SVG_RENDER_DENSITY })
  .resize(SIZE, SIZE)
  .flatten({ background: BACKGROUND })
  .png()
  .toFile(outputPath);
console.log(`wrote ${outputPath}`);
