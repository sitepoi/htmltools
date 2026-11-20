'use strict'

// Chat transcripts on disk: <tool>/Chats/<id>.json plus an attachments folder.
//
// This is the one place in Studio that WRITES, and it only ever writes inside
// the tool's own Chats folder - never a source file. A chat is Studio's own
// artifact: it is created by the operator, it is not part of the tool package,
// and it must survive a browser refresh and a dozen parallel conversations.

const fs = require('fs')
const path = require('path')

const toolRoots = require('../toolRoots')
const workspace = require('../workspace')

const CHATS_DIRECTORY = 'Chats'
const ATTACHMENTS_DIRECTORY = 'attachments'
const SCHEMA = 'uniconhub-studio-chat'
const VERSION = 1
const MAX_NAME = 80
const MAX_MESSAGES = 400
const MAX_MESSAGE_CHARS = 20000
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024

function findTool(config, toolPath) {
  const wanted = String(toolPath == null ? '' : toolPath).trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (!wanted) return null
  return toolRoots.listTools(config).tools.filter((tool) => tool.relativePath === wanted)[0] || null
}

function slugify(text, fallback) {
  const slug = String(text == null ? '' : text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || fallback
}

function chatsDirectoryOf(tool) {
  return path.join(tool.path, CHATS_DIRECTORY)
}

function ensureDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath)) fs.mkdirSync(directoryPath, { recursive: true })
  return directoryPath
}

function relativeOf(absolutePath) {
  return path.relative(workspace.repoRoot(), absolutePath).replace(/\\/g, '/')
}

function sanitizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) return []
  return rawMessages
    .filter((entry) => entry && (entry.role === 'user' || entry.role === 'assistant') && typeof entry.text === 'string')
    .slice(-MAX_MESSAGES)
    .map((entry) => ({
      role: entry.role,
      text: entry.text.slice(0, MAX_MESSAGE_CHARS),
      at: typeof entry.at === 'string' ? entry.at : new Date().toISOString(),
      meta: typeof entry.meta === 'string' ? entry.meta.slice(0, 200) : '',
      attachments: Array.isArray(entry.attachments)
        ? entry.attachments.filter((item) => item && typeof item.path === 'string').slice(0, 10)
          .map((item) => ({ path: item.path, name: String(item.name || '').slice(0, 120), kind: item.kind === 'image' ? 'image' : 'text' }))
        : []
    }))
}

function readChatFile(absolutePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch (error) {
    return null
  }
}

function listChats(options) {
  const config = options.config
  const tool = findTool(config, options.toolPath)
  if (!tool) return { ok: false, reason: 'That tool folder is not in the registry.' }
  const directory = chatsDirectoryOf(tool)
  if (!fs.existsSync(directory)) return { ok: true, tool: tool.relativePath, directory: relativeOf(directory), chats: [] }
  const chats = []
  fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .forEach((entry) => {
      const record = readChatFile(path.join(directory, entry.name))
      if (!record || !Array.isArray(record.messages)) return
      chats.push({
        id: entry.name.replace(/\.json$/i, ''),
        name: String(record.name || entry.name.replace(/\.json$/i, '')),
        updatedAt: String(record.updatedAt || record.createdAt || ''),
        messages: record.messages.length,
        model: String(record.model || ''),
        file: relativeOf(path.join(directory, entry.name))
      })
    })
  chats.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
  return { ok: true, tool: tool.relativePath, directory: relativeOf(directory), chats }
}

function loadChat(options) {
  const config = options.config
  const tool = findTool(config, options.toolPath)
  if (!tool) return { ok: false, reason: 'That tool folder is not in the registry.' }
  const id = String(options.id || '').trim()
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) return { ok: false, reason: 'That chat id is not valid.' }
  const file = path.join(chatsDirectoryOf(tool), id + '.json')
  const record = readChatFile(file)
  if (!record) return { ok: false, reason: 'That chat file does not exist.' }
  return {
    ok: true,
    chat: {
      id,
      name: String(record.name || id),
      model: String(record.model || ''),
      createdAt: String(record.createdAt || ''),
      updatedAt: String(record.updatedAt || ''),
      messages: sanitizeMessages(record.messages),
      file: relativeOf(file)
    }
  }
}

function uniqueId(directory, base) {
  let candidate = base
  let counter = 2
  while (fs.existsSync(path.join(directory, candidate + '.json'))) {
    candidate = base + '-' + counter
    counter += 1
    if (counter > 200) break
  }
  return candidate
}

function saveChat(options) {
  const config = options.config
  const tool = findTool(config, options.toolPath)
  if (!tool) return { ok: false, reason: 'That tool folder is not in the registry.' }
  const directory = ensureDirectory(chatsDirectoryOf(tool))
  const wantedId = String(options.id || '').trim()
  const name = String(options.name || '').trim().slice(0, MAX_NAME) || 'Chat'
  const id = /^[a-zA-Z0-9._-]+$/.test(wantedId)
    ? wantedId
    : uniqueId(directory, slugify(name, 'chat'))
  const file = path.join(directory, id + '.json')
  const existing = readChatFile(file) || {}
  const now = new Date().toISOString()
  const record = {
    schema: SCHEMA,
    version: VERSION,
    id,
    name,
    tool: tool.relativePath,
    model: String(options.model || existing.model || ''),
    createdAt: String(existing.createdAt || now),
    updatedAt: now,
    messages: sanitizeMessages(options.messages)
  }
  const temporary = file + '.tmp-' + process.pid
  fs.writeFileSync(temporary, JSON.stringify(record, null, 2) + '\n', 'utf8')
  fs.renameSync(temporary, file)
  return { ok: true, id, name, file: relativeOf(file), updatedAt: now, messages: record.messages.length }
}

function deleteChat(options) {
  const config = options.config
  const tool = findTool(config, options.toolPath)
  if (!tool) return { ok: false, reason: 'That tool folder is not in the registry.' }
  const id = String(options.id || '').trim()
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) return { ok: false, reason: 'That chat id is not valid.' }
  const file = path.join(chatsDirectoryOf(tool), id + '.json')
  if (!fs.existsSync(file)) return { ok: false, reason: 'That chat file does not exist.' }
  fs.unlinkSync(file)
  const attachmentDirectory = path.join(chatsDirectoryOf(tool), ATTACHMENTS_DIRECTORY, id)
  if (fs.existsSync(attachmentDirectory)) {
    fs.rmSync(attachmentDirectory, { recursive: true, force: true })
  }
  return { ok: true, id, file: relativeOf(file) }
}

// An upload belongs to one chat so deleting the chat can clean it up.
function saveAttachment(options) {
  const config = options.config
  const tool = findTool(config, options.toolPath)
  if (!tool) return { ok: false, reason: 'That tool folder is not in the registry.' }
  const chatId = String(options.chatId || 'unsaved').replace(/[^a-zA-Z0-9._-]/g, '-')
  const originalName = String(options.name || 'file').replace(/[\\/]/g, '-').slice(0, 120) || 'file'
  const buffer = Buffer.from(String(options.dataBase64 || ''), 'base64')
  if (!buffer.length) return { ok: false, reason: 'The upload was empty.' }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    return { ok: false, reason: 'The upload is larger than ' + Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024) + ' MB.' }
  }
  const directory = ensureDirectory(path.join(chatsDirectoryOf(tool), ATTACHMENTS_DIRECTORY, chatId))
  let target = path.join(directory, originalName)
  let counter = 2
  while (fs.existsSync(target)) {
    const extension = path.extname(originalName)
    target = path.join(directory, path.basename(originalName, extension) + '-' + counter + extension)
    counter += 1
  }
  fs.writeFileSync(target, buffer)
  const lower = originalName.toLowerCase()
  const kind = /\.(png|jpe?g|gif|webp|bmp)$/.test(lower) ? 'image' : 'text'
  return {
    ok: true,
    name: path.basename(target),
    path: relativeOf(target),
    absolutePath: target,
    kind,
    bytes: buffer.length
  }
}

module.exports = {
  CHATS_DIRECTORY,
  ATTACHMENTS_DIRECTORY,
  MAX_ATTACHMENT_BYTES,
  findTool,
  slugify,
  listChats,
  loadChat,
  saveChat,
  deleteChat,
  saveAttachment
}
