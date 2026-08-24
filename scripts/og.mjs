// Regenerates public/og.png (the Open Graph card). Run manually: node scripts/og.mjs
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#131316"/>
  <g fill="#26262b">
    ${Array.from({ length: 24 }, (_, row) =>
      Array.from(
        { length: 44 },
        (_, col) =>
          `<circle cx="${28 + col * 28}" cy="${28 + row * 28}" r="1.6"/>`,
      ).join(''),
    ).join('')}
  </g>
  <rect x="80" y="120" width="1040" height="390" rx="24" fill="#1b1b1f" stroke="#2e2e33" stroke-width="2"/>
  <circle cx="128" cy="168" r="10" fill="#f87171"/>
  <circle cx="164" cy="168" r="10" fill="#fbbf24"/>
  <circle cx="200" cy="168" r="10" fill="#34d399"/>
  <line x1="80" y1="204" x2="1120" y2="204" stroke="#2e2e33" stroke-width="2"/>
  <text x="128" y="286" font-family="Consolas, 'Courier New', monospace" font-size="34" fill="#4ade80">~ $ whoami</text>
  <text x="128" y="360" font-family="Consolas, 'Courier New', monospace" font-size="58" font-weight="bold" fill="#e7e7ea">Timo Rzipa</text>
  <text x="128" y="420" font-family="Consolas, 'Courier New', monospace" font-size="30" fill="#9d9da6">Software Engineer · Self-Hosting · Homelab</text>
  <text x="128" y="478" font-family="Consolas, 'Courier New', monospace" font-size="26" fill="#4ade80">timo.rzipas.win</text>
</svg>`;

const outputPath = fileURLToPath(new URL('../public/og.png', import.meta.url));
await sharp(Buffer.from(svg)).png().toFile(outputPath);
console.log(`wrote ${outputPath}`);
