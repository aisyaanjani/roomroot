import { normalizeStateCode } from './locationData'

/** Normalizes legacy v1 location fields without changing the persisted profile version. */
export function migrateProfileV1(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value) || (value as Record<string, unknown>).version !== 1) return value
  const migrated = structuredClone(value) as Record<string, unknown>
  const profile = migrated.profile
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return migrated
  const basics = (profile as Record<string, unknown>).housingBasics
  if (!basics || typeof basics !== 'object' || Array.isArray(basics)) return migrated
  const record = basics as Record<string, unknown>
  if (typeof record.state === 'string') record.state = normalizeStateCode(record.state) ?? record.state.trim()
  if (record.lease === '12 months') record.lease = '12-month lease'
  if (!Object.hasOwn(record, 'commuteArea')) record.commuteArea = ''
  return migrated
}
