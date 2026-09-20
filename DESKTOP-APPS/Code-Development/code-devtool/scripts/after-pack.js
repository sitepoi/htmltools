// CodeDevTool - afterPack hook (T-21)
// electron-builder's own executable editing needs the winCodeSign package,
// whose extraction fails on Windows without symlink privileges. We build
// with win.signAndEditExecutable=false and embed the icon and version
// metadata ourselves with rcedit here, before the NSIS/portable targets run.
'use strict'
const path = require('path')
const { spawnSync } = require('child_process')

const rceditPath = path.join(__dirname, '..', 'build', 'rcedit', 'rcedit-x64.exe')
const iconPath = path.join(__dirname, '..', 'build', 'icon.ico')

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return
  const productFilename = context.packager.appInfo.productFilename
  const executablePath = path.join(context.appOutDir, productFilename + '.exe')
  const version = context.packager.appInfo.version

  const args = [
    executablePath,
    '--set-icon', iconPath,
    '--set-version-string', 'FileDescription', productFilename,
    '--set-version-string', 'ProductName', productFilename,
    '--set-version-string', 'CompanyName', 'UniconHub',
    '--set-version-string', 'LegalCopyright', 'Copyright (c) 2026 UniconHub',
    '--set-version-string', 'OriginalFilename', productFilename + '.exe',
    '--set-file-version', version,
    '--set-product-version', version
  ]
  const result = spawnSync(rceditPath, args, { stdio: 'pipe' })
  if (result.status !== 0) {
    throw new Error('rcedit failed: ' + String(result.stderr || result.stdout))
  }
  console.log('rcedit applied icon and version ' + version + ' to ' + executablePath)
}
