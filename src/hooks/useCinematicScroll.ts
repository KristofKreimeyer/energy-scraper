import { useEffect, type RefObject } from 'react'

// Scroll-Choreografie des Kino-Heros: rechnet den Scroll-Fortschritt (0..1) der
// Sektion in CSS-Variablen um. Bewusst OHNE React-State, damit beim Scrollen
// nichts neu gerendert wird – nur ein Style-Update pro Animationsframe.
// Bei „reduzierte Bewegung" bleibt alles statisch (siehe .cine in index.css).

const HEADER_PX = 62 // sticky Header (3.875rem)

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const prog = (p: number, a: number, b: number) => clamp((p - a) / (b - a))
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const pulse = (p: number, c: number, w: number) => Math.exp(-(((p - c) / w) ** 2))

export function useCinematicScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0

    const update = () => {
      raf = 0
      const rect = el.getBoundingClientRect()
      const distance = rect.height - (window.innerHeight - HEADER_PX)
      const p = clamp((HEADER_PX - rect.top) / distance)

      // Akt 1: Dose steigt auf · Akt 2: Titel weicht, Dose zoomt, Blitze · Akt 3: Dose rückt zur Seite, Text erscheint
      const rise = ease(prog(p, 0, 0.3))
      const zoom = ease(prog(p, 0.3, 0.62))
      const side = ease(prog(p, 0.62, 0.9))
      const narrow = window.innerWidth < 720

      const x = lerp(lerp(narrow ? 72 : 76, 50, zoom), narrow ? 74 : 78, side)
      const y = lerp(lerp(120, narrow ? 62 : 56, rise), 50, zoom) + side * (narrow ? -24 : 0)
      const s = lerp(lerp(0.7, 1, rise), narrow ? 1.4 : 1.9, zoom) * lerp(1, narrow ? 0.62 : 0.6, side)
      const r = lerp(lerp(14, 8, rise), -4, zoom) + side * 14
      const flash = Math.max(pulse(p, 0.33, 0.012), pulse(p, 0.47, 0.012), pulse(p, 0.6, 0.014), pulse(p, 0.12, 0.01) * 0.6)

      const set = (k: string, v: number) => el.style.setProperty(k, v.toFixed(4))
      set('--p', p)
      set('--title-out', ease(prog(p, 0.22, 0.5)))
      set('--can-x', x)
      set('--can-y', y)
      set('--can-s', s)
      set('--can-r', r)
      set('--copy', ease(prog(p, 0.66, 0.84)))
      set('--flash', flash)
      set('--bolt-a', -p * 38)
      set('--bolt-b', -p * 70)
      set('--bolt-c', -p * 110)
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [ref])
}
