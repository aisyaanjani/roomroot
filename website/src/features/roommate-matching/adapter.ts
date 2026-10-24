import type { HousingProfileData } from '../housing-profile'
import type { HousingProfile } from '../../services/matchingApi'

export interface NormalizedMatchingProfile extends HousingProfile {
  budgetMin: number
  budgetMax: number
  location: string
  moveInDate: string
  leaseDurationMonths?: number
  minimumLeaseMonths?: number
  maximumLeaseMonths?: number
  housingTypes: string[]
  sleepSchedule: string
  noisePreference: string
  cleanliness: string
  cleaningExpectations: string
  guestFrequency: string
  overnightGuests: string
  petPreferences: string
  smokingPreferences: string
  socialPreference: string
  studySchedule: string
  groceryPreference: string
  communicationStyle: string
  sharedSpaceExpectations: string
  importance: Record<string, number>
  dealbreakers: string[]
}

function leaseMonths(lease: string, otherLease: string): number | undefined {
  if (lease === 'Month-to-month') return 1
  if (lease === 'Semester') return 4
  const source = lease === 'Other' ? otherLease : lease
  const match = source.match(/\d+/)
  return match ? Number(match[0]) : undefined
}

export function adaptHousingProfile(profile: HousingProfileData): NormalizedMatchingProfile {
  const { housingBasics, lifestyle, propertyPreferences, roommatePreferences } = profile
  const location = [housingBasics.city, housingBasics.state]
    .map(value => value.trim())
    .filter(Boolean)
    .join(', ')

  return {
    budgetMin: housingBasics.minRent,
    budgetMax: housingBasics.maxRent,
    location,
    moveInDate: housingBasics.moveInDate,
    leaseDurationMonths: leaseMonths(housingBasics.lease, housingBasics.otherLease),
    housingTypes: [...propertyPreferences.housingTypes],
    sleepSchedule: lifestyle.sleep,
    noisePreference: lifestyle.noise,
    cleanliness: lifestyle.cleanliness,
    cleaningExpectations: lifestyle.cleaning,
    guestFrequency: lifestyle.guests,
    overnightGuests: lifestyle.overnight,
    petPreferences: lifestyle.pets,
    smokingPreferences: lifestyle.smoking,
    socialPreference: lifestyle.social,
    studySchedule: lifestyle.work,
    groceryPreference: lifestyle.groceries,
    communicationStyle: lifestyle.communication,
    sharedSpaceExpectations: [
      lifestyle.cleaning,
      lifestyle.groceries,
      lifestyle.communication,
    ].filter(Boolean).join('; '),
    importance: { ...roommatePreferences.importance },
    dealbreakers: [...roommatePreferences.dealbreakers],
  }
}

export function createMatchingRequest(seeker: HousingProfileData, host: HousingProfileData) {
  const normalizedSeeker = adaptHousingProfile(seeker)
  const normalizedHost = adaptHousingProfile(host)
  const hostLease = normalizedHost.leaseDurationMonths
  return {
    seeker: normalizedSeeker,
    host: {
      ...normalizedHost,
      minimumLeaseMonths: hostLease,
      maximumLeaseMonths: hostLease,
    },
  }
}
