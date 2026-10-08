// Draws the menu bar paw and the app icon as PNGs (rendered by Chromium
// from SVG, so they stay crisp), and packs the app icon into a macOS
// .icns file. Run once; the results are committed under src/assets.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let chromium
try {
  ;({ chromium } = require('playwright'))
} catch {
  ;({ chromium } = require('/opt/node22/lib/node_modules/playwright'))
}

const here = path.dirname(fileURLToPath(import.meta.url))
const assets = path.resolve(here, '../src/assets')
fs.mkdirSync(assets, { recursive: true })

const PAW = `
  <ellipse cx="16" cy="20" rx="9" ry="7.5"/>
  <ellipse cx="6.5" cy="11.5" rx="3.4" ry="4.2" transform="rotate(-18 6.5 11.5)"/>
  <ellipse cx="14" cy="6.5" rx="3.4" ry="4.4" transform="rotate(-4 14 6.5)"/>
  <ellipse cx="22" cy="6.8" rx="3.4" ry="4.4" transform="rotate(8 22 6.8)"/>
  <ellipse cx="27" cy="12.5" rx="3.2" ry="4" transform="rotate(22 27 12.5)"/>`

// Menu bar: a plain black paw. macOS recolours "Template" images itself
// for light and dark menu bars.
const traySvg = (px) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="-1 -1 34 34"><g fill="#000">${PAW}</g></svg>`

// App icon: the kitten's face on a cream tile, with a paw print.
const iconSvg = (px) => `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fffaf1"/><stop offset="1" stop-color="#f4e2c4"/>
    </linearGradient>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg)" stroke="#e3cba5" stroke-width="8"/>
  <g transform="translate(512 560) scale(11)" stroke-linejoin="round">
    <path d="M-15,-16 L-21,-35 L-1,-23 Z" fill="#be875a" stroke="#4a2f23" stroke-width="2"/>
    <path d="M-13,-18 L-17,-29 L-6,-22 Z" fill="#c98a86"/>
    <path d="M15,-16 L21,-35 L1,-23 Z" fill="#be875a" stroke="#4a2f23" stroke-width="2"/>
    <path d="M13,-18 L17,-29 L6,-22 Z" fill="#c98a86"/>
    <ellipse cx="0" cy="0" rx="23" ry="20" fill="#be875a" stroke="#4a2f23" stroke-width="2"/>
    <ellipse cx="-7" cy="-3" rx="3" ry="3.6" fill="#4a2f23"/>
    <ellipse cx="9" cy="-3" rx="3" ry="3.6" fill="#4a2f23"/>
    <ellipse cx="1" cy="5" rx="3" ry="2.2" fill="#c98a86" stroke="#4a2f23" stroke-width="1"/>
    <g fill="none" stroke="#4a2f23" stroke-width="1.3" stroke-linecap="round" opacity="0.75">
      <path d="M6,7 Q18,5 27,8"/><path d="M6,10 Q18,12 26,15"/><path d="M-4,7 Q-14,6 -21,9"/>
    </g>
  </g>
  <g transform="translate(700 690) rotate(24) scale(4.2)" fill="#93643a" opacity="0.9">${PAW}</g>
</svg>`

const browser = await chromium.launch({
  executablePath: fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
    : undefined,
})
const page = await browser.newPage()

async function render(svg, px, file) {
  await page.setViewportSize({ width: px, height: px })
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg}</body></html>`
  )
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: px, height: px } })
  if (file) fs.writeFileSync(path.join(assets, file), buf)
  return buf
}

await render(traySvg(16), 16, 'trayTemplate.png')
await render(traySvg(32), 32, 'trayTemplate@2x.png')

// .icns: an 'icns' header followed by PNG entries tagged with their size.
const entries = [
  ['ic11', 32],
  ['ic12', 64],
  ['ic07', 128],
  ['ic13', 256],
  ['ic08', 256],
  ['ic14', 512],
  ['ic09', 512],
  ['ic10', 1024],
]
const chunks = []
for (const [type, px] of entries) {
  const png = await render(iconSvg(px), px)
  const head = Buffer.alloc(8)
  head.write(type, 0, 'ascii')
  head.writeUInt32BE(png.length + 8, 4)
  chunks.push(head, png)
}
const body = Buffer.concat(chunks)
const header = Buffer.alloc(8)
header.write('icns', 0, 'ascii')
header.writeUInt32BE(body.length + 8, 4)
fs.writeFileSync(path.join(assets, 'icon.icns'), Buffer.concat([header, body]))
await render(iconSvg(512), 512, 'icon.png')

await browser.close()
console.log('icons written to src/assets')
