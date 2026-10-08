const STORAGE_KEY = 'hhp.projectTask.treeSelection'

/** @returns {{ projectId: string, taskDbId: number } | null} */
export function readPersistedTaskTreeSelection() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (o?.projectId == null || String(o.projectId).trim() === '') return null
    const taskDbId = Number(o.taskDbId)
    if (!Number.isFinite(taskDbId) || taskDbId <= 0) return null
    return { projectId: String(o.projectId), taskDbId }
  } catch {
    return null
  }
}

export function writePersistedTaskTreeSelection(projectId, taskDbId) {
  if (projectId == null || String(projectId).trim() === '') return
  const id = Number(taskDbId)
  if (!Number.isFinite(id) || id <= 0) return
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ projectId: String(projectId), taskDbId: id }),
    )
  } catch {
    /* ignore */
  }
}

export function clearPersistedTaskTreeSelection() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
