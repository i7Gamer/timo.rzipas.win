// Regenerates public/apple-touch-icon.png. Run manually: node scripts/icon.mjs
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SIZE = 180;

// Same prompt glyph and colors as public/favicon.svg, but full-bleed and
// opaque: iOS rounds the corners itself and composites transparency onto black.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#131316"/>
  <path d="M14 21l13 11-13 11" stroke="#4ade80" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="34" y="39" width="17" height="6" rx="2" fill="#4ade80"/>
</svg>`;

const outputPath = fileURLToPath(
  new URL('../public/apple-touch-icon.png', import.meta.url),
);
await sharp(Buffer.from(svg)).png().toFile(outputPath);
console.log(`wrote ${outputPath}`);
