import { describe, expect, it } from 'vitest'
import { DEFAULT_FOOTER, badge, ctaButton, emailShell } from '../shared/email-shell.mjs'

describe('email-shell', () => {
  it('Hülle enthält Logo, Karte und Standard-Footer', () => {
    const html = emailShell({ card: '<p>X</p>' })
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('Energy<span')
    expect(html).toContain('<p>X</p>')
    expect(html).toContain(DEFAULT_FOOTER)
  })
  it('footer "" lässt die Fußzeile weg, eigener Footer ersetzt sie', () => {
    expect(emailShell({ card: 'c', footer: '' })).not.toContain(DEFAULT_FOOTER)
    expect(emailShell({ card: 'c', footer: 'Tschüss' })).toContain('Tschüss')
  })
  it('Bausteine', () => {
    expect(ctaButton('https://x', 'Los')).toContain('href="https://x"')
    expect(badge('B', '#123')).toContain('background:#123')
  })
})
