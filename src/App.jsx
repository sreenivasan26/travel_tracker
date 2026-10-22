import React, { useCallback, useEffect, useRef, useState } from 'react'
import { List, CalendarRange, Info, FileUp, Check } from 'lucide-react'
import { todayIso, isStale, fmtStamp } from './lib/travel.js'
import { loadStored, clearStored, applyPlanText } from './lib/store.js'
import { ViewOnly } from './ui.jsx'
import Trips, { FirstRun } from './screens/Trips.jsx'
import Year, { YearHeader } from './screens/Year.jsx'
import Detail from './screens/Detail.jsx'
import { AboutSheet, ConfirmClear, StaleBanner, StaleChip, ErrorBanner } from './screens/Sheets.jsx'

export default function App() {
  const [stored, setStored] = useState(() => loadStored())
  const [today, setToday] = useState(() => todayIso())
  const [tab, setTab] = useState('trips')
  const [openId, setOpenId] = useState(null)
  const [year, setYear] = useState(() => Number(todayIso().slice(0, 4)))
  const [sheet, setSheet] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const pending = useRef(null) // { text, fileName } kept for "Load anyway"
  const fileRef = useRef(null)

  // Status is recomputed from the phone's own date; refresh it when the app comes back to the foreground.
  useEffect(() => {
    const on = () => { if (document.visibilityState === 'visible') setToday(todayIso()) }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const pick = useCallback(() => { if (fileRef.current) fileRef.current.click() }, [])
  const tryApply = useCallback((text, fileName, allowOlder) => {
    const r = applyPlanText(text, { fileName, current: stored, allowOlder })
    if (!r.ok) {
      pending.current = r.canOverride ? { text, fileName } : null
      setError(r)
      setSheet(false)
      return
    }
    pending.current = null
    setError(null)
    setStored(r.state)
    setOpenId(null)
    setSheet(false)
    setToday(todayIso())
    const items = r.state.plan.trips.reduce((s, t) => s + t.items.length, 0)
    setToast(`Plan loaded: ${r.state.plan.trips.length} trips, ${items} items`)
  }, [stored])

  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    let text = ''
    try { text = await f.text() } catch { text = '' }
    tryApply(text, f.name, false)
  }
  const onForce = () => { if (pending.current) tryApply(pending.current.text, pending.current.fileName, true) }
  const onClear = () => {
    clearStored()
    setStored(null); setConfirm(false); setSheet(false); setOpenId(null); setError(null); setTab('trips')
    setToast('Data cleared')
  }
  const onCopied = (code) => setToast(`Booking ref ${code} copied`)

  const plan = stored && stored.plan
  const trip = plan && openId ? plan.trips.find((t) => t.id === openId) : null
  const stale = plan ? isStale(plan) : false
  const goTab = (t) => { setTab(t); setOpenId(null) }

  let body
  if (!plan) {
    body = (
      <>
        <div className="hd"><div className="tt"><div><h1>{tab === 'year' ? 'Year' : 'Trips'}</h1><p className="sub">No plan loaded</p></div><ViewOnly /></div>{error && <ErrorBanner error={error} hasPlan={false} onRetry={pick} onDismiss={() => setError(null)} onForce={onForce} />}</div>
        <FirstRun onLoad={pick} />
      </>
    )
  } else if (trip) {
    body = <Detail key={trip.id} trip={trip} today={today} loadedAt={stored.loaded_at} onBack={() => setOpenId(null)} onCopied={onCopied} />
  } else if (tab === 'year') {
    body = (
      <>
        <YearHeader trips={plan.trips} year={year} setYear={setYear} today={today} />
        {stale && <div style={{ padding: '0 16px 10px' }}><StaleChip plan={plan} /></div>}
        {error && <ErrorBanner error={error} hasPlan onRetry={pick} onDismiss={() => setError(null)} onForce={onForce} />}
        <Year trips={plan.trips} year={year} today={today} onOpen={setOpenId} />
      </>
    )
  } else {
    body = (
      <>
        <div className="hd">
          <div className="tt">
            <div><h1>Trips</h1>{!stale && <p className="sub">Plan loaded {fmtStamp(stored.loaded_at)}</p>}</div>
            <div className="hrow"><ViewOnly /><button type="button" className="ibtn" aria-label="Load plan" onClick={pick}><FileUp size={22} className="ic" aria-hidden="true" /></button></div>
          </div>
          {stale && <div style={{ padding: '0 16px 10px', marginTop: -6 }}><StaleChip plan={plan} /></div>}
          {error && <ErrorBanner error={error} hasPlan onRetry={pick} onDismiss={() => setError(null)} onForce={onForce} />}
          {stale && <StaleBanner plan={plan} loadedAt={stored.loaded_at} onLoad={pick} />}
        </div>
        <Trips plan={plan} today={today} onOpen={setOpenId} onCopied={onCopied} />
      </>
    )
  }

  return (
    <div className="app">
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} aria-label="Plan file" />
      <div className="main">{body}</div>
      <nav className="tabbar" aria-label="Main">
        <button type="button" className={`tab${!sheet && tab === 'trips' ? ' on' : ''}`} aria-current={!sheet && tab === 'trips' ? 'page' : undefined} onClick={() => goTab('trips')}>
          <span className="pill"><List size={22} className="ic" aria-hidden="true" /></span>Trips
        </button>
        <button type="button" className={`tab${!sheet && tab === 'year' ? ' on' : ''}`} aria-current={!sheet && tab === 'year' ? 'page' : undefined} onClick={() => goTab('year')}>
          <span className="pill"><CalendarRange size={22} className="ic" aria-hidden="true" /></span>Year
        </button>
        <button type="button" className={`tab${sheet ? ' on' : ''}`} onClick={() => setSheet(true)}>
          <span className="pill"><Info size={22} className="ic" aria-hidden="true" /></span>About
        </button>
      </nav>
      {sheet && !confirm && <AboutSheet stored={stored} onLoad={pick} onClear={() => setConfirm(true)} onClose={() => setSheet(false)} />}
      {confirm && <ConfirmClear onCancel={() => setConfirm(false)} onConfirm={onClear} />}
      {toast && <div className="toast" role="status"><Check size={18} className="ic" aria-hidden="true" />{toast}</div>}
    </div>
  )
}
