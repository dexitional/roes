import { DEFAULT_SETTINGS, SETTINGS_KEYS } from '@roes/db'
import type { SettingsKey, StoreSettings } from '@roes/db'
import { exec, rows } from './db'
import { bustCache, cached } from './cache'

// Store settings, merged over the defaults so a newly added field always has a value.
export async function getSettings(): Promise<StoreSettings> {
  return cached('settings', 300, async () => {
    const list = await rows<{ key: SettingsKey; value: unknown }>('SELECT `key`, value FROM settings')
    const out = structuredClone(DEFAULT_SETTINGS) as StoreSettings
    for (const r of list) {
      if (!SETTINGS_KEYS.includes(r.key)) continue
      const value = typeof r.value === 'string' ? JSON.parse(r.value) : r.value
      ;(out as unknown as Record<string, unknown>)[r.key] = { ...DEFAULT_SETTINGS[r.key], ...(value as object) }
    }
    return out
  })
}

export async function saveSettings<K extends SettingsKey>(key: K, value: StoreSettings[K]) {
  await exec('INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [
    key,
    JSON.stringify(value),
  ])
  bustCache()
}
