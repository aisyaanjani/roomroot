import { createHousingProfile, sections } from './questions'
import { isHousingProfileDraft } from './storage'
import { validateSection } from './validation'
import type { HousingProfileDraft } from './types'

export const MAX_PROFILE_IMPORT_BYTES = 1024 * 1024

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
  undo?: HousingProfileDraft | null
}

export function applyImportedProfile(
  imported: HousingProfileDraft,
  previous: unknown,
  save: (draft: HousingProfileDraft) => boolean,
): ImportApplyResult {
  const undo = isHousingProfileDraft(previous) ? cloneDraft(previous) : null
  const draft = cloneDraft(imported)
  if (!save(draft)) return { ok: false }
  return { ok: true, draft, undo }
}

export function restoreProfileBeforeImport(
  undo: HousingProfileDraft | null,
  save: (draft: HousingProfileDraft) => boolean,
): ImportApplyResult {
  const draft = undo ? cloneDraft(undo) : createHousingProfile()
  if (!save(draft)) return { ok: false }
  return { ok: true, draft }
}
