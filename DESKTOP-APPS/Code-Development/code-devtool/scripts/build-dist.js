// CodeDevTool - packaging wrapper (T-21)
// Disables code-signing certificate auto-discovery so electron-builder does
// not download the winCodeSign toolchain on machines without signing
// certificates (and avoids the 7-Zip symlink extraction failure on Windows
// without elevated privileges). The exe still gets its icon and version
// metadata via rcedit. Run by the dist script.
'use strict'
process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'

const { build, Platform, Arch } = require('electron-builder')
const { ensureRcedit } = require('./ensure-rcedit')

async function runBuild() {
  await ensureRcedit()
  await build({
    targets: Platform.WINDOWS.createTarget(['nsis', 'portable'], Arch.x64)
  })
}

runBuild().catch((buildError) => {
  console.error('BUILD FAILED:', buildError && buildError.message ? buildError.message : buildError)
  process.exit(1)
})
