import { useState } from 'react'
import { productKey, type GroupedOffer } from '../lib/offers'
import { subscribeToPush, PushError } from '../lib/push'

// Basis-URL der Alarm-API (Cloudflare Worker). Lokal: wrangler dev auf :8787.
// Produktion: via VITE_API_BASE auf die deployte Worker-URL setzen.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787'

type Channel = 'email' | 'telegram' | 'push'
type Metric = 'unit' | 'liter'

type State =
  | { kind: 'idle' }
  | { kind: 'open'; channel: Channel }
  | { kind: 'submitting'; channel: Channel }
  | { kind: 'pending'; message: string }
  | { kind: 'done'; message: string }
  | { kind: 'error'; channel: Channel; message: string }

interface SubscribeResponse {
  status?: string
  message?: string
  telegramLink?: string
  error?: string
}

const BellIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function AlarmButton({ offer }: { offer: GroupedOffer }) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [email, setEmail] = useState('')
  // Preiswecker (Pro)
  const [weckerOn, setWeckerOn] = useState(false)
  const [targetPrice, setTargetPrice] = useState('')
  const [targetMetric, setTargetMetric] = useState<Metric>('unit')
  // Pro-Code einlösen
  const [showRedeem, setShowRedeem] = useState(false)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null)

  const label = `${offer.brand} ${offer.title} (${offer.market})`
  const channel: Channel = state.kind === 'open' || state.kind === 'submitting' || state.kind === 'error' ? state.channel : 'email'

  async function subscribe(ch: Channel) {
    setState({ kind: 'submitting', channel: ch })
    try {
      let extra: Record<string, unknown> = {}
      if (ch === 'email') {
        extra = { email }
        if (weckerOn && targetPrice) extra = { ...extra, targetPrice, targetMetric }
      }
      if (ch === 'push') {
        try {
          extra = { subscription: await subscribeToPush() }
        } catch (err) {
          setState({ kind: 'error', channel: ch, message: err instanceof PushError ? err.message : 'Push-Anmeldung fehlgeschlagen.' })
          return
        }
      }
      const res = await fetch(`${API_BASE}/api/subscribe`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel: ch, ...extra, productKey: productKey(offer), productLabel: label }),
      })
      const data = (await res.json()) as SubscribeResponse
      if (!res.ok) {
        if (data.error === 'pro_required') setShowRedeem(true) // Code-Einlösen anbieten
        setState({ kind: 'error', channel: ch, message: data.message ?? 'Das hat nicht geklappt. Bitte später erneut versuchen.' })
        return
      }
      if (ch === 'telegram' && data.telegramLink) {
        window.open(data.telegramLink, '_blank', 'noopener')
        setState({ kind: 'pending', message: data.message ?? 'Öffne Telegram und tippe auf „Start“.' })
      } else if (data.status === 'confirmed') {
        setState({ kind: 'done', message: data.message ?? 'Alarm bereits aktiv.' })
      } else {
        setState({ kind: 'pending', message: data.message ?? 'Bitte bestätige den Link in deiner E-Mail.' })
      }
    } catch {
      setState({ kind: 'error', channel: ch, message: 'Keine Verbindung zum Alarm-Dienst.' })
    }
  }

  async function redeem() {
    if (!email) {
      setRedeemMsg('Bitte trage oben zuerst deine E-Mail ein.')
      return
    }
    setRedeemMsg('…')
    try {
      const res = await fetch(`${API_BASE}/api/redeem`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: redeemCode, email }),
      })
      const data = (await res.json()) as { message?: string }
      if (res.ok) {
        setRedeemMsg('✅ ' + (data.message ?? 'Pro freigeschaltet.'))
        setShowRedeem(false)
      } else {
        setRedeemMsg(data.message ?? 'Code ungültig.')
      }
    } catch {
      setRedeemMsg('Keine Verbindung zum Alarm-Dienst.')
    }
  }

  // Abgeschlossene Zustände: nur noch eine Statuszeile.
  if (state.kind === 'pending' || state.kind === 'done') {
    return (
      <p
        className={`relative z-10 mt-3 flex items-start gap-1.5 text-[0.76rem] ${
          state.kind === 'pending' ? 'text-accent-strong' : 'text-good'
        }`}
        role="status"
      >
        <span aria-hidden="true">{state.kind === 'pending' ? '✉️' : '✅'}</span>
        {state.message}
      </p>
    )
  }

  if (state.kind === 'idle') {
    return (
      <button
        type="button"
        // z-10 hebt den Button über das Stretched-Link-Overlay der Karte.
        className="relative z-10 mt-3 self-start inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-muted hover:text-accent-strong cursor-pointer"
        onClick={(e) => {
          e.stopPropagation()
          setState({ kind: 'open', channel: 'email' })
        }}
      >
        <BellIcon />
        Bei Bestpreis benachrichtigen
      </button>
    )
  }

  const submitting = state.kind === 'submitting'
  const seg = (active: boolean) =>
    `flex-1 h-8 text-[0.78rem] font-semibold rounded-md cursor-pointer border ${
      active ? 'bg-accent text-white border-accent' : 'bg-surface text-muted border-border-strong hover:text-ink'
    }`
  const unit = targetMetric === 'liter' ? '€/L' : '€/Dose'

  return (
    <div className="relative z-10 mt-3 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
      <span className="flex items-center gap-1.5 text-[0.76rem] font-semibold text-muted">
        <BellIcon />
        Bestpreis-Alarm für {offer.brand}
      </span>

      <div className="flex gap-1.5" role="group" aria-label="Benachrichtigungskanal">
        <button type="button" className={seg(channel === 'email')} aria-pressed={channel === 'email'} disabled={submitting} onClick={() => setState({ kind: 'open', channel: 'email' })}>
          E-Mail
        </button>
        <button type="button" className={seg(channel === 'telegram')} aria-pressed={channel === 'telegram'} disabled={submitting} onClick={() => setState({ kind: 'open', channel: 'telegram' })}>
          Telegram
        </button>
        <button type="button" className={seg(channel === 'push')} aria-pressed={channel === 'push'} disabled={submitting} onClick={() => setState({ kind: 'open', channel: 'push' })}>
          Push
        </button>
      </div>

      {channel === 'email' && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            subscribe('email')
          }}
        >
          <div className="flex gap-1.5">
            <input
              id={`alarm-${offer.id}`}
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="deine@email.de"
              className="flex-1 min-w-0 h-9 px-2.5 text-[0.82rem] bg-surface text-ink border border-border-strong rounded-lg outline-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="flex-none h-9 px-3 text-[0.82rem] font-semibold text-white bg-accent border border-accent rounded-lg cursor-pointer hover:bg-accent-strong disabled:opacity-60"
            >
              {submitting ? '…' : 'Aktivieren'}
            </button>
          </div>

          <button
            type="button"
            className="self-start text-[0.74rem] font-semibold text-muted hover:text-accent-strong cursor-pointer"
            aria-expanded={weckerOn}
            onClick={() => setWeckerOn((v) => !v)}
          >
            {weckerOn ? '− Preiswecker' : '＋ Preiswecker (Pro)'}
          </button>

          {weckerOn && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
              <label htmlFor={`target-${offer.id}`} className="text-[0.72rem] text-muted">
                Benachrichtige mich, sobald der Preis ≤ Zielwert ist:
              </label>
              <div className="flex gap-1.5">
                <div className="flex items-center gap-1 flex-1 min-w-0 h-8 px-2 bg-surface border border-border-strong rounded-md">
                  <input
                    id={`target-${offer.id}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder="z. B. 0.79"
                    className="w-full min-w-0 bg-transparent text-ink text-[0.82rem] outline-none"
                  />
                  <span className="flex-none text-[0.72rem] text-muted">{unit}</span>
                </div>
                <div className="flex gap-1" role="group" aria-label="Zielgröße">
                  <button type="button" className={seg(targetMetric === 'unit') + ' !flex-none px-2.5'} aria-pressed={targetMetric === 'unit'} onClick={() => setTargetMetric('unit')}>
                    Dose
                  </button>
                  <button type="button" className={seg(targetMetric === 'liter') + ' !flex-none px-2.5'} aria-pressed={targetMetric === 'liter'} onClick={() => setTargetMetric('liter')}>
                    €/L
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      )}
      {channel === 'telegram' && (
        <button
          type="button"
          disabled={submitting}
          onClick={() => subscribe('telegram')}
          className="h-9 px-3 text-[0.82rem] font-semibold text-white bg-accent border border-accent rounded-lg cursor-pointer hover:bg-accent-strong disabled:opacity-60"
        >
          {submitting ? '…' : 'In Telegram öffnen'}
        </button>
      )}
      {channel === 'push' && (
        <button
          type="button"
          disabled={submitting}
          onClick={() => subscribe('push')}
          className="h-9 px-3 text-[0.82rem] font-semibold text-white bg-accent border border-accent rounded-lg cursor-pointer hover:bg-accent-strong disabled:opacity-60"
        >
          {submitting ? '…' : 'Push aktivieren'}
        </button>
      )}

      {state.kind === 'error' && (
        <p className="text-[0.74rem] text-warn-ink" role="alert">
          {state.message}
        </p>
      )}

      {channel === 'email' && showRedeem && (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value)}
            placeholder="Pro-Code"
            className="flex-1 min-w-0 h-9 px-2.5 text-[0.82rem] bg-surface text-ink border border-border-strong rounded-lg outline-none"
          />
          <button
            type="button"
            onClick={redeem}
            className="flex-none h-9 px-3 text-[0.82rem] font-semibold text-good border border-[color-mix(in_srgb,var(--good)_40%,transparent)] rounded-lg cursor-pointer hover:bg-good-tint"
          >
            Einlösen
          </button>
        </div>
      )}
      {redeemMsg && (
        <p className="text-[0.74rem] text-muted" role="status">
          {redeemMsg}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.7rem] text-muted">Kostenlos · ein Produkt · jederzeit abbestellbar.</span>
        {channel === 'email' && !showRedeem && (
          <button type="button" className="flex-none text-[0.7rem] text-muted underline underline-offset-2 hover:text-accent-strong cursor-pointer" onClick={() => setShowRedeem(true)}>
            Pro-Code einlösen
          </button>
        )}
      </div>
    </div>
  )
}
