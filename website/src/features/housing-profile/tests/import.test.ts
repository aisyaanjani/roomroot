import assert from 'node:assert/strict'
import test from 'node:test'

import { createHousingProfile, leaseOptions, sections } from '../questions.ts'
import {
  applyImportedProfile,
  createProfileImportPreview,
  MAX_PROFILE_IMPORT_BYTES,
  parseHousingProfileJson,
  PROFILE_IMPORT_UNDO_KEY,
  ProfileImportError,
  readImportUndoBackup,
  restoreProfileBeforeImport,
  validateProfileFile,
} from '../importProfile.ts'
import type { HousingProfileDraft } from '../types.ts'

function completeProfile(): HousingProfileDraft {
  const draft = createHousingProfile()
  Object.assign(draft.profile.housingBasics, {
    city: 'Blacksburg', state: 'VA', transportation: 'Walking', moveInDate: '2027-08-15', lease: '12-month lease',
  })
  draft.profile.propertyPreferences.housingTypes = ['Apartment']
  draft.profile.priorities.ranked = ['Affordability', 'Distance to campus/work', 'Walkability', 'Quiet environment', 'Roommate compatibility']
  draft.completed = true
  draft.step = 6
  draft.completedSections = [0, 1, 2, 3, 4, 5]
  return draft
}

function expectImportError(run: () => unknown, pattern: RegExp) {
  assert.throws(run, (error: unknown) => error instanceof ProfileImportError && pattern.test(error.message))
}

function memorySessionStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

test('export/import round trip preserves a valid profile', () => {
  const draft = completeProfile()
  assert.deepEqual(parseHousingProfileJson(JSON.stringify(draft)), draft)
})

test('migrates legacy lease values explicitly and preserves custom Other text', () => {
  const legacyTwelveMonths = completeProfile()
  legacyTwelveMonths.profile.housingBasics.lease = '12 months'
  assert.equal(parseHousingProfileJson(JSON.stringify(legacyTwelveMonths)).profile.housingBasics.lease, '12-month lease')

  for (const lease of ['Semester', '6 months']) {
    const legacy = completeProfile()
    legacy.profile.housingBasics.lease = lease
    assert.equal(parseHousingProfileJson(JSON.stringify(legacy)).profile.housingBasics.lease, lease)
  }

  const custom = completeProfile()
  custom.profile.housingBasics.lease = 'Other'
  custom.profile.housingBasics.otherLease = 'A custom 8-month arrangement'
  const imported = parseHousingProfileJson(JSON.stringify(custom))
  assert.equal(imported.profile.housingBasics.lease, 'Other')
  assert.equal(imported.profile.housingBasics.otherLease, 'A custom 8-month arrangement')
})

test('accepts every new lease option in a strict import round trip', () => {
  for (const lease of leaseOptions) {
    const draft = completeProfile()
    draft.profile.housingBasics.lease = lease
    if (lease === 'Other') draft.profile.housingBasics.otherLease = '9 months'
    assert.deepEqual(parseHousingProfileJson(JSON.stringify(draft)), draft, lease)
  }
})

test('rejects malformed JSON without exposing its contents', () => {
  expectImportError(() => parseHousingProfileJson('{private profile contents'), /could not be read as JSON/)
})

test('accepts JSON files only and rejects files over 1 MB', () => {
  expectImportError(() => validateProfileFile({ name: 'profile.txt', size: 10, type: 'text/plain' }), /JSON profile backup/)
  expectImportError(() => validateProfileFile({ name: 'profile.json', size: 10, type: 'text/plain' }), /JSON profile backup/)
  expectImportError(() => validateProfileFile({ name: 'profile.json', size: MAX_PROFILE_IMPORT_BYTES + 1, type: 'application/json' }), /larger than 1 MB/)
  assert.doesNotThrow(() => validateProfileFile({ name: 'profile.json', size: MAX_PROFILE_IMPORT_BYTES, type: 'application/json' }))
})

test('rejects unsupported versions and missing required structure', () => {
  expectImportError(() => parseHousingProfileJson(JSON.stringify({ ...completeProfile(), version: 2 })), /version is not supported/)
  const { profile: _profile, ...missing } = completeProfile()
  expectImportError(() => parseHousingProfileJson(JSON.stringify(missing)), /not a valid RoomRoot/)
})

test('rejects unexpected properties at every contract boundary', () => {
  expectImportError(() => parseHousingProfileJson(JSON.stringify({ ...completeProfile(), injected: '<img src=x>' })), /not a valid RoomRoot/)
  const nested = completeProfile() as HousingProfileDraft & { profile: HousingProfileDraft['profile'] & { extra?: string } }
  nested.profile.extra = 'unexpected'
  expectImportError(() => parseHousingProfileJson(JSON.stringify(nested)), /not a valid RoomRoot/)
})

test('rejects invalid dates, option values, duplicates, and completion state', () => {
  const invalidDate = completeProfile(); invalidDate.profile.housingBasics.moveInDate = '2027-02-30'
  expectImportError(() => parseHousingProfileJson(JSON.stringify(invalidDate)), /not a valid RoomRoot/)
  const invalidUpdatedAt = completeProfile(); invalidUpdatedAt.updatedAt = 'next Thursday'
  expectImportError(() => parseHousingProfileJson(JSON.stringify(invalidUpdatedAt)), /not a valid RoomRoot/)
  const invalidOption = completeProfile(); invalidOption.profile.lifestyle.sleep = 'Never sleeps'
  expectImportError(() => parseHousingProfileJson(JSON.stringify(invalidOption)), /not a valid RoomRoot/)
  const duplicate = completeProfile(); duplicate.profile.propertyPreferences.housingTypes = ['Apartment', 'Apartment']
  expectImportError(() => parseHousingProfileJson(JSON.stringify(duplicate)), /not a valid RoomRoot/)
  const invalidCompletion = createHousingProfile(); invalidCompletion.step = 6
  expectImportError(() => parseHousingProfileJson(JSON.stringify(invalidCompletion)), /not a valid RoomRoot/)
})

test('keeps an incomplete profile at its imported step and previews progress', () => {
  const draft = createHousingProfile()
  draft.step = 2
  draft.completedSections = [0, 1]
  Object.assign(draft.profile.housingBasics, { city: 'Blacksburg', state: 'VA', transportation: 'Walking', moveInDate: '2027-08-15', lease: '12-month lease' })
  draft.profile.propertyPreferences.housingTypes = ['Apartment']
  const imported = parseHousingProfileJson(JSON.stringify(draft))
  assert.equal(imported.completed, false)
  assert.equal(imported.step, 2)
  assert.deepEqual(createProfileImportPreview(imported).completedSections, sections.slice(0, 2))
  assert.equal(createProfileImportPreview(imported).completionPercentage, 33)
})

test('normalizes a complete valid profile to the review screen', () => {
  const draft = completeProfile()
  draft.step = 3
  const imported = parseHousingProfileJson(JSON.stringify(draft))
  assert.equal(imported.completed, true)
  assert.equal(imported.step, 6)
  assert.equal(createProfileImportPreview(imported).completionPercentage, 100)
})

test('session backup survives remount and undo restores an existing profile', () => {
  const storage = memorySessionStorage()
  const previous = createHousingProfile()
  previous.profile.housingBasics.city = 'Roanoke'
  const imported = completeProfile()
  const applied = applyImportedProfile(imported, previous, () => true, storage)
  assert.equal(applied.undoStatus, 'available')
  const remounted = readImportUndoBackup(storage)
  assert.equal(remounted.status, 'available')
  assert.equal(remounted.status === 'available' && remounted.draft?.profile.housingBasics.city, 'Roanoke')
  const restored = restoreProfileBeforeImport(() => true, storage)
  assert.equal(restored.draft?.profile.housingBasics.city, 'Roanoke')
  assert.equal(storage.getItem(PROFILE_IMPORT_UNDO_KEY), null)
  assert.equal(readImportUndoBackup(storage).status, 'none')
})

test('undo marker restores a fresh profile when no valid previous profile exists', () => {
  const storage = memorySessionStorage()
  assert.equal(applyImportedProfile(completeProfile(), { invalid: true }, () => true, storage).ok, true)
  assert.deepEqual(readImportUndoBackup(storage), { status: 'available', draft: null })
  const restored = restoreProfileBeforeImport(() => true, storage)
  assert.deepEqual(restored.draft?.profile, createHousingProfile().profile)
  assert.equal(restored.draft?.step, 0)
})

test('unavailable session storage does not block import and reports undo unavailable', () => {
  const unavailable = { getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') }, removeItem() { throw Error('blocked') } }
  const applied = applyImportedProfile(completeProfile(), createHousingProfile(), () => true, unavailable)
  assert.equal(applied.ok, true)
  assert.equal(applied.undoStatus, 'unavailable')
  assert.equal(readImportUndoBackup(unavailable).status, 'unavailable')
})

test('failed replacement preserves the prior undo backup', () => {
  const storage = memorySessionStorage()
  const previous = createHousingProfile()
  previous.profile.housingBasics.city = 'First backup'
  assert.equal(applyImportedProfile(completeProfile(), previous, () => true, storage).ok, true)
  const priorBackup = storage.getItem(PROFILE_IMPORT_UNDO_KEY)
  const newer = createHousingProfile(); newer.profile.housingBasics.city = 'Must not replace backup'
  assert.deepEqual(applyImportedProfile(completeProfile(), newer, () => false, storage), { ok: false })
  assert.equal(storage.getItem(PROFILE_IMPORT_UNDO_KEY), priorBackup)
  assert.deepEqual(applyImportedProfile({ invalid: true } as unknown as HousingProfileDraft, newer, () => true, storage), { ok: false })
  assert.equal(storage.getItem(PROFILE_IMPORT_UNDO_KEY), priorBackup)
})

test('profile write failure and undo write failure preserve recoverable state', () => {
  const storage = memorySessionStorage()
  const previous = createHousingProfile()
  assert.deepEqual(applyImportedProfile(completeProfile(), previous, () => false, storage), { ok: false })
  assert.equal(storage.getItem(PROFILE_IMPORT_UNDO_KEY), null)
  assert.equal(applyImportedProfile(completeProfile(), previous, () => true, storage).ok, true)
  const backup = storage.getItem(PROFILE_IMPORT_UNDO_KEY)
  assert.deepEqual(restoreProfileBeforeImport(() => false, storage), { ok: false })
  assert.equal(storage.getItem(PROFILE_IMPORT_UNDO_KEY), backup)
})
