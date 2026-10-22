import React, { useState } from 'react'
import { ChevronRight, FileUp, Plane } from 'lucide-react'
import {
  groupTrips, pastByYear, fmtRange, nightsOf, dayProgress, todaysItems, nextItem, fmtDay, fmtTime, fmtMoney, budgetFigures, itemPct, startsInDays,
} from '../lib/travel.js'
import { StatusChip, PurposeChip, ItemRow } from '../ui.jsx'

export function FirstRun({ onLoad }) {
  return (
    <>
      <div className="scr"><div className="inner">
        <div className="empty1">
          <div className="big-ic"><Plane size={40} className="ic" aria-hidden="true" /></div>
          <h1>No trips yet</h1>
          <p>This app only shows the trips you entered on the Notes and Tasks website. Nothing is entered here, and nothing is sent back.</p>
        </div>
        <div className="exp">
          <div className="cap" style={{ marginTop: 0 }}>What Load plan expects</div>
          <ol>
            <li><span>A file named <code>travel-plan.json</code> that the website writes to its <code>outbox</code> folder in OneDrive.</span></li>
            <li><span>Tap <b>Load plan</b> and pick it in Files: <code>OneDrive › outbox › travel-plan.json</code>.</span></li>
            <li><span>Load it again whenever you change trips on the web.</span></li>
          </ol>
        </div>
      </div></div>
      <div className="cta"><button type="button" className="btn pri" onClick={onLoad}><FileUp size={20} className="ic" aria-hidden="true" /> Load plan</button></div>
    </>
  )
}

function money(trip) {
  const b = budgetFigures(trip)
  if (b.hasBudget) {
    return (
      <>
        <b>{fmtMoney(b.actual)}</b> of {fmtMoney(b.budget)} <span className="mut s">as of plan load</span>
        {b.over > 0 && <div className="over">Over budget by {fmtMoney(b.over)}</div>}
      </>
    )
  }
  return <><b>{fmtMoney(b.actual)}</b> spent <span className="mut s">as of plan load</span></>
}

function Progress({ trip }) {
  if (trip.items_total <= 0) return null
  return (
    <>
      <div className="meta"><b>{trip.items_done} of {trip.items_total}</b> items done</div>
      <div className="prog" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={itemPct(trip)} aria-label="Items done on the web"><i style={{ width: `${itemPct(trip)}%` }} /></div>
    </>
  )
}

function NowCard({ trip, today, onOpen, onCopied }) {
  const dp = dayProgress(trip, today)
  const items = todaysItems(trip, today)
  return (
    <article className="trip now" aria-label={`${trip.name}, ongoing`}>
      <div>
        <h2 className="nm" style={{ marginTop: 0 }}>{trip.name}</h2>
        <div className="chips"><StatusChip status="ongoing" /><PurposeChip purpose={trip.purpose} /></div>
      </div>
      <div className="meta"><b>{fmtRange(trip.start_date, trip.end_date)}</b> · Day {dp.day} of {dp.total}</div>
      <div className="meta">{money(trip)}</div>
      <Progress trip={trip} />
      <div className="today">
        <div className="th"><span>Today</span><span>{fmtDay(today)}</span></div>
        {items.length === 0 && <div className="mut" style={{ padding: '6px 0' }}>Nothing planned for today.</div>}
        {items.map((it, i) => <ItemRow key={it.id} item={it} last={i === items.length - 1} onCopied={onCopied} />)}
      </div>
      <button type="button" className="openrow" onClick={() => onOpen(trip.id)}>Open trip <ChevronRight size={20} className="ic" aria-hidden="true" /></button>
    </article>
  )
}

function TripCard({ trip, status, today, onOpen }) {
  const nx = status === 'upcoming' ? nextItem(trip, today) : null
  return (
    <button type="button" className="trip" onClick={() => onOpen(trip.id)} aria-label={`${trip.name}, ${status}, ${fmtRange(trip.start_date, trip.end_date)}`}>
      <h2 className="nm">{trip.name}</h2>
      <div className="chips"><StatusChip status={status} /><PurposeChip purpose={trip.purpose} /></div>
      <div className="meta">
        <b>{fmtRange(trip.start_date, trip.end_date)}</b> · {nightsOf(trip)} {nightsOf(trip) === 1 ? 'night' : 'nights'}
        {status === 'upcoming' && ` · starts in ${startsInDays(trip, today)} days`}
      </div>
      {trip.destination && <div className="meta" style={{ marginTop: 2 }}>{trip.destination}</div>}
      {nx && <div className="meta">Next: <b>{fmtDay(nx.date)}{nx.time != null ? `, ${fmtTime(nx.time)}` : ''}</b> {nx.title}</div>}
      <div className="meta">{money(trip)}</div>
      <Progress trip={trip} />
      <ChevronRight size={22} className="ic go" aria-hidden="true" />
    </button>
  )
}

export default function Trips({ plan, today, onOpen, onCopied }) {
  const [showAllPast, setShowAllPast] = useState(false)
  const g = groupTrips(plan.trips, today)
  const pastShown = showAllPast ? g.past : g.past.slice(0, 3)
  const hidden = g.past.length - pastShown.length
  if (plan.trips.length === 0) {
    return <div className="scr"><div className="inner"><div className="empty1"><h1>No trips in this plan</h1><p>Add a trip on the website, then load the plan again.</p></div></div></div>
  }
  return (
    <div className="scr"><div className="inner">
      {g.ongoing.length > 0 && <div className="cap" style={{ marginTop: 6 }}>Ongoing</div>}
      {g.ongoing.map((t) => <NowCard key={t.id} trip={t} today={today} onOpen={onOpen} onCopied={onCopied} />)}
      {g.upcoming.length > 0 && <div className="cap" style={g.ongoing.length ? undefined : { marginTop: 6 }}>Upcoming<span className="n">{g.upcoming.length}</span></div>}
      {g.upcoming.map((t) => <TripCard key={t.id} trip={t} status="upcoming" today={today} onOpen={onOpen} />)}
      {g.past.length > 0 && <div className="cap">Past<span className="n">{g.past.length}</span></div>}
      {pastByYear(pastShown).map((grp, i, arr) => (
        <React.Fragment key={grp.year}>
          {(arr.length > 1 || new Set(g.past.map((t) => t.start_date.slice(0, 4))).size > 1) && <div className="cap" style={{ marginTop: 4 }}>{grp.year}</div>}
          {grp.trips.map((t) => <TripCard key={t.id} trip={t} status="done" today={today} onOpen={onOpen} />)}
        </React.Fragment>
      ))}
      {hidden > 0 && <button type="button" className="moreb" onClick={() => setShowAllPast(true)}>Show {hidden} more</button>}
      {showAllPast && g.past.length > 3 && <button type="button" className="moreb" onClick={() => setShowAllPast(false)}>Show fewer</button>}
      {g.cancelled.length > 0 && <div className="cap">Cancelled<span className="n">{g.cancelled.length}</span></div>}
      {g.cancelled.map((t) => <TripCard key={t.id} trip={t} status="cancelled" today={today} onOpen={onOpen} />)}
    </div></div>
  )
}
