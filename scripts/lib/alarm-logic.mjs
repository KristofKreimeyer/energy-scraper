// Zweck: Reine Entscheidungslogik der Alarme (kein I/O, keine Env-Variablen) –
//   Erkennung neuer Preistiefs, Preiswecker-Entscheidung, Store-Filter.
//   Getestet in tests/send-alarms.test.mjs.

/**
 * Produkte, die am jüngsten Tag ein neues Allzeit-Tief (€/L) erreicht haben.
 * Rein & seiteneffektfrei – Kern der Alarm-Logik, per --selftest geprüft.
 */
export function detectNewBestPrices(history) {
  const products = history?.products ?? {}
  // „Lauf-Tag“ = jüngster Datenpunkt über alle Produkte.
  let runDay = ''
  for (const p of Object.values(products)) {
    for (const pt of p.points) if (pt.date > runDay) runDay = pt.date
  }
  if (!runDay) return []

  const events = []
  for (const [key, p] of Object.entries(products)) {
    // ein €/L-Wert je Tag
    const byDay = new Map()
    for (const pt of p.points) if (pt.perLiter != null) byDay.set(pt.date, pt.perLiter)
    const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    if (days.length < 2) continue

    const [lastDay, lastVal] = days[days.length - 1]
    if (lastDay !== runDay) continue // Produkt war in diesem Lauf nicht dabei
    const prevMin = Math.min(...days.slice(0, -1).map(([, v]) => v))
    if (lastVal < prevMin) {
      events.push({ productKey: key, label: `${p.brand} ${p.title} (${p.market})`, perLiter: lastVal, market: p.market, prevMin })
    }
  }
  return events
}

/**
 * Preiswecker-Entscheidung (Pro): 'fire', sobald der aktuelle Preis <= Ziel und
 * noch nicht benachrichtigt; 'reset', wenn der Preis wieder über dem Ziel liegt
 * (damit die nächste Unterschreitung erneut alarmiert); sonst 'none'.
 */
export function weckerDecision(price, target, notifiedAt) {
  if (price == null) return 'none'
  if (price <= target) return notifiedAt ? 'none' : 'fire'
  return notifiedAt ? 'reset' : 'none'
}

/** Passt ein Markt zum Store-Filter eines Marken-Weckers? */
export function storeMatches(market, mode, stores) {
  if (mode === 'only') return stores.includes(market)
  if (mode === 'except') return !stores.includes(market)
  return true // 'all'
}
