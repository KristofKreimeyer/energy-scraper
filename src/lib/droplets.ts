// Kondenswasser-Tropfen, die an der kalten Dose herunterlaufen – reine Funktion
// der Zeit t (Sekunden), damit Hero-Overlay und Promo-Video (tools/promo/scene.html,
// dort als Kopie) exakt gleich aussehen. Koordinaten sind relativ zur Dosenfläche (0..1).

interface Drop {
  x: number
  y0: number
  len: number
  period: number
  phase: number
  r: number
}

function mulberry(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DROPS: Drop[] = (() => {
  const r = mulberry(21)
  return Array.from({ length: 18 }, () => ({
    x: 0.16 + r() * 0.68,
    y0: 0.06 + r() * 0.5,
    len: 0.22 + r() * 0.3,
    period: 5 + r() * 6,
    phase: r(),
    r: 0.0075 + r() * 0.0085,
  }))
})()

/** Zeichnet alle Tropfen in ein Canvas der Größe w×h (vorher leeren). */
export function drawDroplets(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  for (const d of DROPS) {
    const u = (t / d.period + d.phase) % 1
    const v = Math.min(1, Math.max(0, (u - 0.12) / 0.8))
    // Ruckeln: Tropfen bleiben kurz hängen und rutschen dann weiter
    const slide = v * v * (3 - 2 * v) + 0.025 * Math.sin(v * 22)
    const x = d.x * w + Math.sin(v * 9 + d.phase * 6) * w * 0.004
    const y = (d.y0 + d.len * slide) * h
    const startY = d.y0 * h
    const rad = d.r * w * Math.min(1, u / 0.12 + 0.25)
    const fade = u > 0.9 ? 1 - (u - 0.9) / 0.1 : 1

    ctx.save()
    ctx.globalAlpha = fade
    // nasse Spur
    if (y > startY + 2) {
      const trail = ctx.createLinearGradient(0, startY, 0, y)
      trail.addColorStop(0, 'rgba(200,230,255,0)')
      trail.addColorStop(1, 'rgba(200,230,255,0.28)')
      ctx.strokeStyle = trail
      ctx.lineWidth = rad * 0.7
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x, startY)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
    // Tropfen: Lichtreflex oben links, durchscheinender Körper, heller Rand
    const g = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.5, rad * 0.1, x, y, rad * 1.5)
    g.addColorStop(0, 'rgba(255,255,255,0.95)')
    g.addColorStop(0.35, 'rgba(190,225,255,0.45)')
    g.addColorStop(1, 'rgba(120,170,230,0.12)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(x, y, rad, rad * 1.35, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = Math.max(1, rad * 0.14)
    ctx.stroke()
    ctx.restore()
  }
}
