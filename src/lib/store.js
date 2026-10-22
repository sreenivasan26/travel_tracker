import { STORAGE_KEY, validatePlan } from './travel.js'

// Stored shape: { plan, loaded_at (ms, phone clock), file_name }. Nothing else is persisted.
export function loadStored(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s || !s.plan || !Array.isArray(s.plan.trips)) return null
    return s
  } catch {
    return null
  }
}

export function saveStored(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function clearStored(storage = globalThis.localStorage) {
  try { storage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

// Validate + replace. A rejected file never touches the stored plan.
export function applyPlanText(text, { fileName, current, allowOlder = false, now = Date.now(), storage } = {}) {
  const r = validatePlan(text, { fileName, currentGeneratedAt: current ? current.plan.generated_at : null, allowOlder })
  if (!r.ok) return r
  const state = { plan: r.plan, loaded_at: now, file_name: fileName || 'travel-plan.json' }
  if (!saveStored(state, storage)) {
    return { ok: false, kind: 'storage', title: 'Could not save the plan.', detail: 'The phone has no room for it. Your current plan is unchanged.' }
  }
  return { ok: true, state }
}
