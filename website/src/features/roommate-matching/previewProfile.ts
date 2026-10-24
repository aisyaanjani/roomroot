import { createHousingProfile } from '../housing-profile'
import type { HousingProfileData } from '../housing-profile'

/** Fictional completed seeker profile used only by the isolated preview page. */
export function createPreviewProfile(): HousingProfileData {
  const profile = createHousingProfile().profile
  return {
    ...profile,
    housingBasics: {
      ...profile.housingBasics,
      city: 'Blacksburg',
      state: 'VA',
      neighborhoods: 'Near Virginia Tech',
      proximity: 'Virginia Tech campus',
      commute: 20,
      transportation: 'Blacksburg Transit',
      minRent: 650,
      maxRent: 1200,
      totalBudget: 1400,
      utilities: 'No preference',
      budgetFlexible: 'Somewhat',
      moveInDate: '2027-01-10',
      dateFlexible: 'Yes',
      lease: '12 months',
    },
    propertyPreferences: {
      ...profile.propertyPreferences,
      housingTypes: ['Apartment', 'Shared house'],
      bedroom: 'Private',
      bathroom: 'No preference',
      furnishing: 'Partially furnished',
      floor: 'No preference',
      elevator: 'No preference',
      entrance: 'No preference',
      outdoor: 'Shared',
    },
    lifestyle: {
      sleep: 'Early bird',
      cleanliness: 'Moderately tidy',
      noise: 'Quiet',
      social: 'Balanced',
      guests: 'Occasionally',
      overnight: 'Sometimes',
      work: 'Frequently at home',
      smoking: 'Prefer smoke-free home',
      pets: 'Comfortable with pets',
      groceries: 'Separate groceries',
      cleaning: 'Weekly schedule',
      communication: 'Direct communication',
    },
    roommatePreferences: {
      importance: {
        ...profile.roommatePreferences.importance,
        'Cleanliness compatibility': 4,
        'Sleep schedule compatibility': 4,
        'Noise compatibility': 5,
        'Smoking compatibility': 5,
        'Communication style': 4,
      },
      dealbreakers: ['Smoking indoors', 'Late-night noise'],
    },
    priorities: {
      ranked: [
        'Affordability',
        'Quiet environment',
        'Roommate compatibility',
        'Distance to campus/work',
        'Blacksburg Transit access',
      ],
      flexible: ['Apartment size', 'Amenities'],
    },
  }
}
