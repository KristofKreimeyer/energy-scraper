import { describe, expect, it } from 'vitest'
import { createMessages } from '../scripts/lib/alarm-messages.mjs'

const m = createMessages({ siteUrl: 'https://site.test', apiBase: 'https://api.test' })
const event = { label: 'Monster Energy (Lidl)', perLiter: 1.5, productKey: 'k' }
const offer = { url: 'https://shop.test/x', priceText: '0,75 €' }

describe('alarm-messages', () => {
  it('alarmEmail: deutsche Zahl, Angebots- und Abmelde-Link', () => {
    const mail = m.alarmEmail(event, offer, 'tok')
    expect(mail.subject).toBe('⚡ Bestpreis: Monster Energy (Lidl) – 1,50 €/L')
    expect(mail.text).toContain('https://shop.test/x')
    expect(mail.text).toContain('https://api.test/api/unsubscribe?token=tok')
    expect(mail.html).toContain('0,75 € · ')
  })
  it('ohne Offer/apiBase: Fallback auf die Site', () => {
    const bare = createMessages({ siteUrl: 'https://site.test' })
    expect(bare.alarmEmail(event, undefined, 't').text).toContain('Abmelden: https://site.test')
    expect(bare.bestPricePush(event, undefined).url).toBe('https://site.test')
  })
  it('weckerEmail/-Push: Einheit je Metrik', () => {
    const sub = { product_label: 'Monster', target_price: 0.8, target_metric: 'liter', product_key: 'k' }
    expect(m.weckerEmail(sub, offer, 1.5).subject).toBe('🔔 Preiswecker erreicht: Monster – 1,50 €/L')
    expect(m.weckerPush({ ...sub, target_metric: 'unit' }, offer, 0.7).body).toBe('Jetzt 0,70 € – dein Ziel ist erreicht.')
  })
  it('Marken-Wecker Kanaltexte', () => {
    const p = { title: 'T', body: 'B' }
    expect(m.brandEmail(offer, p).text).toBe('T\nB\nhttps://shop.test/x')
    expect(m.brandTelegram(undefined, p)).toContain('<b>T</b>')
  })
})

describe('alarm-messages HTML', () => {
  it('nutzt die gemeinsame Hülle: Badge, Button, Abmelde-Footer nur beim Bestpreis-Alarm', () => {
    const a = m.alarmEmail(event, offer, 'tok').html
    expect(a).toContain('⚡ Bestpreis</div>')
    expect(a).toContain('>Zum Angebot</a>')
    expect(a).toContain('/api/unsubscribe?token=tok')
    const w = m.weckerEmail({ product_label: 'M', target_price: 1, target_metric: 'unit' }, offer, 0.9).html
    expect(w).toContain('🔔 Preiswecker</div>')
    expect(w).not.toContain('Abmelden')
    expect(m.brandEmail(offer, { title: 'T', body: 'B' }).html).toContain('<h1')
  })
})
