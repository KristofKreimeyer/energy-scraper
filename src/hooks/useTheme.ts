import { useState } from 'react'

// Hell/Dunkel-Umschalter: folgt standardmäßig der Systemeinstellung, ein Klick
// setzt data-theme am <html>-Element fest.
export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null)
  const isDark = theme === 'dark' || (theme === null && window.matchMedia('(prefers-color-scheme: dark)').matches)

  function toggle() {
    const next = isDark ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    setTheme(next)
  }
  return { isDark, toggle }
}
