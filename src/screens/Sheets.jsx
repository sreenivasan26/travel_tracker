import React from 'react'
import { FileUp, Trash2, TriangleAlert, CircleX, Clock } from 'lucide-react'
import { fmtStamp, fmtGenerated, ageLabel } from '../lib/travel.js'

export function AboutSheet({ stored, onLoad, onClear, onClose }) {
  const plan = stored && stored.plan
  const items = plan ? plan.trips.reduce((s, t) => s + t.items.length, 0) : 0
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="About and plan">
        <div className="grab" />
        <h2>About and plan</h2>
        <p className="mut" style={{ margin: '2px 0 0' }}>Travel is a read-only view of the trips you keep on the Notes and Tasks website. Nothing is entered here and nothing is sent back.</p>
        <dl className="kv">
          {plan ? (
            <>
              <dt>Plan loaded</dt><dd>{fmtStamp(stored.loaded_at)}</dd>
              <dt>Made on the web</dt><dd>{fmtGenerated(plan.generated_at)}</dd>
              <dt>File</dt><dd>{stored.file_name}</dd>
              <dt>Contents</dt><dd>{plan.trips.length} trips, {items} items</dd>
            </>
          ) : (
            <><dt>Plan</dt><dd>No plan loaded</dd></>
          )}
        </dl>
        <button type="button" className="btn pri" onClick={onLoad}><FileUp size={20} className="ic" aria-hidden="true" /> Load plan</button>
        {plan && (
          <>
            <hr />
            <button type="button" className="btn dng" onClick={onClear}><Trash2 size={20} className="ic" aria-hidden="true" /> Clear data</button>
          </>
        )}
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </div>
    </>
  )
}

export function ConfirmClear({ onCancel, onConfirm }) {
  return (
    <>
      <div className="scrim" onClick={onCancel} />
      <div className="dlg" role="alertdialog" aria-modal="true" aria-label="Clear data">
        <h2>Clear data?</h2>
        <p>This removes the plan from this phone. The website is not touched. You can load the plan again any time.</p>
        <button type="button" className="btn dng solid" onClick={onConfirm}><Trash2 size={20} className="ic" aria-hidden="true" /> Clear data</button>
        <button type="button" className="btn" style={{ marginBottom: 0 }} onClick={onCancel}>Cancel</button>
      </div>
    </>
  )
}

export function StaleBanner({ plan, loadedAt, onLoad }) {
  return (
    <div className="ban warn" role="status">
      <TriangleAlert size={20} className="ic" aria-hidden="true" />
      <div>
        <b>This plan is out of date</b>
        <span>It was made on the web {fmtGenerated(plan.generated_at)} ({ageLabel(plan)}). Trips shown here may have changed, and ticks and money are as of then. Dates and status are still worked out from today.</span>
      </div>
      <div className="act"><button type="button" className="btn" onClick={onLoad}><FileUp size={18} className="ic" aria-hidden="true" /> Load newer plan</button></div>
    </div>
  )
}

export function StaleChip({ plan }) {
  return <span className="stale-chip"><Clock size={13} className="ic" aria-hidden="true" /> Made on the web {fmtGenerated(plan.generated_at)} · {ageLabel(plan)}</span>
}

export function ErrorBanner({ error, hasPlan, onRetry, onDismiss, onForce }) {
  return (
    <div className="ban bad" role="alert">
      <CircleX size={20} className="ic" aria-hidden="true" />
      <div>
        <b>{error.title}</b>
        <span>{error.detail}</span>
      </div>
      <div className="act">
        {error.canOverride ? (
          <>
            <button type="button" className="btn" onClick={onDismiss}>Keep current plan</button>
            <button type="button" className="btn dng" onClick={onForce}>Load anyway</button>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={onRetry}><FileUp size={18} className="ic" aria-hidden="true" /> Pick another file</button>
            <button type="button" className="btn" onClick={onDismiss}>{hasPlan ? 'Keep current plan' : 'Close'}</button>
          </>
        )}
      </div>
    </div>
  )
}
