// Unicon Studio - application UI server
// Serves the renderer UI and the local Monaco bundle over 127.0.0.1.
// Serving the UI over http (instead of file://) lets Monaco web workers
// and blob resources load from a real origin - required for the editor
// (T-05, decision CODE-14). Only the renderer folder and the Monaco
// package are ever served; the loopback address keeps it local.

const http = require('http')
const fs = require('fs')
const path = require('path')

const rendererRoot = path.join(__dirname, '..', 'renderer')
const monacoRoot = path.join(__dirname, '..', 'node_modules', 'monaco-editor', 'min')
const docsFolder = path.join(__dirname, '..', '..')
let activeDocsFolder = docsFolder
let projectRootProvider = null
let activeServer = null

// The feature-management documents (CODE-18). Only these exact files are
// served - the overlay iframe in the app shows the live SSOT document.
const docsMapping = {
  '/docs/code-devtool-ssot.html': 'code-devtool-ssot.html',
  '/docs/ssot.css': 'ssot.css',
  '/docs/ssot.js': 'ssot.js',
  '/docs/tool-analysis.html': 'tool-analysis.html',
  '/docs/document-system-rules.html': 'document-system-rules.html'
}

const contentTypesByExtension = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.map': 'application/json; charset=utf-8'
}

function resolveRequestedFile(requestPath) {
  let decodedPath = requestPath
  try {
    decodedPath = decodeURIComponent(requestPath)
  } catch (_decodeError) {
    return null
  }
  if (decodedPath.startsWith('/docs/')) {
    const docFileName = docsMapping[decodedPath]
    if (!docFileName) return null
    return path.join(activeDocsFolder, docFileName)
  }
  if (decodedPath.startsWith('/monaco/')) {
    const relativePart = decodedPath.slice('/monaco/'.length)
    const resolvedPath = path.resolve(monacoRoot, relativePart)
    if (!resolvedPath.startsWith(monacoRoot + path.sep)) return null
    return resolvedPath
  }
  const relativePart = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '')
  const resolvedPath = path.resolve(rendererRoot, relativePart)
  if (resolvedPath !== rendererRoot && !resolvedPath.startsWith(rendererRoot + path.sep)) return null
  return resolvedPath
}

// CODE-36: serve the opened folder's documents (SSOT, marketing, help,
// ...) to the overlay iframe. The path is resolved INSIDE the active
// project root with the same ROOT-ONLY invariant as every other file
// access - a path escaping the root is refused.
function serveProjectDocumentFile(decodedPath, response) {
  const projectRoot = projectRootProvider ? projectRootProvider() : ''
  const relativePart = decodedPath.slice('/project-docs/'.length)
  const finishWithStatus = (statusCode) => {
    response.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end(statusCode === 403 ? 'Forbidden' : 'Not found')
  }
  if (!projectRoot || !relativePart) {
    finishWithStatus(404)
    return
  }
  const resolvedPath = path.resolve(projectRoot, relativePart)
  if (resolvedPath !== projectRoot && !resolvedPath.startsWith(projectRoot + path.sep)) {
    finishWithStatus(403)
    return
  }
  fs.readFile(resolvedPath, (readError, fileContent) => {
    if (readError) {
      finishWithStatus(404)
      return
    }
    const contentType = contentTypesByExtension[path.extname(resolvedPath).toLowerCase()] || 'application/octet-stream'
    response.writeHead(200, { 'Content-Type': contentType })
    response.end(fileContent)
  })
}

function start(options) {
  if (activeServer) return Promise.resolve({ url: activeServer.url, port: activeServer.port })
  // Packaged builds bundle a snapshot of the SSOT documents in docs/
  // (see scripts/sync-ssot-docs.js); development serves the live files
  // next to the app folder (CODE-18).
  if (options && options.docsFolder) activeDocsFolder = options.docsFolder
  // CODE-36: the SSOT/Docs overlay shows the OPENED folder's documents -
  // they are served from the active project root, never from anywhere else.
  if (options && typeof options.projectRootProvider === 'function') projectRootProvider = options.projectRootProvider
  const server = http.createServer((request, response) => {
    const requestPath = (request.url || '/').split('?')[0]
    let decodedPath = requestPath
    try {
      decodedPath = decodeURIComponent(requestPath)
    } catch (_decodeError) {
      decodedPath = requestPath
    }
    if (decodedPath.startsWith('/project-docs/')) {
      serveProjectDocumentFile(decodedPath, response)
      return
    }
    const filePath = resolveRequestedFile(decodedPath)
    if (!filePath) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Forbidden')
      return
    }
    fs.readFile(filePath, (readError, fileContent) => {
      if (readError) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        response.end('Not found')
        return
      }
      const contentType = contentTypesByExtension[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
      response.writeHead(200, { 'Content-Type': contentType })
      response.end(fileContent)
    })
  })
  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      activeServer = { server: server, port: address.port, url: 'http://127.0.0.1:' + address.port + '/' }
      resolve({ url: activeServer.url, port: activeServer.port })
    })
  })
}

function stop() {
  if (!activeServer) return
  activeServer.server.close()
  activeServer = null
}

module.exports = { start, stop }
