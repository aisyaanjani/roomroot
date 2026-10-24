/** Housing search inputs. Money is monthly USD; commute is minutes. */
export interface HousingBasics {
  city: string
  state: string
  /** Free text, typically comma-separated; not a normalized neighborhood list. */
  neighborhoods: string
  /** Free-text university or workplace; no coordinates or address lookup. */
  proximity: string
  commute: number
  transportation: string
  minRent: number
  maxRent: number
  totalBudget: number
  utilities: string
  budgetFlexible: string
  /** Calendar date YYYY-MM-DD, or an empty string in an unfinished draft. */
  moveInDate: string
  dateFlexible: string
  lease: string
  /** Used only when lease is "Other"; may retain an earlier answer otherwise. */
  otherLease: string
}

export interface PropertyPreferences {
  housingTypes: string[]
  /** Zero means no minimum for bedroom and bathroom counts. */
  bedrooms: number
  bathrooms: number
  bedroom: string
  bathroom: string
  /** Square feet; zero means no minimum. */
  squareFootage: number
  furnishing: string
  floor: string
  elevator: string
  /** Zero means no roommates, not an unspecified answer. */
  roommates: number
  entrance: string
  outdoor: string
}

export type AmenityPriority = 'Must have' | 'Nice to have' | "Don't care"

/** Self-described habits, not desired traits in a prospective roommate. */
export interface Lifestyle {
  sleep: string
  cleanliness: string
  noise: string
  social: string
  guests: string
  overnight: string
  work: string
  smoking: string
  pets: string
  groceries: string
  cleaning: string
  communication: string
}

export interface RoommatePreferences {
  /** Exact compatibility labels from questions.ts; integer ratings 1–5. */
  importance: Record<string, number>
  /** Firm boundaries, separate from importance ratings. */
  dealbreakers: string[]
}

export interface Priorities {
  /** Most important first; exactly five entries in a completed questionnaire. */
  ranked: string[]
  /** Independent selection; can overlap ranked priorities. */
  flexible: string[]
}

/** Answers only. Empty optional strings mean unanswered, not a negative answer. */
export interface HousingProfileData {
  housingBasics: HousingBasics
  propertyPreferences: PropertyPreferences
  /** Exact amenity labels from questions.ts. */
  amenities: Record<string, AmenityPriority>
  lifestyle: Lifestyle
  roommatePreferences: RoommatePreferences
  priorities: Priorities
}

/** Persisted/exported envelope. Consumers should distinguish drafts from completion. */
export interface HousingProfileDraft {
  /** Zero-based section indices; absent in older v1 drafts. */
  completedSections?: number[]
  version: 1
  /** 0–5 are questionnaire sections; 6 is the summary screen. */
  step: number
  completed: boolean
  /** ISO timestamp supplied by the caller; saveHousingProfile preserves it. */
  updatedAt: string
  profile: HousingProfileData
}
