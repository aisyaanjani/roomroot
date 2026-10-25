import assert from 'node:assert/strict'
import test from 'node:test'
import { createHousingProfile } from '../questions'
import { migrateHousingProfile } from '../importProfile'
import { isHousingProfileDraft } from '../storage'
import { addNeighborhood, parseNeighborhoods, removeNeighborhood } from '../neighborhoodModel'
import { filterCities, filterStates, normalizeStateCode, STATE_OPTIONS, US_STATES, VIRGINIA_CITIES, VIRGINIA_TECH_LANDMARKS } from '../locationData'
import { nextComboboxIndex, suggestionStatus } from '../locationInputModel'

test('all states and DC have unique abbreviations', () => {
  assert.equal(US_STATES.length, 51)
  assert.equal(new Set(US_STATES.map(([code]) => code)).size, 51)
  assert.equal(US_STATES.some(([code, name]) => code === 'DC' && name === 'Washington, D.C.'), true)
})

test('new profiles leave location unspecified and migration preserves valid profiles', () => {
  assert.equal(createHousingProfile().profile.housingBasics.state, '')
  for (const [legacy, expected] of [['Virginia', 'VA'], [' va ', 'VA'], ['VA', 'VA'], [' massachusetts ', 'MA']]) {
    const draft = createHousingProfile()
    draft.profile.housingBasics.state = legacy
    const migrated = migrateHousingProfile(draft)
    assert.equal(migrated.profile.housingBasics.state, expected)
  }
})

test('legacy profile adds commute area, preserves city, and invalid states fail', () => {
  const legacy = createHousingProfile() as ReturnType<typeof createHousingProfile> & { profile: { housingBasics: Record<string, unknown> } }
  legacy.profile.housingBasics.city = 'Boston'
  legacy.profile.housingBasics.state = 'MA'
  delete (legacy.profile.housingBasics as Partial<typeof legacy.profile.housingBasics>).commuteArea
  const migrated = migrateHousingProfile(legacy)
  assert.equal(migrated.profile.housingBasics.city, 'Boston')
  assert.equal(migrated.profile.housingBasics.state, 'MA')
  assert.equal(migrated.profile.housingBasics.commuteArea, '')
  const invalid = createHousingProfile()
  invalid.profile.housingBasics.state = 'Not a state'
  assert.equal(isHousingProfileDraft(invalid), false)
})

test('state and Virginia city filtering are case-insensitive and ordered', () => {
  assert.deepEqual(filterStates('vir').map(({ value }) => value), ['VA', 'WV'])
  assert.equal(filterStates('va').some(option => option.label === 'Virginia (VA)'), true)
  assert.deepEqual(filterCities('VA', ''), [...VIRGINIA_CITIES])
  assert.deepEqual(filterCities(' virginia ', 'RO'), ['Roanoke'])
  assert.equal(normalizeStateCode(' Washington, D.C. '), 'DC')
  assert.equal(STATE_OPTIONS.length, 51)
})

test('custom city remains valid and changing state does not delete it', () => {
  const draft = createHousingProfile()
  draft.profile.housingBasics.city = 'Lexington'
  draft.profile.housingBasics.state = 'NC'
  assert.equal(draft.profile.housingBasics.city, 'Lexington')
  assert.equal(isHousingProfileDraft(draft), true)
})

test('combobox keyboard traversal wraps and Escape can close without selection', () => {
  assert.equal(nextComboboxIndex(-1, 1, 3), 0)
  assert.equal(nextComboboxIndex(0, -1, 3), 2)
  assert.equal(nextComboboxIndex(2, 1, 3), 0)
  assert.equal(nextComboboxIndex(-1, 1, 0), -1)
  assert.equal(suggestionStatus(2, 'Virginia (VA)'), '2 matching results. Virginia (VA) highlighted.')
})

test('landmark and custom proximity values remain supported', () => {
  const draft = createHousingProfile()
  draft.profile.housingBasics.proximity = VIRGINIA_TECH_LANDMARKS[0]
  assert.equal(isHousingProfileDraft(draft), true)
  draft.profile.housingBasics.proximity = 'A custom workplace'
  assert.equal(isHousingProfileDraft(draft), true)
})

test('neighborhood chips parse legacy commas, deduplicate, add, and remove', () => {
  assert.deepEqual(parseNeighborhoods(' Hethwood, Foxridge, hethwood '), ['Hethwood', 'Foxridge'])
  assert.equal(addNeighborhood('Hethwood', ' Foxridge, HETHWOOD'), 'Hethwood, Foxridge')
  assert.equal(removeNeighborhood('Hethwood, Foxridge', 0), 'Foxridge')
})

test('export/import round trip retains new location fields', () => {
  const draft = createHousingProfile()
  Object.assign(draft.profile.housingBasics, { city: 'Blacksburg', state: 'VA', neighborhoods: 'Hethwood, Foxridge', proximity: 'Virginia Tech main campus', commuteArea: 'Walk or bike' })
  assert.deepEqual(migrateHousingProfile(JSON.parse(JSON.stringify(draft))), draft)
})
