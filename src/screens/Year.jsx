import React from 'react'
import { ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'
import { yearRows, yearSummary, yearList, fmtRangeShort, nightsOf, fmtMoney, fmtRange } from '../lib/travel.js'
import { STATUS, PurposeIconOnly, ViewOnly } from '../ui.jsx'

export function YearHeader({ trips, year, setYear, today }) {
  const years = yearList(trips, today)
  const lo = years[0], hi = years[years.length - 1]
  const s = yearSummary(trips, year, today)
  return (
    <div className="hd">
      <div className="tt">
        <div className="yr">
          <button type="button" className="ibtn plain" aria-label="Previous year" disabled={year <= lo} style={year <= lo ? { opacity: 0.35 } : undefined} onClick={() => setYear(year - 1)}><ChevronLeft size={22} className="ic" aria-hidden="true" /></button>
          <h1>{year}</h1>
          <button type="button" className="ibtn plain" aria-label="Next year" disabled={year >= hi} style={year >= hi ? { opacity: 0.35 } : undefined} onClick={() => setYear(year + 1)}><ChevronRight size={22} className="ic" aria-hidden="true" /></button>
        </div>
        <ViewOnly />
      </div>
      <div className="sumline">
        <span><b>{s.trips}</b> {s.trips === 1 ? 'trip' : 'trips'}</span>
        <span><b>{s.nights}</b> nights</span>
        <span><b>{fmtMoney(s.spend)}</b> spent</span>
      </div>
    </div>
  )
}

export default function Year({ trips, year, today, onOpen }) {
  const rows = yearRows(trips, year, today)
  return (
    <div className="scr"><div className="inner">
      {rows.map((r) => {
        if (r.empty) {
          return <div key={r.month} className={`mrow empty${r.current ? ' cur' : ''}`}><span className="m">{r.label}</span><span className="none">No trips{r.current ? ' · this month' : ''}</span></div>
        }
        return (
          <div key={r.month} className={`mrow${r.current ? ' cur' : ''}`}>
            <span className="m">{r.label}</span>
            <div className="mcol">
              {r.chips.map((c) => {
                const st = STATUS[c.status]
                const t = c.trip
                const n = nightsOf(t)
                const showToday = r.todayPct != null
                return (
                  <div key={t.id}>
                    <button type="button" className={`mchip ${st.cls}`} onClick={() => onOpen(t.id)} aria-label={`${t.name}, ${st.label}, ${t.purpose}, ${fmtRange(t.start_date, t.end_date)}`}>
                      <span className="si"><st.Icon size={16} className="ic" aria-hidden="true" /></span>
                      <span style={{ minWidth: 0 }}>
                        <b><span>{t.name}</span><PurposeIconOnly purpose={t.purpose} /></b>
                        <small>{c.continues || t.start_date.slice(0, 7) !== t.end_date.slice(0, 7) ? fmtRange(t.start_date, t.end_date) : fmtRangeShort(t.start_date, t.end_date)} · {n} {n === 1 ? 'night' : 'nights'}{c.continues ? ` · continues in ${c.continuesIn}` : ''}</small>
                      </span>
                      <ChevronRight size={18} className="ic" aria-hidden="true" />
                    </button>
                    <div className={`mtrack ${st.cls}${showToday ? ' td' : ''}${r.todayPct > 70 ? ' rt' : ''}`} aria-hidden="true">
                      <i style={{ left: `${c.leftPct}%`, width: `${c.widthPct}%` }} />
                      {showToday && <u style={{ left: `${r.todayPct}%` }} />}
                    </div>
                  </div>
                )
              })}
              {r.links.map((l) => (
                <button key={l.trip.id} type="button" className="mlink" onClick={() => onOpen(l.trip.id)}>
                  <ChevronsRight size={14} className="ic" aria-hidden="true" /> {l.trip.name} continues from {fmtRangeShort(l.trip.start_date, l.trip.end_date)}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div></div>
  )
}
