// CodeDevTool - generates build/icon.ico (256x256).
// A simple "code editor" glyph: indigo rounded square with three code lines.
// The ICO container embeds one 256x256 PNG entry (standard for modern ICO).
// Run once: node scripts/generate-icon.js - the output is committed.
'use strict'
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const size = 256

// ── tiny PNG writer (RGB, no filter) ──
function crc32(buffer) {
  let crc = 0xffffffff
  for (let index = 0; index < buffer.length; index++) {
    crc ^= buffer[index]
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length, 0)
  typeBuffer.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length)
  return chunk
}

function makePng(pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // color type RGBA
  const raw = Buffer.alloc(size * (1 + size * 4))
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0 // filter none
    pixels.copy(raw, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

// ── draw the icon ──
// Palette: deep indigo background, lighter top band, white/grey code lines.
const pixels = Buffer.alloc(size * size * 4)

function setPixel(x, y, red, green, blue, alpha) {
  const offset = (y * size + x) * 4
  pixels[offset] = red
  pixels[offset + 1] = green
  pixels[offset + 2] = blue
  pixels[offset + 3] = alpha === undefined ? 255 : alpha
}

function inRoundedSquare(x, y, radius) {
  const minX = radius
  const minY = radius
  const maxX = size - radius
  const maxY = size - radius
  if (x < minX || x > maxX || y < minY || y > maxY) return false
  const cornerX = x < minX + radius ? minX + radius : (x > maxX - radius ? maxX - radius : x)
  const cornerY = y < minY + radius ? minY + radius : (y > maxY - radius ? maxY - radius : y)
  const dx = x - cornerX
  const dy = y - cornerY
  return dx * dx + dy * dy <= radius * radius
}

const radius = 48
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    if (!inRoundedSquare(x, y, radius)) {
      setPixel(x, y, 0, 0, 0, 0) // fully transparent
      continue
    }
    const baseRed = 79
    const baseGreen = 70
    const baseBlue = 229
    const gradient = 0.85 + 0.15 * (y / size)
    setPixel(x, y, Math.round(baseRed * gradient), Math.round(baseGreen * gradient), Math.round(baseBlue * gradient))
  }
}
// top window band
for (let y = radius + 10; y < radius + 58; y++) {
  for (let x = radius + 10; x < size - radius - 10; x++) {
    setPixel(x, y, 67, 56, 202)
  }
}
// three window dots
const dotCenters = [[radius + 34, radius + 34], [radius + 58, radius + 34], [radius + 82, radius + 34]]
const dotColors = [[248, 113, 113], [250, 204, 21], [74, 222, 128]]
for (const [dotIndex, center] of dotCenters.entries()) {
  for (let y = center[1] - 6; y <= center[1] + 6; y++) {
    for (let x = center[0] - 6; x <= center[0] + 6; x++) {
      if ((x - center[0]) * (x - center[0]) + (y - center[1]) * (y - center[1]) <= 36) {
        setPixel(x, y, dotColors[dotIndex][0], dotColors[dotIndex][1], dotColors[dotIndex][2])
      }
    }
  }
}
// code lines (white-ish bars of different lengths)
const codeLines = [
  { y: 112, x: 76, width: 118, color: [199, 210, 254] },
  { y: 138, x: 76, width: 104, color: [165, 180, 252] },
  { y: 164, x: 76, width: 126, color: [199, 210, 254] },
  { y: 190, x: 76, width: 90, color: [165, 180, 252] }
]
for (const line of codeLines) {
  for (let y = line.y; y < line.y + 14; y++) {
    for (let x = line.x; x < line.x + line.width; x++) {
      setPixel(x, y, line.color[0], line.color[1], line.color[2])
    }
  }
}

// ── build ICO with a 256x256 PNG entry ──
const png = makePng(pixels)
const icoHeader = Buffer.alloc(6)
icoHeader.writeUInt16LE(0, 0) // reserved
icoHeader.writeUInt16LE(1, 2) // type: icon
icoHeader.writeUInt16LE(1, 4) // one image
const icoEntry = Buffer.alloc(16)
icoEntry[0] = 0 // width 256 -> 0
icoEntry[1] = 0 // height 256 -> 0
icoEntry[2] = 0 // palette
icoEntry[3] = 0 // reserved
icoEntry.writeUInt16LE(1, 4) // planes
icoEntry.writeUInt16LE(32, 6) // bpp
icoEntry.writeUInt32LE(png.length, 8)
icoEntry.writeUInt32LE(6 + 16, 12) // data offset

const buildFolder = path.join(__dirname, '..', 'build')
fs.mkdirSync(buildFolder, { recursive: true })
fs.writeFileSync(path.join(buildFolder, 'icon.ico'), Buffer.concat([icoHeader, icoEntry, png]))
console.log('build/icon.ico generated (256x256 PNG entry, ' + png.length + ' bytes PNG)')
