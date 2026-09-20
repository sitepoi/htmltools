// Unicon Studio - static preview server
// Serves the open project folder over HTTP on 127.0.0.1 so the renderer
// iframe can show the web UI (SSOT T-14). Nothing is served from outside
// the project root, and the server only listens on the loopback address.
// Next.js dev-server integration arrives with T-15 (nextjs-runner.js).

const http = require('http')
const fs = require('fs')
const path = require('path')

const mimeTypesByExtension = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
}

let serversByRoot = new Map()

// Injected into every served HTML page so the preview console panel can
// show the page's console output (T-16). Built without a literal closing
// script tag; posts messages to the parent (the app window) cross-origin.
const consoleRelayScript =
  '<scr' + 'ipt>(function(){var send=function(level,args){try{parent.postMessage({codedevtoolPreview:{level:level,args:args}},"*")}catch(_e){}};' +
  '["log","info","warn","error"].forEach(function(level){var original=console[level];console[level]=function(){try{send(level,Array.prototype.slice.call(arguments).map(function(argument){try{return typeof argument==="object"?JSON.stringify(argument):String(argument)}catch(_e){return String(argument)}}))}catch(_e){}return original.apply(console,arguments)}});' +
  'window.addEventListener("error",function(event){try{send("error",[event.message+" ("+event.filename+":"+event.lineno+")"])}catch(_e){}});' +
  '})();</scr' + 'ipt>'

function injectConsoleRelay(htmlText) {
  const headEndIndex = htmlText.search(/<\/head>/i)
  if (headEndIndex !== -1) {
    return htmlText.slice(0, headEndIndex) + consoleRelayScript + htmlText.slice(headEndIndex)
  }
  return consoleRelayScript + htmlText
}

function getContentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  return mimeTypesByExtension[extension] || 'application/octet-stream'
}

function isPathInsideRoot(projectRoot, resolvedPath) {
  return resolvedPath === projectRoot || resolvedPath.startsWith(projectRoot + path.sep)
}

function detectProjectKind(projectRoot) {
  try {
    const packageJsonPath = path.join(projectRoot, 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const dependencies = Object.assign({}, packageJson.dependencies, packageJson.devDependencies)
    if (dependencies.next) return 'nextjs'
  } catch (_readError) {
    // No package.json or unreadable - not a Next.js project.
  }
  if (fs.existsSync(path.join(projectRoot, 'index.html'))) return 'static'
  if (listEntryPages(projectRoot).length > 0) return 'static'
  return 'unsupported'
}

function listEntryPages(projectRoot) {
  let directoryEntries
  try {
    directoryEntries = fs.readdirSync(projectRoot, { withFileTypes: true })
  } catch (_readError) {
    return []
  }
  const htmlFiles = directoryEntries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
    .map((entry) => {
      let entryContent = ''
      try {
        entryContent = fs.readFileSync(path.join(projectRoot, entry.name), 'utf8')
      } catch (_readError) {
        entryContent = ''
      }
      // CMS html-tool files are body-only (no <html> tag) and need the
      // wrapper page; full documents are served directly.
      const isWrapped = !/<html[\s>]/i.test(entryContent.slice(0, 2000))
      return { name: entry.name, wrapped: isWrapped }
    })
  htmlFiles.sort((leftEntry, rightEntry) => {
    if (leftEntry.name === 'index.html') return -1
    if (rightEntry.name === 'index.html') return 1
    if (leftEntry.name === 'test-harness.html') return 1
    if (rightEntry.name === 'test-harness.html') return -1
    return leftEntry.name.localeCompare(rightEntry.name)
  })
  return htmlFiles
}

function buildMockToolSdkScript(roleName) {
  const roles = roleName === 'admin' ? '["admin","editor"]' : '["' + roleName + '"]'
  return '<scr' + 'ipt>(function(){var _value=null;var _readOnly=false;var _user={id:"preview_user",name:"Preview User",email:"preview@local",roles:' + roles + '};var _fields={};try{var saved=localStorage.getItem("codedevtool-preview-value");if(saved){_value=JSON.parse(saved)}}catch(e){}' +
    'function loadObjects(type){try{var raw=localStorage.getItem("codedevtool-preview-objs-"+type);return raw?JSON.parse(raw):[]}catch(e){return []}}' +
    'function saveObjects(type,arr){try{localStorage.setItem("codedevtool-preview-objs-"+type,JSON.stringify(arr))}catch(e){}}' +
    'window.tool={' +
    'getValue:function(){return _value},' +
    'setValue:function(data){_value=data;try{localStorage.setItem("codedevtool-preview-value",JSON.stringify(data))}catch(e){}},' +
    'onValueChange:function(){},' +
    'getFields:function(){return Object.assign({},_fields)},' +
    'setField:function(id,val){_fields[id]=val},' +
    'setFields:function(obj){Object.assign(_fields,obj)},' +
    'watchField:function(){},onFieldsChange:function(){},' +
    'param:function(name,def){return def},' +
    'declareParams:function(){},declareOutput:function(){},reportMissingParams:function(){},reportValid:function(){},' +
    'isReadOnly:function(){return _readOnly},onReadonlyChange:function(){},' +
    'getUser:function(){return _user},onUserChange:function(){},' +
    'getPermittedUsers:function(){return []},onPermittedUsersChange:function(){},' +
    'notify:function(msg){try{console.log("[preview]",msg)}catch(e){}},' +
    'resize:function(){},openUrl:function(url){window.open(url,"_blank")},openObjectDetail:function(){},' +
    'requestObjects:function(action,params,cb){setTimeout(function(){try{var type=params&&params.mainObjectType;var objects=loadObjects(type);if(action==="query"){cb(null,{objects:objects})}else if(action==="get"){var found=null;for(var i=0;i<objects.length;i++){if(objects[i].id===params.objectId){found=objects[i];break}}cb(null,{object:found})}else if(action==="create"){var newObj={id:"prev_"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),name:params.name||"Untitled",productData:params.productData||{data_categoriesBased:{}},created:new Date().toISOString(),updated:new Date().toISOString()};objects.push(newObj);saveObjects(type,objects);cb(null,{object:newObj})}else if(action==="update"){for(var j=0;j<objects.length;j++){if(objects[j].id===params.objectId){if(params.name)objects[j].name=params.name;if(params.productData&&params.productData.data_categoriesBased){if(!objects[j].productData)objects[j].productData={};if(!objects[j].productData.data_categoriesBased)objects[j].productData.data_categoriesBased={};Object.assign(objects[j].productData.data_categoriesBased,params.productData.data_categoriesBased)}objects[j].updated=new Date().toISOString();saveObjects(type,objects);break}}cb(null,{ok:true})}else if(action==="delete"){objects=objects.filter(function(o){return o.id!==params.objectId});saveObjects(type,objects);cb(null,{ok:true})}else{cb("Unknown action: "+action,null)}}catch(e){cb(e.message,null)}},10)},' +
    'requestExportPdf:function(options,cb){cb(null,{url:"",name:(options&&options.filename)||"export.pdf",size:0,type:"application/pdf"})},' +
    'requestSendEmail:function(options,cb){cb(null,{ok:true})},' +
    'requestAI:function(prompt,context,cb){cb(null,"Preview AI is not connected. Prompt: "+(prompt||"").slice(0,80))},' +
    'requestAIStream:function(prompt,context,cbs){var text="Preview AI is not connected.";if(cbs&&cbs.onToken)cbs.onToken(text);if(cbs&&cbs.onComplete)cbs.onComplete(text)},' +
    'requestUpload:function(accept,cb){cb("Upload unavailable in preview",null)},' +
    'requestFileContent:function(url,cb){cb("File content unavailable in preview",null)},' +
    'onReady:function(cb){try{cb(_value,_fields)}catch(e){}}' +
    '};})();</scr' + 'ipt>'
}

function buildWrapperPage(projectRoot, queryString) {
  const params = new URLSearchParams(queryString)
  let entryName = params.get('entry') || ''
  if (!/^[A-Za-z0-9_\-.]+[.]html$/i.test(entryName)) {
    const pages = listEntryPages(projectRoot)
    const fallbackEntry = pages.find((page) => page.name !== 'test-harness.html') || pages[0]
    entryName = fallbackEntry ? fallbackEntry.name : 'index.html'
  }
  let bodyMarkup = ''
  try {
    bodyMarkup = fs.readFileSync(path.join(projectRoot, entryName), 'utf8')
  } catch (_readError) {
    bodyMarkup = '<p>Entry page not found</p>'
  }
  const baseName = entryName.replace(/\.html$/i, '')
  const styleLink = fs.existsSync(path.join(projectRoot, baseName + '.css'))
    ? '<link rel="stylesheet" href="/' + baseName + '.css" />'
    : ''
  const scriptTag = fs.existsSync(path.join(projectRoot, baseName + '.js'))
    ? '<script src="/' + baseName + '.js"></' + 'script>'
    : ''
  const roleName = params.get('role') === 'viewer' ? 'viewer' : (params.get('role') === 'editor' ? 'editor' : 'admin')
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />' + styleLink +
    '<title>' + baseName + ' - preview</title></head><body>' +
    buildMockToolSdkScript(roleName) + bodyMarkup + scriptTag +
    '</body></html>'
}

function start(projectRoot) {
  const existingServer = serversByRoot.get(projectRoot)
  if (existingServer) {
    return Promise.resolve({ url: 'http://127.0.0.1:' + existingServer.port + '/', port: existingServer.port, alreadyRunning: true })
  }

  const server = http.createServer((request, response) => {
    const requestUrl = request.url || '/'
    const queryIndex = requestUrl.indexOf('?')
    const rawPath = queryIndex === -1 ? requestUrl : requestUrl.slice(0, queryIndex)
    const queryString = queryIndex === -1 ? '' : requestUrl.slice(queryIndex + 1)
    let requestedPath = rawPath
    try {
      requestedPath = decodeURIComponent(rawPath)
    } catch (_decodeError) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Bad request')
      return
    }

    // The generated wrapper page for body-only html-tool files (CODE-16).
    if (requestedPath === '/__codedevtool-app' || requestedPath === '/__codedevtool-app/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end(injectConsoleRelay(buildWrapperPage(projectRoot, queryString)))
      return
    }

    const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^\/+/, '')
    const absolutePath = path.resolve(projectRoot, relativePath)

    if (!isPathInsideRoot(projectRoot, absolutePath)) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Forbidden')
      return
    }

    fs.stat(absolutePath, (statError, fileStats) => {
      const finalPath = !statError && fileStats.isDirectory()
        ? path.join(absolutePath, 'index.html')
        : absolutePath
      fs.readFile(finalPath, (readError, fileContent) => {
        if (readError) {
          response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          response.end('Not found')
          return
        }
        const contentType = getContentTypeFor(finalPath)
        if (contentType.startsWith('text/html')) {
          response.writeHead(200, { 'Content-Type': contentType })
          response.end(injectConsoleRelay(fileContent.toString('utf8')))
          return
        }
        response.writeHead(200, { 'Content-Type': contentType })
        response.end(fileContent)
      })
    })
  })

  return new Promise((resolve, reject) => {
    server.on('error', (listenError) => reject(listenError))
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      serversByRoot.set(projectRoot, { server: server, port: address.port })
      resolve({ url: 'http://127.0.0.1:' + address.port + '/', port: address.port })
    })
  })
}

function stop(projectRoot) {
  const serverEntry = serversByRoot.get(projectRoot)
  if (!serverEntry) return
  serverEntry.server.close()
  serversByRoot.delete(projectRoot)
}

function stopAll() {
  for (const serverEntry of Array.from(serversByRoot.values())) serverEntry.server.close()
  serversByRoot = new Map()
}

module.exports = { start, stop, stopAll, detectProjectKind, listEntryPages }
