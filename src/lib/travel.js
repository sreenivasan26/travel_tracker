// Pure logic for the read-only Travel viewer: plan validation, status, grouping, stale check, year rows.
// No React, no storage here (see store.js), so everything is unit-testable in node.

export const FORMAT = 'nt-travel-plan'
export const VERSION = 1
export const STORAGE_KEY = 'notes-tasks.travel.v1'
export const STALE_HOURS = 72

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ---------- dates (ISO strings, no timezone maths) ----------
function parts(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return { y, m, d }
}
function dayNum(iso) {
  const { y, m, d } = parts(iso)
  return Math.round(Date.UTC(y, m - 1, d) / 86400000)
}
export function isIsoDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false
  const { y, m, d } = parts(s)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}
export const diffDays = (a, b) => dayNum(a) - dayNum(b) // a - b
export function todayIso(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}
export function fmtDay(iso) { // "Sun 20 Dec"
  const { y, m, d } = parts(iso)
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`
}
export function fmtShort(iso) { // "20 Dec"
  const { m, d } = parts(iso)
  return `${d} ${MONTHS[m - 1]}`
}
export function fmtRange(start, end) { // "20-27 Dec 2026", "29 Dec 2026 - 3 Jan 2027"
  const a = parts(start), b = parts(end)
  if (start === end) return `${a.d} ${MONTHS[a.m - 1]} ${a.y}`
  if (a.y !== b.y) return `${a.d} ${MONTHS[a.m - 1]} ${a.y} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`
  if (a.m !== b.m) return `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`
  return `${a.d}–${b.d} ${MONTHS[a.m - 1]} ${a.y}`
}
export function fmtRangeShort(start, end) { // year-view chips: "3–8 Mar"
  const a = parts(start), b = parts(end)
  if (start === end) return `${a.d} ${MONTHS[a.m - 1]}`
  if (a.m !== b.m) return `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]}`
  return `${a.d}–${b.d} ${MONTHS[a.m - 1]}`
}
export function fmtTime(min) {
  if (min == null || !Number.isFinite(min)) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${p(Math.floor(min / 60) % 24)}:${p(min % 60)}`
}
export const TRANSPORT_KINDS = ['flight', 'train', 'bus', 'cab', 'car']
export const isTransport = (kind) => TRANSPORT_KINDS.includes(kind)
export function fmtDuration(mins) { // 190 -> "3h 10m", 45 -> "45m", 120 -> "2h"
  if (mins == null || !Number.isFinite(mins) || mins < 0) return ''
  const h = Math.floor(mins / 60), m = Math.round(mins % 60)
  return [h ? `${h}h` : '', m || !h ? `${m}m` : ''].filter(Boolean).join(' ')
}
// "Chennai → Pondy" for transport rows (either end may be missing).
export function routeText(item) {
  if (!isTransport(item.kind)) return ''
  const a = item.from_place || '', b = item.to_place || ''
  return a && b ? `${a} → ${b}` : a || b
}
// "09:00 → 12:10 · 3h 10m" (parts that exist only); transport rows only.
export function timesText(item) {
  if (!isTransport(item.kind)) return ''
  const t = item.time != null ? fmtTime(item.time) : ''
  const e = item.end_time != null ? fmtTime(item.end_time) : ''
  const span = t && e ? `${t} → ${e}` : t ? `Departs ${t}` : e ? `Arrives ${e}` : ''
  return [span, fmtDuration(item.duration_mins)].filter(Boolean).join(' · ')
}
export const nextTravelText = (item) => (item.travel_to_next_mins != null ? `${item.travel_to_next_mins} min to next` : '')
export function fmtStamp(ms) { // "Thu 22 Oct, 09:14" in the phone's local time
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${p(d.getHours())}:${p(d.getMinutes())}`
}
export function fmtGenerated(iso) { // generated_at is local ISO without zone: "Thu 22 Oct 09:10"
  const ms = parseLocal(iso)
  return ms == null ? String(iso) : fmtStamp(ms).replace(',', '')
}
export function parseLocal(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(s)) return null
  const t = new Date(s).getTime() // no zone in string = local time
  return Number.isNaN(t) ? null : t
}
export function fmtMoney(n, decimals = 0) {
  const v = Number(n) || 0
  const s = Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return `${v < 0 ? '−' : ''}₹${s}`
}

// ---------- validation ----------
// Result: { ok: true, plan } or { ok: false, kind, title, detail, canOverride? }.
// kinds: 'not-json' | 'wrong-format' | 'newer-version' | 'incomplete' | 'older'
const bad = (kind, title, detail, extra = {}) => ({ ok: false, kind, title, detail, ...extra })
const FIELD_LABEL = { id: 'an id', name: 'a name', start_date: 'a start date', end_date: 'an end date' }
const isNum = (x) => typeof x === 'number' && Number.isFinite(x)
const numOr = (x, d = 0) => (isNum(x) ? x : d)

export function validatePlan(text, { fileName = 'That file', currentGeneratedAt = null, allowOlder = false } = {}) {
  let raw
  try {
    if (typeof text !== 'string' || !text.trim()) throw new Error('empty')
    raw = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    return bad('not-json', 'Could not read that file.', 'It is not valid JSON. Your current plan is unchanged.')
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw) || raw.format !== FORMAT) {
    return bad('wrong-format', 'Could not load that file.', `"${fileName}" is not a Travel plan (its format is not ${FORMAT}). Your current plan is unchanged.`)
  }
  if (isNum(raw.version) && raw.version > VERSION) {
    return bad('newer-version', 'This plan is newer than the app.', `The website made version ${raw.version}, this app reads version ${VERSION}. Update the app, then load it again.`)
  }
  const incomplete = (what) => bad('incomplete', 'The plan is incomplete.', `${what} Make the plan again on the web and reload. Your current plan is unchanged.`)
  if (raw.version !== VERSION) return incomplete('The plan has no valid version number.')
  if (!Array.isArray(raw.trips)) return incomplete('The plan has no list of trips.')
  if (parseLocal(raw.generated_at) == null) return incomplete('The plan has no valid generated_at time.')

  const trips = []
  for (let i = 0; i < raw.trips.length; i++) {
    const t = raw.trips[i]
    const n = i + 1
    if (t === null || typeof t !== 'object' || Array.isArray(t)) return incomplete(`Trip ${n} is not a trip.`)
    for (const f of ['id', 'name']) {
      if (typeof t[f] !== 'string' || !t[f].trim()) return incomplete(`Trip ${n} has no ${f}.`)
    }
    for (const f of ['start_date', 'end_date']) {
      if (t[f] == null || t[f] === '') return incomplete(`Trip ${n} has no ${f === 'start_date' ? 'start' : 'end'} date.`)
      if (!isIsoDate(t[f])) return incomplete(`Trip ${n} has an invalid ${f === 'start_date' ? 'start' : 'end'} date.`)
    }
    if (t.end_date < t.start_date) return incomplete(`Trip ${n} ends before it starts.`)
    if (t.items != null && !Array.isArray(t.items)) return incomplete(`Trip ${n} has a malformed item list.`)
    if (t.spend != null && !Array.isArray(t.spend)) return incomplete(`Trip ${n} has a malformed spend list.`)
    const items = []
    for (let j = 0; j < (t.items || []).length; j++) {
      const it = t.items[j]
      if (it === null || typeof it !== 'object' || typeof it.title !== 'string') return incomplete(`Trip ${n}, item ${j + 1} has no title.`)
      if (it.date != null && !isIsoDate(it.date)) return incomplete(`Trip ${n}, item ${j + 1} has an invalid date.`)
      if (it.end_date != null && !isIsoDate(it.end_date)) return incomplete(`Trip ${n}, item ${j + 1} has an invalid end date.`)
      items.push({
        id: String(it.id ?? `${t.id}-${j}`), kind: typeof it.kind === 'string' ? it.kind : 'other', title: it.title,
        place: it.place || '', date: it.date || null, time: isNum(it.time) ? it.time : null, end_date: it.end_date || null,
        booking_ref: it.booking_ref || '', cost: isNum(it.cost) ? it.cost : null, done: it.done === true, sort_order: numOr(it.sort_order, j),
        from_place: typeof it.from_place === 'string' ? it.from_place.trim() : '', to_place: typeof it.to_place === 'string' ? it.to_place.trim() : '',
        end_time: isNum(it.end_time) ? it.end_time : null, duration_mins: isNum(it.duration_mins) ? it.duration_mins : null,
        travel_to_next_mins: isNum(it.travel_to_next_mins) ? it.travel_to_next_mins : null,
      })
    }
    const spend = (t.spend || []).filter((s) => s && typeof s === 'object').map((s) => ({
      date: typeof s.date === 'string' ? s.date : '', spend_name: String(s.spend_name ?? ''), category: String(s.category ?? ''),
      mode: String(s.mode ?? ''), amount: numOr(s.amount),
    }))
    trips.push({
      id: t.id, name: t.name, destination: t.destination || '', start_date: t.start_date, end_date: t.end_date,
      purpose: t.purpose === 'work' ? 'work' : 'personal', cancelled: t.cancelled === true, notes: t.notes || '',
      budget: isNum(t.budget) ? t.budget : null, planned_cost: numOr(t.planned_cost), actual_spend: numOr(t.actual_spend),
      items_total: isNum(t.items_total) ? t.items_total : items.length,
      items_done: isNum(t.items_done) ? t.items_done : items.filter((x) => x.done).length,
      items, spend,
    })
  }
  trips.sort((a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0))
  const plan = { format: FORMAT, version: VERSION, generated_at: raw.generated_at, today: isIsoDate(raw.today) ? raw.today : null, trips }

  const curMs = parseLocal(currentGeneratedAt)
  const newMs = parseLocal(plan.generated_at)
  if (!allowOlder && curMs != null && newMs < curMs) {
    return bad('older', 'This plan is older than the one you have.',
      `Loaded plan made ${fmtGenerated(currentGeneratedAt)}; this file ${fmtGenerated(plan.generated_at)}.`, { canOverride: true })
  }
  return { ok: true, plan }
}

// ---------- status, grouping ----------
export function tripStatus(trip, today) {
  if (trip.cancelled) return 'cancelled'
  if (today < trip.start_date) return 'upcoming'
  if (today > trip.end_date) return 'done'
  return 'ongoing'
}
export const nightsOf = (trip) => diffDays(trip.end_date, trip.start_date)

// Order: Ongoing, Upcoming (soonest first), Past (latest first), Cancelled last.
export function groupTrips(trips, today) {
  const g = { ongoing: [], upcoming: [], past: [], cancelled: [] }
  for (const t of trips) {
    const s = tripStatus(t, today)
    ;(s === 'done' ? g.past : g[s]).push(t)
  }
  const asc = (a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0)
  g.ongoing.sort(asc)
  g.upcoming.sort(asc)
  g.past.sort((a, b) => asc(b, a))
  g.cancelled.sort((a, b) => asc(b, a))
  return g
}
// Past list split by year caption (only when it spans several years).
export function pastByYear(past) {
  const out = []
  for (const t of past) {
    const y = Number(t.start_date.slice(0, 4))
    let last = out[out.length - 1]
    if (!last || last.year !== y) { last = { year: y, trips: [] }; out.push(last) }
    last.trips.push(t)
  }
  return out
}

export function dayProgress(trip, today) { // "Day 4 of 5" for an ongoing trip
  const total = diffDays(trip.end_date, trip.start_date) + 1
  return { day: Math.min(total, Math.max(1, diffDays(today, trip.start_date) + 1)), total }
}
export const startsInDays = (trip, today) => diffDays(trip.start_date, today)

export function itemPct(trip) {
  return trip.items_total > 0 ? Math.round((trip.items_done / trip.items_total) * 100) : 0
}
export function todaysItems(trip, today) {
  return trip.items.filter((i) => i.date === today)
}
export function nextItem(trip, today) {
  return trip.items.find((i) => i.date && i.date >= today) || null
}

// ---------- staleness ----------
// Stale = the plan was made on the web more than 72 h ago (generated_at; the contract's staleness field).
export function planAgeHours(plan, nowMs = Date.now()) {
  const g = parseLocal(plan && plan.generated_at)
  return g == null ? 0 : (nowMs - g) / 3600000
}
export const isStale = (plan, nowMs = Date.now()) => planAgeHours(plan, nowMs) > STALE_HOURS
export function ageLabel(plan, nowMs = Date.now()) {
  const h = planAgeHours(plan, nowMs)
  if (h < 1) return 'less than an hour ago'
  if (h < 48) return `${Math.floor(h)} hours ago`
  return `${Math.floor(h / 24)} days ago`
}

// ---------- budget ----------
export function budgetFigures(trip) {
  const { budget, planned_cost: planned, actual_spend: actual } = trip
  const hasBudget = budget != null
  return {
    budget, planned, actual, hasBudget,
    actualVsPlanned: actual - planned,
    left: hasBudget ? budget - actual : null,
    plannedVsBudget: hasBudget ? budget - planned : null, // positive = planned is under budget
    actualPct: hasBudget && budget > 0 ? Math.round((actual / budget) * 100) : null,
    over: hasBudget && actual > budget ? actual - budget : 0,
    scaleMax: Math.max(budget || 0, planned, actual, 1),
  }
}

// ---------- itinerary ----------
// Groups dated items by date. Each group: { date, day (1-based, null when outside), outside, items, cost, stays: [{title, night, nights}] }
export function groupItinerary(trip) {
  const dated = trip.items.filter((i) => i.date)
  const byDate = new Map()
  for (const it of dated) {
    if (!byDate.has(it.date)) byDate.set(it.date, [])
    byDate.get(it.date).push(it)
  }
  const stays = dated.filter((i) => i.kind === 'stay' && i.end_date && i.end_date > i.date)
  const groups = [...byDate.keys()].sort().map((date) => {
    const items = byDate.get(date)
    const outside = date < trip.start_date || date > trip.end_date
    const cost = items.reduce((s, i) => s + (i.cost || 0), 0)
    const cont = stays
      .filter((s) => s.date < date && date < s.end_date)
      .map((s) => ({ title: s.title, night: diffDays(date, s.date) + 1, nights: diffDays(s.end_date, s.date) }))
    return { date, outside, day: outside ? null : diffDays(date, trip.start_date) + 1, items, cost, stays: cont }
  })
  return groups
}
export function stayUntil(item) {
  return item.kind === 'stay' && item.end_date && item.date && item.end_date > item.date ? item.end_date : null
}
export function splitPlaces(trip) {
  const places = trip.items.filter((i) => i.kind === 'place')
  return { dated: places.filter((p) => p.date), undated: places.filter((p) => !p.date) }
}
export const undatedCount = (trip) => trip.items.filter((i) => !i.date).length
export const datedCount = (trip) => trip.items.filter((i) => i.date).length

// ---------- year ----------
export function yearList(trips, today) {
  const ys = new Set([Number(today.slice(0, 4))])
  for (const t of trips) { ys.add(Number(t.start_date.slice(0, 4))); ys.add(Number(t.end_date.slice(0, 4))) }
  const lo = Math.min(...ys), hi = Math.max(...ys)
  const out = []
  for (let y = lo; y <= hi; y++) out.push(y)
  return out
}
const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate() // m is 1-based
const mIso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// 12 month rows for a year. A trip is a chip in its start month (or, when it began in an earlier year, in January)
// and a one-line continuation link in later months it spans. Chips carry the day bar for that month.
export function yearRows(trips, year, today) {
  const rows = []
  for (let m = 1; m <= 12; m++) {
    const n = dim(year, m)
    const first = mIso(year, m, 1), last = mIso(year, m, n)
    const chips = [], links = []
    for (const t of trips) {
      if (t.end_date < first || t.start_date > last) continue
      const startsHere = t.start_date >= first
      const carriedFromLastYear = m === 1 && t.start_date < first
      if (startsHere || carriedFromLastYear) {
        const s = startsHere ? Number(t.start_date.slice(8, 10)) : 1
        const eInMonth = t.end_date <= last
        const e = eInMonth ? Number(t.end_date.slice(8, 10)) : n
        const contMonth = eInMonth ? null : Number(t.end_date.slice(5, 7))
        chips.push({
          trip: t, status: tripStatus(t, today), leftPct: ((s - 1) / n) * 100, widthPct: ((e - s + 1) / n) * 100,
          continues: !eInMonth, continuesIn: eInMonth ? null : (t.end_date.slice(0, 4) === String(year) ? MONTHS[contMonth - 1] : `${MONTHS[contMonth - 1]} ${t.end_date.slice(0, 4)}`),
        })
      } else {
        links.push({ trip: t, status: tripStatus(t, today) })
      }
    }
    const isCur = today >= first && today <= last
    rows.push({
      month: m, label: MONTHS[m - 1], current: isCur, chips, links, empty: chips.length === 0 && links.length === 0,
      todayPct: isCur ? ((Number(today.slice(8, 10)) - 1) / n) * 100 : null,
    })
  }
  return rows
}
// Same counting rules as the web /summary: trips (not cancelled), nights of done + ongoing, spend of all that year's trips.
export function yearSummary(trips, year, today) {
  const ofYear = trips.filter((t) => Number(t.start_date.slice(0, 4)) === year)
  let nights = 0
  for (const t of ofYear) {
    const s = tripStatus(t, today)
    if (s === 'done' || s === 'ongoing') nights += nightsOf(t)
  }
  return { trips: ofYear.filter((t) => !t.cancelled).length, nights, spend: ofYear.reduce((s, t) => s + t.actual_spend, 0) }
}
