import { createHousingProfile } from '../housing-profile'
import type { HousingProfileData } from '../housing-profile'

/** Fictional completed seeker profile used only by the isolated preview page. */
export function createPreviewProfile(): HousingProfileData {
  const profile = createHousingProfile().profile
  return {
    ...profile,
    housingBasics: {
      ...profile.housingBasics,
      city: 'Boston',
      state: 'MA',
      neighborhoods: 'Allston, Brighton',
      proximity: 'Downtown campus',
      commute: 30,
      transportation: 'Public transit',
      minRent: 900,
      maxRent: 1500,
      totalBudget: 1800,
      utilities: 'No preference',
      budgetFlexible: 'Somewhat',
      moveInDate: '2027-01-01',
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
        'Public transportation',
      ],
      flexible: ['Apartment size', 'Amenities'],
    },
  }
}
