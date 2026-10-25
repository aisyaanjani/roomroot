/** Local-only location suggestions. These are search aids, not verified boundaries or listings. */
export const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['FL', 'Florida'], ['GA', 'Georgia'],
  ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
  ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'],
  ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'],
  ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
  ['DC', 'Washington, D.C.'],
] as const

export type StateCode = typeof US_STATES[number][0]
export const STATE_OPTIONS = US_STATES.map(([code, name]) => ({ value: code, label: `${name} (${code})` }))

export function normalizeStateCode(value: string): StateCode | null {
  const normalized = value.trim().toLowerCase().replace(/\./g, '')
  const found = US_STATES.find(([code, name]) => code.toLowerCase() === normalized || name.toLowerCase().replace(/\./g, '') === normalized)
  return found?.[0] ?? null
}

export function isStateCode(value: string): value is StateCode {
  return US_STATES.some(([code]) => code === value)
}

export function filterStates(query: string) {
  const needle = query.trim().toLowerCase()
  return STATE_OPTIONS.filter(option => !needle || option.label.toLowerCase().includes(needle) || option.value.toLowerCase().startsWith(needle))
}

export const VIRGINIA_CITIES = ['Blacksburg', 'Christiansburg', 'Radford', 'Roanoke', 'Salem', 'Pulaski', 'Floyd', 'Pearisburg'] as const
const CITIES_BY_STATE: Partial<Record<StateCode, readonly string[]>> = {
  VA: VIRGINIA_CITIES,
  DC: ['Washington'],
  MA: ['Boston', 'Cambridge'],
}

export function filterCities(state: string, query: string) {
  const code = normalizeStateCode(state)
  const needle = query.trim().toLowerCase()
  return (code ? CITIES_BY_STATE[code] ?? [] : []).filter(city => !needle || city.toLowerCase().includes(needle))
}

export const VIRGINIA_TECH_LANDMARKS = [
  'Virginia Tech main campus',
  'Corporate Research Center',
  'Downtown Blacksburg',
  'Virginia Tech Montgomery Executive Airport',
] as const

export const PROXIMITY_CHOICES = [...VIRGINIA_TECH_LANDMARKS, 'No specific landmark', 'Other'] as const
export const COMMUTE_AREAS = ['Walk or bike', 'Hethwood', 'Toms Creek / University City Boulevard', 'North Main', 'South Main', 'Christiansburg', 'Other'] as const
export const BLACKSBURG_NEIGHBORHOODS = ['Downtown Blacksburg', 'Hethwood', 'Foxridge', 'Toms Creek', 'University City Boulevard', 'North Main', 'South Main', 'Prices Fork', 'Merrimac', 'Christiansburg'] as const

export const BROWSE_LOCATION_SUGGESTIONS = [
  ...VIRGINIA_CITIES,
  ...BLACKSBURG_NEIGHBORHOODS,
  ...VIRGINIA_TECH_LANDMARKS,
].filter((value, index, values) => values.findIndex(item => item.toLowerCase() === value.toLowerCase()) === index)

export function filterBrowseLocations(query: string) {
  const needle = query.trim().toLowerCase()
  return needle ? BROWSE_LOCATION_SUGGESTIONS.filter(value => value.toLowerCase().includes(needle)) : []
}
