/**
 * Generates PWA icon PNGs from an inline SVG using sharp.
 * Run once after install: node scripts/gen-icons.mjs
 */
import sharp from 'sharp'
import { mkdirSync } from 'fs'

// Simple warehouse silhouette on brand-blue background
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#1e40af"/>
  <polygon points="56,252 256,112 456,252" fill="white"/>
  <rect x="96" y="252" width="320" height="196" fill="white"/>
  <rect x="192" y="330" width="128" height="118" rx="10" fill="#1e40af"/>
</svg>`

const buf = Buffer.from(SVG)

mkdirSync('public', { recursive: true })

const icons = [
  { file: 'public/pwa-64x64.png',          size: 64  },
  { file: 'public/pwa-192x192.png',         size: 192 },
  { file: 'public/pwa-512x512.png',         size: 512 },
  { file: 'public/apple-touch-icon.png',    size: 180 },
]

for (const { file, size } of icons) {
  await sharp(buf).resize(size, size).png().toFile(file)
  console.log(`✓  ${file}`)
}

console.log('\nDone. Add apple-touch-icon.png to your index.html if not already there.')
