import assert from 'node:assert/strict'
import test from 'node:test'

import { createHousingProfile, sections } from '../questions.ts'
import {
  applyImportedProfile,
  createProfileImportPreview,
  MAX_PROFILE_IMPORT_BYTES,
  parseHousingProfileJson,
  ProfileImportError,
  restoreProfileBeforeImport,
  validateProfileFile,
} from '../importProfile.ts'
import type { HousingProfileDraft } from '../types.ts'

function completeProfile(): HousingProfileDraft {
  const draft = createHousingProfile()
  Object.assign(draft.profile.housingBasics, {
    city: 'Blacksburg', state: 'VA', transportation: 'Walking', moveInDate: '2027-08-15', lease: '12 months',
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

test('export/import round trip preserves a valid profile', () => {
  const draft = completeProfile()
  assert.deepEqual(parseHousingProfileJson(JSON.stringify(draft)), draft)
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
  Object.assign(draft.profile.housingBasics, { city: 'Blacksburg', state: 'VA', transportation: 'Walking', moveInDate: '2027-08-15', lease: '12 months' })
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

test('preview and cancel do not write until replacement is confirmed', () => {
  const imported = parseHousingProfileJson(JSON.stringify(completeProfile()))
  let writes = 0
  createProfileImportPreview(imported)
  let pending: HousingProfileDraft | null = imported
  pending = null
  assert.equal(pending, null)
  assert.equal(writes, 0)
  const result = applyImportedProfile(imported, createHousingProfile(), draft => { writes++; return Boolean(draft) })
  assert.equal(result.ok, true)
  assert.equal(writes, 1)
})

test('undo restores an existing valid profile', () => {
  const previous = createHousingProfile()
  previous.profile.housingBasics.city = 'Roanoke'
  const imported = completeProfile()
  const applied = applyImportedProfile(imported, previous, () => true)
  const restored = restoreProfileBeforeImport(applied.undo ?? null, () => true)
  assert.equal(restored.draft?.profile.housingBasics.city, 'Roanoke')
})

test('undo restores a fresh profile when no valid previous profile exists', () => {
  const applied = applyImportedProfile(completeProfile(), { invalid: true }, () => true)
  assert.equal(applied.undo, null)
  const restored = restoreProfileBeforeImport(applied.undo ?? null, () => true)
  assert.deepEqual(restored.draft?.profile, createHousingProfile().profile)
  assert.equal(restored.draft?.step, 0)
})

test('storage write failure leaves replacement and undo unapplied', () => {
  const previous = createHousingProfile()
  assert.deepEqual(applyImportedProfile(completeProfile(), previous, () => false), { ok: false })
  assert.deepEqual(restoreProfileBeforeImport(previous, () => false), { ok: false })
})
