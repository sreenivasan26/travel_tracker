import React from 'react'
import {
  Plane, CalendarClock, Play, Check, Ban, Train, Bus, Car, BedDouble, Ticket, MapPin, Ellipsis, Briefcase, User, Copy, Eye,
} from 'lucide-react'
import { fmtTime, fmtMoney, stayUntil, fmtShort, routeText, timesText, nextTravelText } from './lib/travel.js'

export const STATUS = {
  upcoming: { cls: 's-up', label: 'Upcoming', Icon: CalendarClock },
  ongoing: { cls: 's-on', label: 'Ongoing', Icon: Play },
  done: { cls: 's-done', label: 'Done', Icon: Check },
  cancelled: { cls: 's-can', label: 'Cancelled', Icon: Ban },
}
export const KIND_ICON = { flight: Plane, train: Train, bus: Bus, cab: Car, car: Car, stay: BedDouble, activity: Ticket, place: MapPin, other: Ellipsis }
export const KIND_LABEL = { flight: 'Flight', train: 'Train', bus: 'Bus', cab: 'Cab', car: 'Car (own)', stay: 'Stay', activity: 'Activity', place: 'Place', other: 'Other' }

export function StatusChip({ status }) {
  const s = STATUS[status]
  return <span className={`stchip ${s.cls}`}><s.Icon size={13} className="ic" aria-hidden="true" />{s.label}</span>
}
export function PurposeChip({ purpose }) {
  const work = purpose === 'work'
  const I = work ? Briefcase : User
  return <span className={`pchip${work ? ' w' : ''}`}><I size={12} className="ic" aria-hidden="true" />{work ? 'Work' : 'Personal'}</span>
}
export function ViewOnly() {
  return <span className="vo"><Eye size={13} className="ic" aria-hidden="true" /> View only</span>
}
export function KindIcon({ kind, size = 18 }) {
  const I = KIND_ICON[kind] || Ellipsis
  return <span className="kt" title={KIND_LABEL[kind] || 'Other'}><I size={size} className="ic" aria-hidden="true" /><span className="sr">{KIND_LABEL[kind] || 'Other'}</span></span>
}
// A state glyph, not a control: no button role, no 44 px target.
export function Tick({ done }) {
  return done
    ? <span className="tick done" role="img" aria-label="Done on the web"><Check size={14} className="ic" strokeWidth={3} aria-hidden="true" /></span>
    : <span className="tick todo" role="img" aria-label="Not done" />
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

export function Ref({ code, onCopied }) {
  return (
    <button type="button" className="ref" aria-label={`Copy booking ref ${code}`} onClick={async () => { if (await copyText(code)) onCopied(code) }}>
      <code>{code}<Copy size={13} className="ic" aria-hidden="true" /></code>
    </button>
  )
}

// One read-only itinerary row.
export function ItemRow({ item, last, onCopied, showTick = true }) {
  const until = stayUntil(item)
  const parts = []
  const route = routeText(item), tline = timesText(item), nxt = nextTravelText(item)
  if (item.time != null && !tline) parts.push(<span key="t" className="t">{fmtTime(item.time)}</span>)
  const where = [item.place, until ? `until ${fmtShort(until)}` : ''].filter(Boolean).join(' · ')
  return (
    <div className={`it${last ? ' last' : ''}`}>
      <Tick done={item.done} />
      <KindIcon kind={item.kind} />
      <div className="tx">
        <b>{item.title}</b>
        {(parts.length > 0 || where) && <small>{parts}{parts.length > 0 && where ? ' · ' : ''}{where}</small>}
        {route && <small className="route">{route}</small>}
        {tline && <small><span className="t">{tline}</span></small>}
        {nxt && <small className="nxt">{nxt}</small>}
        {item.booking_ref && <Ref code={item.booking_ref} onCopied={onCopied} />}
      </div>
      <span className="cost">{item.cost != null && item.cost > 0 ? fmtMoney(item.cost) : ''}</span>
    </div>
  )
}

export function PurposeIconOnly({ purpose }) {
  const work = purpose === 'work'
  const I = work ? Briefcase : User
  return <span style={{ color: 'var(--color-text-muted)', display: 'inline-flex' }} role="img" aria-label={work ? 'Work' : 'Personal'}><I size={14} className="ic" /></span>
}
