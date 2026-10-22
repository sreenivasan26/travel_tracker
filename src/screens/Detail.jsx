import React, { useRef, useState } from 'react'
import { ChevronLeft, Info } from 'lucide-react'
import {
  tripStatus, fmtRange, nightsOf, startsInDays, dayProgress, itemPct, budgetFigures, groupItinerary, splitPlaces, fmtDay, fmtShort, fmtTime, fmtMoney,
  datedCount, undatedCount, fmtStamp, diffDays,
} from '../lib/travel.js'
import { StatusChip, PurposeChip, ViewOnly, ItemRow, Tick, KindIcon } from '../ui.jsx'

const SECTIONS = [['budget', 'Budget'], ['itinerary', 'Itinerary'], ['places', 'Places'], ['spend', 'Spend']]

function BudgetCard({ trip, loadedAt }) {
  const b = budgetFigures(trip)
  const pct = (v) => `${Math.min(100, Math.max(0, (v / b.scaleMax) * 100))}%`
  const tick = b.hasBudget ? pct(b.budget) : null
  const row = (label, value, fill, marker) => (
    <div className="brow">
      <label>{label}</label>
      <div className="bbar" aria-hidden="true"><i style={{ '--f': fill, width: pct(value) }} />{marker && tick && <u style={{ '--tk': tick }} />}</div>
      <b>{fmtMoney(value)}</b>
    </div>
  )
  return (
    <div className="card">
      <div className="asof">Figures as of plan load, {fmtStamp(loadedAt)}</div>
      {b.hasBudget ? row('Budget', b.budget, 'var(--color-border-control)', false) : <div className="mut" style={{ marginBottom: 6 }}>No budget set for this trip.</div>}
      {row('Planned', b.planned, 'var(--color-chart-cat-2)', true)}
      {row('Actual', b.actual, 'var(--color-chart-cat-5)', true)}
      <div className="legd">
        <span><b>Budget:</b> the cap you set for this trip</span>
        <span><b>Planned:</b> sum of the itinerary item costs</span>
        <span><b>Actual:</b> Finance expenses tagged to this trip</span>
      </div>
      <div className="leftr">
        <span>Actual vs planned <small>(actual − planned)</small></span>
        <b>{fmtMoney(b.actualVsPlanned)}</b>
      </div>
      {b.hasBudget && (
        <>
          <div className="mut s" style={{ marginTop: 6 }}>
            {b.plannedVsBudget >= 0 ? `Planned ${fmtMoney(b.plannedVsBudget)} under budget` : `Planned ${fmtMoney(-b.plannedVsBudget)} over budget`}
            {b.actualPct != null && ` · Actual is ${b.actualPct}% of budget`}
          </div>
          <div className="leftr">
            <span>Left to spend <small>(budget − actual)</small></span>
            <b className={b.over > 0 ? 'over' : undefined}>{fmtMoney(b.left)}</b>
          </div>
          {b.over > 0 && <div className="over" style={{ marginTop: 4, fontSize: 'var(--text-sm)' }}>Over budget by {fmtMoney(b.over)}</div>}
        </>
      )}
    </div>
  )
}

export default function Detail({ trip, today, loadedAt, onBack, onCopied }) {
  const scrollRef = useRef(null)
  const [cur, setCur] = useState('budget')
  const status = tripStatus(trip, today)
  const n = nightsOf(trip)
  const groups = groupItinerary(trip)
  const places = splitPlaces(trip)
  const spendTotal = trip.spend.reduce((s, x) => s + x.amount, 0)
  const unscheduled = trip.items.filter((i) => !i.date && i.kind !== 'place')
  const jump = (id) => {
    setCur(id)
    const el = scrollRef.current && scrollRef.current.querySelector(`#${id}`)
    if (el) scrollRef.current.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' })
  }
  let when = ''
  if (status === 'upcoming') when = ` · starts in ${startsInDays(trip, today)} days`
  if (status === 'ongoing') { const d = dayProgress(trip, today); when = ` · day ${d.day} of ${d.total}` }
  return (
    <>
      <div className="hd">
        <div className="sa-head">
          <button type="button" className="bk" onClick={onBack}><ChevronLeft size={24} className="ic" aria-hidden="true" /> Trips</button>
          <ViewOnly />
        </div>
      </div>
      <div className="scr" ref={scrollRef}>
        <div className="inner">
          <div className="dh1">
            <h1>{trip.name}</h1>
            <div className="chips"><StatusChip status={status} /><PurposeChip purpose={trip.purpose} /></div>
            <div className="facts">
              <span><b>{fmtRange(trip.start_date, trip.end_date)}</b> · {n} {n === 1 ? 'night' : 'nights'}{when}</span>
              {trip.destination && <span>{trip.destination}</span>}
            </div>
            {trip.notes && <div className="nt">{trip.notes}</div>}
            {trip.items_total > 0 && (
              <>
                <div className="mut" style={{ marginTop: 12 }}><b style={{ color: 'var(--color-text)' }}>{trip.items_done} of {trip.items_total}</b> items done <span className="mut s">· {itemPct(trip)}%</span></div>
                <div className="prog" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={itemPct(trip)} aria-label="Items done on the web"><i style={{ width: `${itemPct(trip)}%` }} /></div>
              </>
            )}
          </div>

          <div className="sech" id="budget"><h2>Budget</h2></div>
          <BudgetCard trip={trip} loadedAt={loadedAt} />

          <div className="sech" id="itinerary"><h2>Itinerary</h2><span>{datedCount(trip)} dated {datedCount(trip) === 1 ? 'item' : 'items'}</span></div>
          <div className="rolegend" aria-label="Legend">
            <span><Tick done /> done on the web</span><span><Tick done={false} /> not done</span><span>Read-only</span>
          </div>
          {groups.length === 0 && <div className="mut" style={{ padding: '8px 0' }}>No dated items.</div>}
          {groups.map((g) => (
            <div key={g.date}>
              <div className={`dayh${g.outside ? ' out' : ''}`}>
                {g.outside
                  ? <b>{fmtDay(g.date)} <span className="outchip">Outside trip dates</span></b>
                  : <b>{fmtDay(g.date)}<small>Day {g.day}</small>{g.date === today && <span className="todaylbl">Today</span>}</b>}
                <span>{g.items.length} {g.items.length === 1 ? 'item' : 'items'}{g.cost > 0 ? ` · ${fmtMoney(g.cost)}` : ''}</span>
              </div>
              {g.stays.map((s) => <div key={s.title} className="stay">Staying: {s.title} · night {s.night} of {s.nights}</div>)}
              {g.items.map((it, i) => <ItemRow key={it.id} item={it} last={i === g.items.length - 1} onCopied={onCopied} />)}
            </div>
          ))}
          {unscheduled.length > 0 && (
            <div>
              <div className="dayh"><b>No date</b><span>{unscheduled.length} {unscheduled.length === 1 ? 'item' : 'items'}</span></div>
              {unscheduled.map((it, i) => <ItemRow key={it.id} item={it} last={i === unscheduled.length - 1} onCopied={onCopied} />)}
            </div>
          )}
          {places.undated.length > 0 && (
            <div className="note"><Info size={14} className="ic" aria-hidden="true" /><span>{places.undated.length} {places.undated.length === 1 ? 'place has' : 'places have'} no date yet. {places.undated.length === 1 ? 'It is' : 'They are'} under Places to visit.</span></div>
          )}

          <div className="sech" id="places"><h2>Places to visit</h2><span>{places.dated.length} dated · {places.undated.length} undated</span></div>
          {places.dated.length === 0 && places.undated.length === 0 && <div className="mut" style={{ padding: '8px 0' }}>No places yet.</div>}
          {places.dated.map((p, i) => (
            <div key={p.id} className={`pl${i === places.dated.length - 1 ? ' last' : ''}`}>
              <div className="l"><KindIcon kind="place" size={16} /><div className="tx"><b>{p.title}</b>{p.place && <small>{p.place}</small>}</div></div>
              <span className="when">{fmtShort(p.date)}{p.time != null ? ` · ${fmtTime(p.time)}` : ''}</span>
            </div>
          ))}
          {places.undated.length > 0 && (
            <>
              <div className="cap">Wish list · no date yet<span className="n">{places.undated.length}</span></div>
              {places.undated.map((p, i) => (
                <div key={p.id} className={`pl undated${i === places.undated.length - 1 ? ' last' : ''}`}>
                  <div className="l"><KindIcon kind="place" size={16} /><div className="tx"><b>{p.title}</b>{p.place && <small>{p.place}</small>}</div></div>
                  <span className="when">No date</span>
                </div>
              ))}
            </>
          )}

          <div className="sech" id="spend"><h2>Linked spend</h2><span>{trip.spend.length} {trip.spend.length === 1 ? 'entry' : 'entries'} · expenses only</span></div>
          {trip.spend.length === 0 && <div className="mut" style={{ padding: '8px 0' }}>No Finance expenses are tagged to this trip.</div>}
          {trip.spend.map((s, i) => (
            <div key={i} className="sp">
              <b>{s.spend_name}</b><span className="a">{fmtMoney(s.amount, 2)}</span>
              <small>{[s.date ? fmtShort(s.date) : '', s.category, s.mode].filter(Boolean).join(' · ')}</small>
            </div>
          ))}
          {trip.spend.length > 0 && <div className="tot"><span>Total (Actual)</span><span>{fmtMoney(spendTotal, 2)}</span></div>}
          <div className="note"><Info size={14} className="ic" aria-hidden="true" /><span>Tagging and unlinking Finance entries is done on the web. This list is a copy as of the plan.</span></div>
        </div>
      </div>
      <nav className="jumpbar" aria-label="Sections">
        {SECTIONS.map(([id, label]) => <button key={id} type="button" className={cur === id ? 'on' : ''} onClick={() => jump(id)}>{label}</button>)}
      </nav>
    </>
  )
}
