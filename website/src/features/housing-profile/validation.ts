import type { HousingProfileData } from './types'
import { isStateCode } from './locationData'

export interface ProfileIssue { field: string; message: string }
export function validateSection(profile: HousingProfileData, section: number): ProfileIssue[] {
  const issues: ProfileIssue[] = []
  const add = (field: string, message: string) => issues.push({ field, message })
  const b = profile.housingBasics
  if (section === 0) {
    if (!b.city.trim()) add('city', 'Enter your preferred city.')
    if (!isStateCode(b.state)) add('state', 'Choose a valid U.S. state or Washington, D.C.')
    if (!b.transportation) add('transportation', 'Choose how you prefer to get around.')
    if (Number.isFinite(b.minRent) && Number.isFinite(b.maxRent) && b.minRent > b.maxRent) {
      add('minRent', 'Minimum expected rent must be at or below maximum affordable rent. Adjust either amount.')
      add('maxRent', 'Maximum affordable rent must be at or above minimum expected rent. Adjust either amount.')
    }
    if (Number.isFinite(b.totalBudget) && Number.isFinite(b.maxRent) && b.totalBudget < b.maxRent) {
      add('totalBudget', 'Maximum total monthly housing cost must cover maximum affordable rent, including utilities.')
      add('maxRent', 'Maximum affordable rent must fit within the maximum total monthly housing cost, including utilities.')
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.moveInDate) || Number.isNaN(Date.parse(b.moveInDate)) || new Date(b.moveInDate).toISOString().slice(0,10) !== b.moveInDate) add('moveInDate', 'Choose a valid move-in date.')
    if (!b.lease) add('lease', 'Choose your preferred lease duration.')
    if (b.lease === 'Other' && !b.otherLease.trim()) add('otherLease', 'Describe your preferred lease duration, such as “9 months”.')
  }
  if (section === 1 && !profile.propertyPreferences.housingTypes.length) add('housingTypes', 'Select at least one housing type. You can choose more than one.')
  if (section === 5 && profile.priorities.ranked.length !== 5) add('ranked', `Choose ${5-profile.priorities.ranked.length} more ${profile.priorities.ranked.length === 4 ? 'priority' : 'priorities'} to complete your top five.`)
  const numbers = section === 0 ? b : section === 1 ? profile.propertyPreferences : {}
  for (const [key, value] of Object.entries(numbers)) {
    if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) add(key, 'Enter a finite number of zero or greater.')
    if (['bedrooms','roommates','squareFootage'].includes(key) && typeof value === 'number' && !Number.isInteger(value)) add(key, 'Enter a whole number of zero or greater.')
    if (key === 'bathrooms' && typeof value === 'number' && !Number.isInteger(value * 2)) add(key, 'Enter bathrooms in half increments, such as 1 or 1.5.')
  }
  return issues
}
