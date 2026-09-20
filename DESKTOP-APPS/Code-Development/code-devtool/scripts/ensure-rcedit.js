// CodeDevTool - fetches the rcedit tool from the electron-builder binaries
// release WITHOUT triggering electron-builder's own winCodeSign extraction
// (which fails on Windows without symlink privileges because the package
// contains two darwin symlinks). We only need rcedit-x64.exe to embed the
// icon and version metadata into the built exe (T-21).
'use strict'
const fs = require('fs')
const path = require('path')
const https = require('https')
const { spawnSync } = require('child_process')

const targetFolder = path.join(__dirname, '..', 'build', 'rcedit')
const rceditPath = path.join(targetFolder, 'rcedit-x64.exe')
const archivePath = path.join(targetFolder, 'winCodeSign.7z')
const downloadUrl = 'https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z'
const sevenZipPath = path.join(__dirname, '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe')

function downloadFile(url, outputPath, redirectsLeft) {
  const remainingRedirects = redirectsLeft === undefined ? 5 : redirectsLeft
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'codedevtool-build' } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        if (remainingRedirects <= 0) {
          reject(new Error('download failed: too many redirects'))
          return
        }
        response.resume()
        resolve(downloadFile(response.headers.location, outputPath, remainingRedirects - 1))
        return
      }
      if (response.statusCode !== 200) {
        reject(new Error('download failed, HTTP ' + response.statusCode))
        return
      }
      const file = fs.createWriteStream(outputPath)
      response.pipe(file)
      file.on('finish', () => file.close(resolve))
      file.on('error', reject)
    }).on('error', reject)
  })
}

async function ensureRcedit() {
  if (fs.existsSync(rceditPath)) {
    console.log('rcedit already present: ' + rceditPath)
    return rceditPath
  }
  fs.mkdirSync(targetFolder, { recursive: true })
  let archiveIsUsable = false
  try {
    archiveIsUsable = fs.statSync(archivePath).size > 1000
  } catch (_statError) {
    archiveIsUsable = false
  }
  if (!archiveIsUsable) {
    fs.rmSync(archivePath, { force: true })
    console.log('downloading winCodeSign archive for rcedit...')
    await downloadFile(downloadUrl, archivePath)
  }
  console.log('extracting rcedit-x64.exe only...')
  const result = spawnSync(sevenZipPath, ['e', archivePath, '-o' + targetFolder, 'rcedit-x64.exe', '-y'], { stdio: 'pipe' })
  if (result.status !== 0 || !fs.existsSync(rceditPath)) {
    throw new Error('rcedit extraction failed: ' + String(result.stderr || result.stdout))
  }
  fs.rmSync(archivePath, { force: true })
  console.log('rcedit ready: ' + rceditPath)
  return rceditPath
}

module.exports = { ensureRcedit, rceditPath, targetFolder }
