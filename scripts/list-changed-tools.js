// ── CHANGED TOOLS LIST (npm run tools:changed) ─────────────────────────────
// Prints the tools whose app / listing / reporting files changed since the
// last push (tracked diffs + untracked new files). No AI, no writes - used
// as the first step of every publish, by the scripts and by the chat-driven
// checklist (PUBLISH-CHECKLIST.md).
const context = require('./releaseContext')

function main() {
  const pushedCommit = context.getPushedCommit()
  console.log('Pushed commit: ' + (pushedCommit || '(none yet - the whole tree counts as changed)'))
  const changedTools = context.getChangedToolsSince(pushedCommit)
  if (changedTools.length === 0) {
    console.log('No tool changed since the last push.')
    return
  }
  console.log(changedTools.length + ' tool(s) changed:')
  changedTools.forEach((tool) => {
    const allToolsEntry = context.getAllToolsEntry(tool)
    const displayName = (allToolsEntry && allToolsEntry.displayName) || context.toDisplayName(tool.toolName)
    console.log('  - ' + tool.toolName + ' (' + displayName + ') - parts: ' + tool.parts.join(', '))
  })
}

main()
