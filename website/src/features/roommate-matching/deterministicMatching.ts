import type { MatchResult } from '../../services/matchingApi'

const scoreFields = [
  ['location', ['location', 'locationPreference', 'preferredLocation']],
  ['move-in date', ['moveInDate']],
  ['housing type', ['housingTypes']],
  ['sleep schedule', ['sleepSchedule'], 'Sleep schedule compatibility'],
  ['study schedule', ['studySchedule']],
  ['noise preference', ['noisePreference', 'quietHours'], 'Noise compatibility'],
  ['cleanliness', ['cleanliness'], 'Cleanliness compatibility'],
  ['cleaning expectations', ['cleaningExpectations', 'cleaning'], 'Shared responsibilities'],
  ['guest frequency', ['guestFrequency'], 'Guest frequency'],
  ['overnight guests', ['overnightGuests'], 'Personal boundaries'],
  ['pet preferences', ['petPreferences', 'petPolicy'], 'Pet compatibility'],
  ['smoking preferences', ['smokingPreferences', 'smokingPolicy'], 'Smoking compatibility'],
  ['social habits', ['socialPreference'], 'Social habits'],
  ['shared groceries', ['groceryPreference'], 'Shared responsibilities'],
  ['communication style', ['communicationStyle'], 'Communication style'],
  ['shared-space expectations', ['sharedSpaceExpectations']],
] as const

type Profile = Record<string, unknown>
type Comparison = MatchResult['breakdown'][number]

const firstValue = (profile: Profile, keys: readonly string[]) => {
  for (const key of keys) {
    const value = profile[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

const numberValue = (profile: Profile, keys: readonly string[]) => {
  const value = firstValue(profile, keys)
  if (value === undefined) return undefined
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

const normalized = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(normalized).sort().join('|')
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ')
}

const importance = (profile: Profile, key: string | undefined) => {
  if (!key) return undefined
  const values = profile.importance
  const value = values && typeof values === 'object' ? Number((values as Record<string, unknown>)[key]) : Number.NaN
  return Number.isFinite(value) ? Math.min(5, Math.max(1, value)) : undefined
}

const comparisonWeight = (seeker: Profile, host: Profile, key: string | undefined) => {
  const values = [importance(seeker, key), importance(host, key)].filter((value): value is number => Number.isFinite(value))
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 1
}

function valuesMatch(field: string, left: unknown, right: unknown) {
  if (field === 'housing type') {
    const leftValues = Array.isArray(left) ? left.map(normalized) : [normalized(left)]
    const rightValues = Array.isArray(right) ? right.map(normalized) : [normalized(right)]
    return leftValues.some(value => rightValues.includes(value))
  }

  const a = normalized(left)
  const b = normalized(right)
  if (a === b) return true
  if (['no preference', 'flexible'].includes(a) || ['no preference', 'flexible'].includes(b)) return true
  if (field === 'smoking preferences') {
    return new Set(['non-smoker', 'prefer smoke-free home']).has(a)
      && new Set(['non-smoker', 'prefer smoke-free home']).has(b)
  }
  if (field === 'pet preferences') {
    return new Set([a, b]).has('have pets') && new Set([a, b]).has('comfortable with pets')
  }
  return false
}

function dealbreakerResult(owner: string, candidate: Profile, label: string): { conflict?: string; discussion?: string } {
  const pets = normalized(firstValue(candidate, ['petPreferences', 'petPolicy']) ?? '')
  const groceries = normalized(firstValue(candidate, ['groceryPreference']) ?? '')
  const cleaning = normalized(firstValue(candidate, ['cleaningExpectations', 'cleaning']) ?? '')
  const smoking = normalized(firstValue(candidate, ['smokingPreferences', 'smokingPolicy']) ?? '')
  const guests = normalized(firstValue(candidate, ['guestFrequency']) ?? '')
  const overnight = normalized(firstValue(candidate, ['overnightGuests']) ?? '')
  const noise = normalized(firstValue(candidate, ['noisePreference']) ?? '')
  const sleep = normalized(firstValue(candidate, ['sleepSchedule']) ?? '')
  const prefix = `${owner}'s dealbreaker “${label}”`

  if (label === 'Pets in the home' && pets === 'have pets') return { conflict: `${prefix} conflicts with the other profile having pets.` }
  if (label === 'Shared groceries' && groceries === 'share groceries') return { conflict: `${prefix} conflicts with the other profile preferring shared groceries.` }
  if (label === 'Unshared cleaning responsibilities' && cleaning === 'individual responsibilities') return { conflict: `${prefix} conflicts with individual cleaning responsibilities.` }
  if (label === 'Smoking indoors' && smoking === 'smoker') return { discussion: `${prefix} needs discussion because smoking location is not specified.` }
  if (label === 'Frequent overnight guests' && (guests === 'frequently' || overnight === 'comfortable')) return { discussion: `${prefix} needs a specific overnight-guest agreement.` }
  if (label === 'Late-night noise' && (noise === 'lively' || sleep === 'night owl')) return { discussion: `${prefix} needs agreed quiet hours; the profile does not confirm late-night noise.` }
  if (label === 'Unannounced guests') return { discussion: `${prefix} cannot be evaluated because notice expectations are not collected.` }
  return {}
}

function evaluateDealbreakers(seeker: Profile, host: Profile) {
  const conflicts: string[] = []
  const discussions: string[] = []
  for (const [owner, profile, candidate] of [['Seeker', seeker, host], ['Host', host, seeker]] as const) {
    const labels = Array.isArray(profile.dealbreakers) ? profile.dealbreakers : []
    for (const label of labels) {
      if (typeof label !== 'string') continue
      const result = dealbreakerResult(owner, candidate, label)
      if (result.conflict) conflicts.push(result.conflict)
      if (result.discussion) discussions.push(result.discussion)
    }
  }
  return { conflicts: [...new Set(conflicts)], discussions: [...new Set(discussions)] }
}

export function calculateLocalMatch(seeker: Profile, host: Profile): MatchResult {
  const hardConstraints: string[] = []
  const comparisons: Comparison[] = []
  const missingInformation: string[] = []
  const seekerMin = numberValue(seeker, ['budgetMin', 'minRent'])
  const seekerMax = numberValue(seeker, ['budgetMax', 'monthlyBudget', 'budget', 'maxRent'])
  const hostMin = numberValue(host, ['budgetMin', 'minRent'])
  const hostMax = numberValue(host, ['budgetMax', 'maxRent'])
  const budget = seekerMax
  const rent = numberValue(host, ['monthlyRent', 'rent'])

  if (seekerMin !== undefined && seekerMax !== undefined && hostMin !== undefined && hostMax !== undefined) {
    const overlaps = seekerMin <= hostMax && hostMin <= seekerMax
    comparisons.push({ field: 'monthly housing budget', matches: overlaps, weight: 1 })
    if (!overlaps) hardConstraints.push('The profiles’ monthly rent ranges do not overlap.')
  } else if (budget !== undefined && rent !== undefined) {
    comparisons.push({ field: 'monthly housing cost', matches: rent <= budget, weight: 1 })
    if (rent > budget) hardConstraints.push(`Monthly rent (${rent}) exceeds the seeker's budget (${budget}).`)
  } else {
    missingInformation.push('A monthly budget or rent is missing.')
  }

  const desiredLease = numberValue(seeker, ['leaseDurationMonths', 'desiredLeaseMonths'])
  const minimumLease = numberValue(host, ['minimumLeaseMonths', 'minLeaseMonths'])
  const maximumLease = numberValue(host, ['maximumLeaseMonths', 'maxLeaseMonths'])
  if (desiredLease !== undefined && (minimumLease !== undefined || maximumLease !== undefined)) {
    const leaseMatches = (minimumLease === undefined || desiredLease >= minimumLease)
      && (maximumLease === undefined || desiredLease <= maximumLease)
    comparisons.push({ field: 'lease duration', matches: leaseMatches, weight: 1 })
    if (!leaseMatches) hardConstraints.push('The requested lease duration is outside the host’s available range.')
  } else {
    missingInformation.push('A comparable lease duration is missing.')
  }

  for (const [field, keys, importanceKey] of scoreFields) {
    const seekerValue = firstValue(seeker, keys)
    const hostValue = firstValue(host, keys)
    if (seekerValue !== undefined && hostValue !== undefined) {
      comparisons.push({
        field,
        matches: valuesMatch(field, seekerValue, hostValue),
        weight: comparisonWeight(seeker, host, importanceKey),
        seekerValue,
        hostValue,
      })
    } else if (seekerValue !== undefined || hostValue !== undefined) {
      missingInformation.push(`${field[0].toUpperCase()}${field.slice(1)} is missing from one profile.`)
    }
  }

  const totalWeight = comparisons.reduce((sum, item) => sum + item.weight, 0)
  const matchedWeight = comparisons.reduce((sum, item) => sum + (item.matches ? item.weight : 0), 0)
  const compatibilityScore = comparisons.length >= 3 && totalWeight > 0
    ? Math.round((matchedWeight / totalWeight) * 100)
    : null
  const dealbreakers = evaluateDealbreakers(seeker, host)
  hardConstraints.push(...dealbreakers.conflicts)

  return {
    eligible: hardConstraints.length === 0,
    compatibilityScore,
    summary: compatibilityScore === null
      ? 'More shared profile information is needed for a fair score.'
      : `Deterministic compatibility is ${compatibilityScore}%.`,
    strengths: comparisons.filter(item => item.matches).map(item => `Compatible ${item.field}.`),
    conflicts: comparisons.filter(item => !item.matches).map(item => `Different ${item.field}.`),
    questions: dealbreakers.discussions,
    missingInformation: [...new Set(missingInformation)],
    hardConstraints,
    dealbreakerConflicts: dealbreakers.conflicts,
    discussionItems: dealbreakers.discussions,
    breakdown: comparisons,
    aiGenerated: false,
  }
}
