import { compatibility, createHousingProfile, dealbreakers, housingTypes, leaseOptions, lifestyleQuestions, priorityOptions } from './questions'
import { validateSection } from './validation'
import type { HousingProfileDraft } from './types'
import { COMMUTE_AREAS, isStateCode } from './locationData'
import { migrateProfileV1 } from './profileMigration'
export const HOUSING_PROFILE_STORAGE_KEY = 'roomroot:housing-profile:v1'
function sameShape(value: unknown, template: unknown): boolean {
  if (typeof template === 'number') return typeof value === 'number' && Number.isFinite(value) && value >= 0
  if (typeof template === 'string') return typeof value === 'string'
  if (Array.isArray(template)) return Array.isArray(value) && value.every(item => typeof item === 'string')
  if (template && typeof template === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const expected = Object.keys(template)
    const actual = Object.keys(value)
    return actual.length === expected.length && actual.every(key => expected.includes(key)) &&
      Object.entries(template).every(([key, sample]) => sameShape((value as Record<string, unknown>)[key], sample))
  }
  return typeof value === typeof template
}
export function isHousingProfileDraft(value: unknown): value is HousingProfileDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  const template = createHousingProfile()
  const allowedEnvelopeKeys = new Set([...Object.keys(template), 'completedSections'])
  if (Object.keys(record).some(key => !allowedEnvelopeKeys.has(key))) return false
  if (!sameShape(record.profile, template.profile)) return false
  if (typeof record.version !== 'number' || typeof record.step !== 'number' || typeof record.completed !== 'boolean' || typeof record.updatedAt !== 'string') return false
  const draft = value as HousingProfileDraft
  const p = draft.profile
  const choices = (values: string[], options: string[]) => values.every(v => options.includes(v)) && new Set(values).size === values.length
  const b = p.housingBasics
  const h = p.propertyPreferences
  const validDate = b.moveInDate === '' || (/^\d{4}-\d{2}-\d{2}$/.test(b.moveInDate) && !Number.isNaN(Date.parse(b.moveInDate)) && new Date(b.moveInDate).toISOString().slice(0,10) === b.moveInDate)
  const selections: [string, string[]][] = [
    [b.transportation, ['Walking','Biking','Public transit','Driving']],
    [b.utilities, ['Yes','No','No preference']], [b.budgetFlexible, ['Yes','No','Somewhat']],
    [b.dateFlexible, ['Yes','No','Somewhat','No preference']], [b.lease, [...leaseOptions, 'Semester', '6 months']],
    [h.bedroom, ['Private','Shared','No preference']], [h.bathroom, ['Private','Shared','No preference']],
    [h.furnishing, ['Furnished','Partially furnished','Unfurnished','No preference']],
    [h.floor, ['Ground floor','Lower floors','Upper floors','No preference']],
    [h.elevator, ['Required','Preferred','No preference']], [h.entrance, ['Required','Preferred','No preference']],
    [h.outdoor, ['Private','Shared','No preference']],
  ]
  const completedSectionsValid = draft.completedSections === undefined || (Array.isArray(draft.completedSections) && draft.completedSections.every(v => Number.isInteger(v) && v >= 0 && v < 6) && new Set(draft.completedSections).size === draft.completedSections.length)
  const completionValid = (!draft.completed && draft.step !== 6) || Array.from({length:6}, (_, index) => validateSection(p, index)).every(issues => issues.length === 0)
  return completedSectionsValid && completionValid && validDate && (b.state === '' || isStateCode(b.state)) && (!b.commuteArea || COMMUTE_AREAS.includes(b.commuteArea as typeof COMMUTE_AREAS[number])) && selections.every(([value, options]) => !value || options.includes(value)) &&
    choices(h.housingTypes, housingTypes) && choices(p.priorities.ranked, priorityOptions) &&
    choices(p.priorities.flexible, priorityOptions) && choices(p.roommatePreferences.dealbreakers, dealbreakers) &&
    lifestyleQuestions.every(q => !p.lifestyle[q.key] || q.options.includes(p.lifestyle[q.key])) &&
    Object.keys(p.roommatePreferences.importance).every(key => compatibility.includes(key)) &&
    draft.version === 1 && Number.isInteger(draft.step) && draft.step >= 0 && draft.step <= 6 &&
    (draft.completed || draft.step < 6) &&
    !Number.isNaN(Date.parse(draft.updatedAt)) && new Date(draft.updatedAt).toISOString() === draft.updatedAt &&
    Object.keys(p.amenities).every(key => key in createHousingProfile().profile.amenities) &&
    Object.values(p.amenities).every(v => ['Must have', 'Nice to have', "Don't care"].includes(v)) &&
    Object.values(p.roommatePreferences.importance).every(v => Number.isInteger(v) && v >= 1 && v <= 5) &&
    p.priorities.ranked.length <= 5 && new Set(p.priorities.ranked).size === p.priorities.ranked.length
}
export function loadHousingProfile(): HousingProfileDraft | null {
  try { const raw = localStorage.getItem(HOUSING_PROFILE_STORAGE_KEY); if (!raw) return null; const data = migrateProfileV1(JSON.parse(raw)); return isHousingProfileDraft(data) ? data : null } catch { return null }
}
export function saveHousingProfile(draft: HousingProfileDraft): boolean {
  try { if (!isHousingProfileDraft(draft)) return false; localStorage.setItem(HOUSING_PROFILE_STORAGE_KEY, JSON.stringify(draft)); return true } catch { return false }
}
export function updateHousingProfile(update: Partial<Pick<HousingProfileDraft, 'profile' | 'step' | 'completed'>>): boolean {
  return saveHousingProfile({...loadHousingProfile() ?? createHousingProfile(), ...update, updatedAt:new Date().toISOString()})
}
export function resetHousingProfile(): boolean {
  try { localStorage.removeItem(HOUSING_PROFILE_STORAGE_KEY); return true } catch { return false }
}
