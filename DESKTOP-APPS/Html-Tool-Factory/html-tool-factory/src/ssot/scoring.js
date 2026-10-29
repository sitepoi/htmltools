'use strict'

// Task effort points and prompt batching.
//
// One apply call should carry roughly one prompt worth of work: not a single
// tiny rename (wasteful) and not twenty tasks (unreviewable and too much load
// for one answer). Every task gets a score out of 100 that estimates its cost,
// and tasks are packed into batches whose total lands on the 100 point target.

const POINT_MIN = 5
const POINT_MAX = 100
const TARGET_POINTS = 100
const MAX_BATCH_POINTS = 130
const MAX_BATCH_TASKS = 6

const KIND_BASE = { code: 30, test: 20, doc: 15, chore: 10 }

function clampPoints(value) {
  const number = Math.round(Number(value) || 0)
  return Math.max(POINT_MIN, Math.min(POINT_MAX, number))
}

// Deterministic estimate from the task itself: kind, how many files it touches,
// how many acceptance lines it must satisfy and what the title asks for.
function estimatePoints(task) {
  const item = task || {}
  let points = KIND_BASE[String(item.kind || 'code')] || 30
  points += Math.min(20, (Array.isArray(item.files) ? item.files.length : 0) * 5)
  points += Math.min(20, (Array.isArray(item.acceptance) ? item.acceptance.length : 0) * 4)
  const text = [
    item.title,
    item.detail,
    item.notes,
    Array.isArray(item.acceptance) ? item.acceptance.join(' ') : ''
  ].filter(Boolean).join(' ').toLowerCase()
  if (/rewrite|refactor|from scratch|whole file|rebuild|migrate|restructure/.test(text)) points += 25
  else if (/\b(add|build|implement|create|new|wire|store|validate|persist|export)\b/.test(text)) points += 12
  if (/rename|typo|copy change|wording|label|comment|readme|reword/.test(text)) points -= 12
  if (item.checklistId) points += 10
  if (item.usabilityFindingId) points += 5
  if (item.kind === 'test') points = Math.min(points, 45)
  return clampPoints(points)
}

// The model may supply its own score; it is only trusted inside 5..100.
function normalizePoints(rawPoints, fallback) {
  const number = Number(rawPoints)
  if (Number.isFinite(number) && number >= POINT_MIN && number <= POINT_MAX) return Math.round(number)
  return clampPoints(fallback == null ? 30 : fallback)
}

// Fills any missing score, so old runs and hand written tasks get one too.
function applyPoints(ssot) {
  let changed = 0
  ;(Array.isArray(ssot && ssot.tasks) ? ssot.tasks : []).forEach((task) => {
    const next = normalizePoints(task.points, estimatePoints(task))
    if (task.points !== next) {
      task.points = next
      changed += 1
    }
  })
  return changed
}

// Greedy packing toward the target, never above the hard caps.
function buildBatches(tasks, options) {
  const settings = options || {}
  const target = Number(settings.targetPoints) || TARGET_POINTS
  const maxPoints = Number(settings.maxBatchPoints) || MAX_BATCH_POINTS
  const maxTasks = Number(settings.maxTasksPerBatch) || MAX_BATCH_TASKS
  const batches = []
  let current = { tasks: [], points: 0 }

  function flush() {
    if (!current.tasks.length) return
    batches.push(current)
    current = { tasks: [], points: 0 }
  }

  ;(Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const points = normalizePoints(task.points, estimatePoints(task))
    if (task.points !== points) task.points = points
    if (!current.tasks.length) {
      current = { tasks: [task], points }
      if (points >= target) flush()
      return
    }
    const overPoints = current.points + points > maxPoints
    const overTasks = current.tasks.length >= maxTasks
    if (overPoints || overTasks) {
      flush()
      current = { tasks: [task], points }
      if (points >= target) flush()
      return
    }
    current.tasks.push(task)
    current.points += points
    if (current.points >= target) flush()
  })
  flush()

  // Do not leave a small remainder behind when the previous batch can still
  // absorb it: a 20 point batch alone is exactly what this feature avoids.
  if (batches.length > 1) {
    const last = batches[batches.length - 1]
    const previous = batches[batches.length - 2]
    if (last.points < target / 2 &&
      previous.points + last.points <= maxPoints &&
      previous.tasks.length + last.tasks.length <= maxTasks) {
      previous.tasks.push(...last.tasks)
      previous.points += last.points
      batches.pop()
    }
  }

  return batches.map((batch, index) => ({
    id: 'B' + (index + 1),
    points: batch.points,
    tasks: batch.tasks,
    label: batch.tasks.map((task) => task.id).join(', ')
  }))
}

module.exports = {
  POINT_MIN,
  POINT_MAX,
  TARGET_POINTS,
  MAX_BATCH_POINTS,
  MAX_BATCH_TASKS,
  clampPoints,
  estimatePoints,
  normalizePoints,
  applyPoints,
  buildBatches
}
