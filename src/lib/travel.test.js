import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  validatePlan, tripStatus, groupTrips, pastByYear, isStale, ageLabel, yearRows, yearSummary, yearList, budgetFigures,
  groupItinerary, splitPlaces, dayProgress, startsInDays, nightsOf, fmtRange, fmtDay, fmtTime, fmtMoney, itemPct, nextItem, todaysItems,
  STORAGE_KEY,
} from './travel.js'
import { applyPlanText, loadStored } from './store.js'

const text = readFileSync(new URL('./fixtures/sample-plan.json', import.meta.url), 'utf8')
const raw = () => JSON.parse(text)
const TODAY = '2026-10-22'
const plan = validatePlan(text, { fileName: 'travel-plan.json' }).plan
const trip = (id) => plan.trips.find((t) => t.id === id)

function memStore() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }
}

describe('validatePlan', () => {
  it('accepts the fixture and sorts trips by start date', () => {
    const r = validatePlan(text)
    expect(r.ok).toBe(true)
    const starts = r.plan.trips.map((t) => t.start_date)
    expect(starts).toEqual([...starts].sort())
    expect(r.plan.trips).toHaveLength(5)
  })
  it('rejects non-JSON and empty files', () => {
    for (const bad of ['not json {', '', '   ']) {
      const r = validatePlan(bad)
      expect(r.ok).toBe(false)
      expect(r.kind).toBe('not-json')
      expect(r.title).toBe('Could not read that file.')
    }
  })
  it('rejects a wrong format and names the file', () => {
    const r = validatePlan(JSON.stringify({ format: 'nt-finance-summary', version: 1 }), { fileName: 'finance-summary.json' })
    expect(r.kind).toBe('wrong-format')
    expect(r.detail).toContain('"finance-summary.json" is not a Travel plan')
    expect(validatePlan('[]').kind).toBe('wrong-format')
    expect(validatePlan('null').kind).toBe('wrong-format')
  })
  it('rejects a newer version', () => {
    const o = raw(); o.version = 2
    const r = validatePlan(JSON.stringify(o))
    expect(r.kind).toBe('newer-version')
    expect(r.title).toBe('This plan is newer than the app.')
    expect(r.detail).toContain('version 2')
    expect(r.detail).toContain('reads version 1')
  })
  it('rejects missing trips and malformed trips with the trip number', () => {
    const o = raw(); delete o.trips
    expect(validatePlan(JSON.stringify(o)).kind).toBe('incomplete')
    const p = raw(); delete p.trips[3].start_date
    const r = validatePlan(JSON.stringify(p))
    expect(r.kind).toBe('incomplete')
    expect(r.title).toBe('The plan is incomplete.')
    expect(r.detail).toContain('Trip 4 has no start date.')
    const q = raw(); q.trips[0].id = ''
    expect(validatePlan(JSON.stringify(q)).detail).toContain('Trip 1 has no id.')
    const n = raw(); delete n.trips[1].name
    expect(validatePlan(JSON.stringify(n)).detail).toContain('Trip 2 has no name.')
    const d = raw(); d.trips[0].end_date = '2026-13-45'
    expect(validatePlan(JSON.stringify(d)).detail).toContain('invalid end date')
    const e = raw(); e.trips[0].items = 'x'
    expect(validatePlan(JSON.stringify(e)).kind).toBe('incomplete')
  })
  it('rejects a plan older than the loaded one unless overridden', () => {
    const r = validatePlan(text, { currentGeneratedAt: '2026-10-22T09:10:00' })
    expect(r.ok).toBe(false)
    expect(r.kind).toBe('older')
    expect(r.canOverride).toBe(true)
    expect(r.detail).toContain('Loaded plan made Thu 22 Oct 09:10')
    expect(r.detail).toContain('this file Thu 22 Oct 07:10')
    expect(validatePlan(text, { currentGeneratedAt: '2026-10-22T09:10:00', allowOlder: true }).ok).toBe(true)
    expect(validatePlan(text, { currentGeneratedAt: '2026-10-22T07:10:00' }).ok).toBe(true) // same time is fine
  })
  it('defaults purpose to personal and fills missing optional fields', () => {
    const o = raw(); delete o.trips[0].purpose; delete o.trips[0].items; delete o.trips[0].spend; delete o.trips[0].items_total
    const r = validatePlan(JSON.stringify(o))
    expect(r.ok).toBe(true)
    expect(r.plan.trips[0].purpose).toBe('personal')
    expect(r.plan.trips[0].items).toEqual([])
    expect(r.plan.trips[0].items_total).toBe(0)
  })
})

describe('store: a bad file never replaces the current plan', () => {
  it('replaces on success, keeps on rejection, uses the storage key', () => {
    const st = memStore()
    const a = applyPlanText(text, { fileName: 'travel-plan.json', storage: st, now: 1000 })
    expect(a.ok).toBe(true)
    expect(st.getItem(STORAGE_KEY)).toBeTruthy()
    expect(STORAGE_KEY).toBe('notes-tasks.travel.v1')
    const cur = loadStored(st)
    expect(cur.loaded_at).toBe(1000)
    const b = applyPlanText('garbage', { fileName: 'x.json', storage: st, current: cur })
    expect(b.ok).toBe(false)
    expect(loadStored(st).loaded_at).toBe(1000)
    const older = raw(); older.generated_at = '2026-10-21T18:02:00'; older.trips = older.trips.slice(0, 1)
    const c = applyPlanText(JSON.stringify(older), { fileName: 'x.json', storage: st, current: cur })
    expect(c.kind).toBe('older')
    expect(loadStored(st).plan.trips).toHaveLength(5)
    const d = applyPlanText(JSON.stringify(older), { fileName: 'x.json', storage: st, current: cur, allowOlder: true, now: 2000 })
    expect(d.ok).toBe(true)
    expect(loadStored(st).plan.trips).toHaveLength(1) // replaced, not merged
    expect(loadStored(st).loaded_at).toBe(2000)
  })
  it('returns null for corrupt storage', () => {
    const st = memStore(); st.setItem(STORAGE_KEY, '{oops')
    expect(loadStored(st)).toBeNull()
  })
})

describe('status and grouping', () => {
  it('recomputes status from dates and the phone date', () => {
    expect(tripStatus(trip('t-e'), TODAY)).toBe('upcoming')
    expect(tripStatus(trip('t-d'), TODAY)).toBe('ongoing')
    expect(tripStatus(trip('t-b'), TODAY)).toBe('done')
    expect(tripStatus(trip('t-c'), TODAY)).toBe('cancelled')
    expect(tripStatus(trip('t-d'), '2026-10-19')).toBe('ongoing') // first day
    expect(tripStatus(trip('t-d'), '2026-10-23')).toBe('ongoing') // last day
    expect(tripStatus(trip('t-d'), '2026-10-24')).toBe('done')
    expect(tripStatus(trip('t-d'), '2026-10-18')).toBe('upcoming')
    expect(tripStatus({ ...trip('t-d'), status: 'upcoming' }, TODAY)).toBe('ongoing') // stored status ignored
  })
  it('groups ongoing / upcoming / past / cancelled in order', () => {
    const g = groupTrips(plan.trips, TODAY)
    expect(g.ongoing.map((t) => t.id)).toEqual(['t-d'])
    expect(g.upcoming.map((t) => t.id)).toEqual(['t-e'])
    expect(g.past.map((t) => t.id)).toEqual(['t-b', 't-a']) // latest first
    expect(g.cancelled.map((t) => t.id)).toEqual(['t-c'])
    const later = groupTrips(plan.trips, '2026-12-25')
    expect(later.ongoing.map((t) => t.id)).toEqual(['t-e'])
    expect(later.past.map((t) => t.id)).toContain('t-d')
  })
  it('splits the past list by year', () => {
    const g = groupTrips(plan.trips, '2027-01-05')
    const by = pastByYear(g.past)
    expect(by.map((b) => b.year)).toEqual([2026, 2025])
  })
  it('computes day progress, nights and countdown', () => {
    expect(dayProgress(trip('t-d'), TODAY)).toEqual({ day: 4, total: 5 })
    expect(nightsOf(trip('t-e'))).toBe(7)
    expect(startsInDays(trip('t-e'), TODAY)).toBe(59)
    expect(itemPct(trip('t-e'))).toBe(11)
  })
  it('finds today items and the next item', () => {
    expect(todaysItems(trip('t-d'), TODAY).map((i) => i.id)).toEqual(['it-12'])
    expect(nextItem(trip('t-e'), TODAY).date).toBe('2026-12-15')
    expect(nextItem(trip('t-b'), TODAY)).toBeNull()
  })
})

describe('stale check', () => {
  const p = { generated_at: '2026-10-22T07:10:00' }
  const at = (s) => new Date(s).getTime()
  it('is fresh up to 72 hours and stale after', () => {
    expect(isStale(p, at('2026-10-22T09:14:00'))).toBe(false)
    expect(isStale(p, at('2026-10-25T07:10:00'))).toBe(false) // exactly 72 h
    expect(isStale(p, at('2026-10-25T07:11:00'))).toBe(true)
    expect(isStale(p, at('2026-10-28T00:00:00'))).toBe(true)
  })
  it('labels the age', () => {
    expect(ageLabel(p, at('2026-10-22T07:30:00'))).toBe('less than an hour ago')
    expect(ageLabel(p, at('2026-10-22T20:10:00'))).toBe('13 hours ago')
    expect(ageLabel(p, at('2026-10-26T07:10:00'))).toBe('4 days ago')
  })
})

describe('budget', () => {
  it('derives left, actual vs planned and over budget', () => {
    const b = budgetFigures(trip('t-e'))
    expect(b.actualVsPlanned).toBe(-29650)
    expect(b.left).toBe(32800)
    expect(b.plannedVsBudget).toBe(3150)
    expect(b.actualPct).toBe(27)
    expect(b.over).toBe(0)
    const o = budgetFigures(trip('t-b'))
    expect(o.over).toBe(4820)
    expect(o.left).toBe(-4820)
    const n = budgetFigures(trip('t-a'))
    expect(n.hasBudget).toBe(false)
    expect(n.left).toBeNull()
  })
})

describe('itinerary and places', () => {
  it('groups by day with outside-dates, day numbers and stay continuation', () => {
    const g = groupItinerary(trip('t-e'))
    expect(g.map((x) => x.date)).toEqual(['2026-12-15', '2026-12-20', '2026-12-21', '2026-12-22', '2026-12-27'])
    expect(g[0].outside).toBe(true)
    expect(g[0].day).toBeNull()
    expect(g[1].day).toBe(1)
    expect(g[1].cost).toBe(27900)
    expect(g[2].stays).toEqual([{ title: 'Sample Beach Resort', night: 2, nights: 7 }])
    expect(g[3].stays[0].night).toBe(3)
    expect(g[4].stays).toEqual([]) // check-out day
  })
  it('splits dated and undated places', () => {
    const p = splitPlaces(trip('t-e'))
    expect(p.dated.map((x) => x.title)).toEqual(['Sample Fort'])
    expect(p.undated).toHaveLength(2)
  })
})

describe('year rows', () => {
  it('has 12 rows, chips in the start month, today marker in the current month', () => {
    const rows = yearRows(plan.trips, 2026, TODAY)
    expect(rows).toHaveLength(12)
    expect(rows[2].chips.map((c) => c.trip.id)).toEqual(['t-b'])
    expect(rows[2].chips[0].status).toBe('done')
    expect(rows[3].empty).toBe(true)
    expect(rows[4].chips[0].status).toBe('cancelled')
    const oct = rows[9]
    expect(oct.current).toBe(true)
    expect(oct.todayPct).toBeCloseTo((21 / 31) * 100)
    expect(oct.chips[0].status).toBe('ongoing')
    expect(oct.chips[0].leftPct).toBeCloseTo((18 / 31) * 100)
    expect(oct.chips[0].widthPct).toBeCloseTo((5 / 31) * 100)
    expect(rows[11].chips[0].trip.id).toBe('t-e')
    expect(rows.filter((r) => r.current)).toHaveLength(1)
  })
  it('carries a trip from the previous year into January', () => {
    const jan = yearRows(plan.trips, 2026, TODAY)[0]
    expect(jan.chips.map((c) => c.trip.id)).toEqual(['t-a'])
    expect(jan.chips[0].leftPct).toBe(0)
    const dec25 = yearRows(plan.trips, 2025, TODAY)[11]
    expect(dec25.chips[0].continues).toBe(true)
    expect(dec25.chips[0].continuesIn).toBe('Jan 2026')
  })
  it('links a multi-month trip into the following month', () => {
    const t = { ...trip('t-e'), id: 'x', start_date: '2026-03-28', end_date: '2026-04-03', cancelled: false }
    const rows = yearRows([t], 2026, TODAY)
    expect(rows[2].chips[0].continuesIn).toBe('Apr')
    expect(rows[3].links.map((l) => l.trip.id)).toEqual(['x'])
    expect(rows[3].chips).toHaveLength(0)
  })
  it('summarises like the web (cancelled excluded from trips; nights of done and ongoing)', () => {
    const s = yearSummary(plan.trips, 2026, TODAY)
    expect(s.trips).toBe(3) // goa, hyd, jai (old starts 2025; shimla cancelled)
    expect(s.nights).toBe(4 + 5) // hyd 4 nights + jai 5 nights; goa upcoming
    expect(s.spend).toBe(12200 + 26000 + 24820)
  })
  it('lists years from the data and today', () => {
    expect(yearList(plan.trips, TODAY)).toEqual([2025, 2026])
    expect(yearList([], TODAY)).toEqual([2026])
  })
})

describe('formatting', () => {
  it('formats dates, times and money', () => {
    expect(fmtRange('2026-12-20', '2026-12-27')).toBe('20–27 Dec 2026')
    expect(fmtRange('2026-12-29', '2027-01-03')).toBe('29 Dec 2026 – 3 Jan 2027')
    expect(fmtRange('2026-03-28', '2026-04-03')).toBe('28 Mar – 3 Apr 2026')
    expect(fmtDay('2026-12-20')).toBe('Sun 20 Dec')
    expect(fmtTime(410)).toBe('06:50')
    expect(fmtTime(null)).toBe('')
    expect(fmtMoney(45000)).toBe('₹45,000')
    expect(fmtMoney(1234567)).toBe('₹12,34,567')
    expect(fmtMoney(-29650)).toBe('−₹29,650')
    expect(fmtMoney(7200, 2)).toBe('₹7,200.00')
  })
})
