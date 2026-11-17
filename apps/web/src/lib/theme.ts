// Light/dark theme. The choice is stored in localStorage; "system" follows the OS.
// A tiny inline script in the document head (THEME_SCRIPT) applies it before
// the first paint, so there is no flash of the wrong theme.
import { useSyncExternalStore } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'
const KEY = 'roes-theme'

export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${KEY}')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light'}catch(e){}})()`

const listeners = new Set<() => void>()

function read(): ThemeChoice {
  try {
    return (localStorage.getItem(KEY) as ThemeChoice) || 'system'
  } catch {
    return 'system'
  }
}

function apply(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
}

export function setTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    // Private mode: still apply for this page view.
  }
  const go = () => apply(choice)
  const doc = document as Document & { startViewTransition?: (cb: () => void) => void }
  if (doc.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(go)
  else go()
  listeners.forEach((l) => l())
}

export function useTheme() {
  const choice = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      const mq = matchMedia('(prefers-color-scheme: dark)')
      const onChange = () => {
        if (read() === 'system') apply('system')
        cb()
      }
      mq.addEventListener('change', onChange)
      return () => {
        listeners.delete(cb)
        mq.removeEventListener('change', onChange)
      }
    },
    read,
    () => 'system' as ThemeChoice,
  )
  const resolved = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'),
    () => 'light',
  )
  return { choice, resolved, setTheme }
}
