import { createHousingProfile, sections } from './questions'
import { isHousingProfileDraft } from './storage'
import { validateSection } from './validation'
import type { HousingProfileDraft } from './types'

export const MAX_PROFILE_IMPORT_BYTES = 1024 * 1024
export const PROFILE_IMPORT_UNDO_KEY = 'roomroot:housing-profile:import-undo:v1'

export class ProfileImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProfileImportError'
  }
}

function cloneDraft(draft: HousingProfileDraft): HousingProfileDraft {
  return structuredClone(draft)
}

export function validateProfileFile(file: Pick<File, 'name' | 'size' | 'type'>): void {
  if (!file.name.toLowerCase().endsWith('.json') || (file.type && file.type !== 'application/json')) {
    throw new ProfileImportError('Choose a JSON profile backup ending in .json.')
  }
  if (file.size > MAX_PROFILE_IMPORT_BYTES) {
    throw new ProfileImportError('That file is larger than 1 MB. Choose a smaller RoomRoot profile backup.')
  }
}

/** Version boundary for imported backups. Add future migrations as new switch cases. */
export function migrateHousingProfile(value: unknown): HousingProfileDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProfileImportError('This file is not a valid RoomRoot housing profile.')
  }
  const version = (value as Record<string, unknown>).version
  if (version !== 1) {
    throw new ProfileImportError('This profile version is not supported by this version of RoomRoot.')
  }
  if (!isHousingProfileDraft(value)) {
    throw new ProfileImportError('This file is not a valid RoomRoot housing profile backup.')
  }
  const migrated = cloneDraft(value)
  if (migrated.completed) migrated.step = 6
  return migrated
}

export function parseHousingProfileJson(text: string): HousingProfileDraft {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new ProfileImportError('This file could not be read as JSON. Choose a valid RoomRoot profile backup.')
  }
  return migrateHousingProfile(value)
}

export async function readHousingProfileFile(file: File): Promise<HousingProfileDraft> {
  validateProfileFile(file)
  try {
    return parseHousingProfileJson(await file.text())
  } catch (error) {
    if (error instanceof ProfileImportError) throw error
    throw new ProfileImportError('This file could not be read. Choose a valid RoomRoot profile backup.')
  }
}

export interface ProfileImportPreview {
  version: number
  updatedAt: string
  completionPercentage: number
  completedSections: string[]
  location: string
  budget: string
}

export function createProfileImportPreview(draft: HousingProfileDraft): ProfileImportPreview {
  const completedIndices = draft.completed
    ? sections.map((_, index) => index)
    : (draft.completedSections ?? Array.from({ length: draft.step }, (_, index) => index))
  const completed = sections.filter((_, index) => completedIndices.includes(index) && validateSection(draft.profile, index).length === 0)
  const { city, state, minRent, maxRent } = draft.profile.housingBasics
  return {
    version: draft.version,
    updatedAt: draft.updatedAt,
    completionPercentage: Math.round(completed.length / sections.length * 100),
    completedSections: completed,
    location: [city, state].filter(Boolean).join(', ') || 'Not provided',
    budget: `$${minRent.toLocaleString()}–$${maxRent.toLocaleString()} per month`,
  }
}

export interface ImportApplyResult {
  ok: boolean
  draft?: HousingProfileDraft
  undoStatus?: 'available' | 'unavailable'
}

interface SessionStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

type UndoRecord = { version: 1; restore: 'fresh' } | { version: 1; restore: 'profile'; profile: HousingProfileDraft }
export type ImportUndoState =
  | { status: 'available'; draft: HousingProfileDraft | null }
  | { status: 'none' | 'unavailable' }

function defaultSessionStorage(): SessionStorageLike | undefined {
  try { return typeof sessionStorage === 'undefined' ? undefined : sessionStorage } catch { return undefined }
}

export function readImportUndoBackup(storage = defaultSessionStorage()): ImportUndoState {
  if (!storage) return { status: 'unavailable' }
  let raw: string | null
  try { raw = storage.getItem(PROFILE_IMPORT_UNDO_KEY) } catch { return { status: 'unavailable' } }
  if (!raw) return { status: 'none' }
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid')
    const record = value as Record<string, unknown>
    if (record.version !== 1 || !['fresh', 'profile'].includes(String(record.restore))) throw new Error('invalid')
    if (record.restore === 'fresh' && Object.keys(record).length === 2) return { status: 'available', draft: null }
    if (record.restore === 'profile' && Object.keys(record).length === 3 && isHousingProfileDraft(record.profile)) {
      return { status: 'available', draft: cloneDraft(record.profile) }
    }
  } catch {
    // Invalid session data is not an undo point.
  }
  try { storage.removeItem(PROFILE_IMPORT_UNDO_KEY) } catch { return { status: 'unavailable' } }
  return { status: 'none' }
}

function stageImportUndo(previous: unknown, storage: SessionStorageLike | undefined) {
  if (!storage) return { status: 'unavailable' as const }
  let priorRaw: string | null
  try {
    priorRaw = storage.getItem(PROFILE_IMPORT_UNDO_KEY)
    const record: UndoRecord = isHousingProfileDraft(previous)
      ? { version: 1, restore: 'profile', profile: cloneDraft(previous) }
      : { version: 1, restore: 'fresh' }
    storage.setItem(PROFILE_IMPORT_UNDO_KEY, JSON.stringify(record))
    return { status: 'available' as const, priorRaw }
  } catch {
    return { status: 'unavailable' as const }
  }
}

function rollbackStagedUndo(storage: SessionStorageLike | undefined, priorRaw: string | null | undefined) {
  if (!storage || priorRaw === undefined) return
  try {
    if (priorRaw === null) storage.removeItem(PROFILE_IMPORT_UNDO_KEY)
    else storage.setItem(PROFILE_IMPORT_UNDO_KEY, priorRaw)
  } catch {
    // The replacement already failed; preserve the current profile and report failure.
  }
}

export function applyImportedProfile(
  imported: HousingProfileDraft,
  previous: unknown,
  save: (draft: HousingProfileDraft) => boolean,
  storage = defaultSessionStorage(),
): ImportApplyResult {
  if (!isHousingProfileDraft(imported)) return { ok: false }
  const draft = cloneDraft(imported)
  const staged = stageImportUndo(previous, storage)
  if (!save(draft)) {
    rollbackStagedUndo(storage, 'priorRaw' in staged ? staged.priorRaw : undefined)
    return { ok: false }
  }
  return { ok: true, draft, undoStatus: staged.status }
}

export function restoreProfileBeforeImport(
  save: (draft: HousingProfileDraft) => boolean,
  storage = defaultSessionStorage(),
): ImportApplyResult {
  const backup = readImportUndoBackup(storage)
  if (backup.status !== 'available') return { ok: false, undoStatus: backup.status === 'unavailable' ? 'unavailable' : undefined }
  const draft = backup.draft ? cloneDraft(backup.draft) : createHousingProfile()
  if (!save(draft)) return { ok: false }
  try { storage?.removeItem(PROFILE_IMPORT_UNDO_KEY) } catch { return { ok: true, draft, undoStatus: 'unavailable' } }
  return { ok: true, draft, undoStatus: 'available' }
}
