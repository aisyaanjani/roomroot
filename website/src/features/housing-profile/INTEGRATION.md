# Housing Profile integration

The public entry point is `website/src/features/housing-profile/index.ts`. The component collects answers and persists them locally; housing search and roommate matching are separate consumers.

## Import and render

Example for a teammate to integrate into `website/src/App.tsx`:

```tsx
import { HousingProfile } from './features/housing-profile'

export default function App() {
  return <HousingProfile />
}
```

Incorporate this into the existing layout or route rather than replacing your teammates' App implementation. **App.tsx has not been modified.** The component accepts no props and imports its scoped CSS automatically. It manages navigation, autosave, and the summary internally. There is no `onChange`, `onComplete`, or controlled-data prop. Verify inherited global styles and the shared root container when integrating.

For a standalone development preview, run `npm run dev` from `website/` and open `http://localhost:5173/src/features/housing-profile/preview.html` using the port Vite prints. The preview does not require App changes and is not an application route included in the default production build.

## Load saved responses

```ts
import {
  loadHousingProfile,
  sections,
  validateSection,
} from './features/housing-profile'
import type { HousingProfileData } from './features/housing-profile'

export function getCompletedProfile(): HousingProfileData | null {
  const draft = loadHousingProfile()
  if (!draft?.completed) return null
  const issues = sections.flatMap((_, index) =>
    validateSection(draft.profile, index),
  )
  return issues.length === 0 ? draft.profile : null
}
```

Call this on entry to search/matching or when explicitly refreshing results. `loadHousingProfile()` returns the saved **envelope**, not the answer object directly. It returns null for missing, malformed, unsupported-version, or invalid stored data, or inaccessible storage. Render an invitation to complete the questionnaire when no finished profile is available.

A structurally valid draft can still lack required answers or have inconsistent budget bounds. `isHousingProfileDraft` checks the stored format and validates completed/summary records; `validateSection` checks section completion rules. Use both the completion flag and section validation at consumer boundaries. Optional questions may remain unanswered in completed profiles.

The questionnaire exports and imports local JSON backups. Import enforces a 1 MB limit, accepts `.json` files only, parses entirely in the browser, passes data through `migrateHousingProfile`, and requires the strict `isHousingProfileDraft` contract before showing a preview. Nothing is written until the user confirms replacement. Immediately before replacement, the previous valid profile (or a fresh-profile marker) is stored under `roomroot:housing-profile:import-undo:v1` in `sessionStorage`; successful undo clears it. If session storage is unavailable, replacement still works and the UI says that undo is unavailable. TypeScript interfaces alone do not validate runtime input.

## Housing search access

Every path below starts at `draft.profile`.

| Input | Path | Meaning |
| --- | --- | --- |
| Preferred location | housingBasics.city, state, neighborhoods | City/state and free-text neighborhoods |
| Campus/work proximity | housingBasics.proximity, commute, transportation | Free-text destination, maximum minutes, transportation choice |
| Monthly rent | housingBasics.minRent, maxRent | Monthly USD rent bounds |
| Total monthly budget | housingBasics.totalBudget | USD including utilities, distinct from rent |
| Budget constraints | housingBasics.utilities, budgetFlexible | String selections, not booleans |
| Move-in date | housingBasics.moveInDate, dateFlexible | YYYY-MM-DD date and flexibility choice |
| Lease | housingBasics.lease, otherLease | Use otherLease only when lease is Other |
| Housing types | propertyPreferences.housingTypes | Multiple selections |
| Required amenities | amenities entries with value Must have | Exact amenity labels |
| Ranked housing priorities | priorities.ranked | Most important first; five entries when complete |
| Flexible priorities | priorities.flexible | Independent selection; can overlap ranked priorities |

```ts
import type { HousingProfileData } from './features/housing-profile'

export function housingSearchInputs(profile: HousingProfileData) {
  const b = profile.housingBasics
  return {
    location: { city: b.city, state: b.state, neighborhoods: b.neighborhoods },
    monthlyRent: { min: b.minRent, max: b.maxRent, currency: 'USD' },
    totalMonthlyBudget: b.totalBudget,
    moveInDate: b.moveInDate,
    housingTypes: [...profile.propertyPreferences.housingTypes],
    requiredAmenities: Object.entries(profile.amenities)
      .filter(([, priority]) => priority === 'Must have')
      .map(([name]) => name),
    rankedPriorities: [...profile.priorities.ranked],
    flexiblePriorities: [...profile.priorities.flexible],
  }
}
```

Map labels to the listing service's identifiers in an adapter; do not assume identical labels. Keep Must have distinct from Nice to have and Don't care. Search decides how priority ranks and flexibility affect filtering/scoring; the questionnaire does not define that algorithm.

## Roommate matching access

All paths start at `draft.profile`.

| Input | Path |
| --- | --- |
| Sleep schedule | lifestyle.sleep |
| Cleanliness | lifestyle.cleanliness |
| Noise tolerance | lifestyle.noise |
| Guest frequency | lifestyle.guests |
| Overnight guests | lifestyle.overnight |
| Pets | lifestyle.pets |
| Smoking | lifestyle.smoking |
| Social preferences | lifestyle.social |
| Work/study at home | lifestyle.work |
| Shared groceries | lifestyle.groceries |
| Cleaning responsibilities | lifestyle.cleaning |
| Communication style | lifestyle.communication |
| Compatibility importance weights | roommatePreferences.importance |
| Lifestyle dealbreakers | roommatePreferences.dealbreakers |

```ts
import type { HousingProfileData } from './features/housing-profile'

export function roommateMatchingInputs(profile: HousingProfileData) {
  return {
    lifestyle: { ...profile.lifestyle },
    importance: { ...profile.roommatePreferences.importance },
    dealbreakers: [...profile.roommatePreferences.dealbreakers],
  }
}

// Exact dictionary-key examples:
// profile.roommatePreferences.importance['Sleep schedule compatibility']
// profile.roommatePreferences.importance['Noise compatibility']
```

Importance values are integers from 1 (less important) to 5 (essential), initialized to 3. They are raw preferences, not normalized probabilities or computed compatibility scores. The matching feature can normalize them. Keep dealbreakers separate from numeric weights: a rating of 5 alone is not a dealbreaker.

Lifestyle describes the respondent, with some mixed habit/preference categories. Comfortable with pets does not mean pet ownership. Empty optional answers are unknown, not disagreement. Categories do not fully specify guest boundaries or cleaning expectations. There are no protected-characteristic ranking inputs such as race, ethnicity, or religion.

## Complete TypeScript data structure

`HousingProfileData` contains the answers. `HousingProfileDraft` is the persisted/exported envelope. `HousingProfile` is the component, not a data interface. The following mirrors all public interfaces in `types.ts`:

```ts
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
```

### Value conventions and validation

- Money: monthly USD. Commute: minutes. Area: square feet. Numeric values must be finite and nonnegative; bedroom/roommate counts and area are whole numbers; bathrooms support half increments.
- Zero bedrooms/bathrooms/area means no minimum. Zero roommates means no roommates. Preserve numeric zero instead of replacing it using truthiness checks.
- Empty strings mean unanswered. No preference is an explicit answer. Optional answers can remain empty even after completion.
- Preserve moveInDate as a calendar date (YYYY-MM-DD), avoiding timezone conversions that shift the day. updatedAt is an ISO timestamp.
- Completion requires city, state, transportation, valid move-in date, lease (and otherLease when Other), at least one housing type, and five unique ranked priorities. Minimum rent cannot exceed maximum rent; total budget must cover maximum rent.
- step: 0 basics, 1 property, 2 amenities, 3 lifestyle, 4 roommate preferences, 5 priorities, 6 summary. It is navigation state, not completion percentage.
- completedSections contains zero-based sections advanced through with Next and may be absent in older v1 drafts. Do not infer readiness from this list or step alone.
- Draft defaults include rent 500–1500 USD, total budget 1800 USD, 30-minute commute, 1 bedroom, 1 bathroom, 1 roommate, importance ratings of 3, and Don't care for amenities. Defaults may be accepted unchanged; no per-field touched/confirmed flag is stored.
- Most categorical fields are typed as string and dictionaries as Record. TypeScript does not enforce allowed strings/keys, number ranges, or array lengths. Runtime validation and exported question definitions supply these constraints. Narrower unions/stable machine identifiers would be a future coordinated contract change.

## Public API

| Export | Contract |
| --- | --- |
| HousingProfile | React component, no props |
| All types/interfaces in types.ts | Answer groups and persisted envelope |
| ProfileIssue | Validation issue with field and message |
| createHousingProfile() | Independent draft with defaults; no storage write |
| loadHousingProfile() | Validated HousingProfileDraft or null |
| isHousingProfileDraft(value: unknown) | Runtime type guard; no write |
| saveHousingProfile(draft) | Validates and writes entire envelope; boolean success; preserves supplied updatedAt |
| updateHousingProfile(update) | Shallow update of profile/step/completed; stamps updatedAt; boolean success |
| resetHousingProfile() | Removes only this feature's storage key; boolean success |
| migrateHousingProfile(value) | Explicit version boundary for imported unknown data; currently accepts strict v1 records only |
| parseHousingProfileJson(text) | Parses and migrates a local JSON backup without writing storage |
| readHousingProfileFile(file) | Enforces file type/size and returns a validated draft without uploading or writing it |
| readImportUndoBackup() | Reads and validates the tab-session undo record without using local storage |
| validateSection(profile, sectionIndex) | ProfileIssue[] for indices 0–5 |
| HOUSING_PROFILE_STORAGE_KEY | roomroot:housing-profile:v1 |
| sections | Shared questionnaire section order |
| housingTypes, amenities, lifestyleQuestions, compatibility, dealbreakers, priorityOptions | Shared allowed labels; amenities are icon/name tuples |

Check write/reset return values. For saveHousingProfile, callers changing answers must set updatedAt themselves. updateHousingProfile sets the time but does **not** recursively merge answer groups: profile must be a complete HousingProfileData. It loads the existing record or defaults if absent/invalid. Its update parameter does not accept completedSections; use saveHousingProfile with a full envelope for that.

```ts
import { loadHousingProfile, updateHousingProfile } from './features/housing-profile'

export function updatePreferredCity(city: string): boolean {
  const saved = loadHousingProfile()
  if (!saved) return false
  return updateHousingProfile({
    profile: {
      ...saved.profile,
      housingBasics: { ...saved.profile.housingBasics, city },
    },
    completed: false,
    step: 0,
  })
}
```

Search and matching should normally read answers without modifying them. An external edit should mark the draft incomplete and return it to a suitable step for review. A mounted questionnaire does not update React state in response to another storage writer. Reset in the UI removes storage and then autosaves fresh defaults; resetHousingProfile alone leaves the key absent until another writer saves.

## Current localStorage limitations

- Records are browser/device and origin specific. Scheme, host, and port matter: localhost and 127.0.0.1 do not share answers. Development and deployment also have different records. Nothing syncs to teammates or across devices.
- One record per origin, not per account. Users sharing a browser share the record. There is no authentication, server persistence, ownership, or server-side access to browser storage.
- Data is plain JSON available to scripts on the origin, not encrypted storage. Any future backend needs its own consent and access policy.
- Storage can be disabled, full, cleared, or transient in private browsing. Reads return null; failed writes/reset return false. Missing and invalid stored records both return null. The local import UI reports failed replacement writes and keeps the current in-memory profile unchanged.
- Operations are synchronous; last writer wins across tabs. There is no conflict handling or React subscription. Browser storage events can notify other tabs, but this component does not listen. Re-read on route entry/refresh or introduce shared state explicitly later.
- Autosave includes unfinished drafts. Consumers must check completed and completion rules; handle unanswered optional fields and accepted defaults explicitly.
- The key/envelope are v1. Unsupported versions and malformed records are rejected, not migrated. A questionnaire mount falls back to defaults and autosaves them; it does not retain invalid data as a backup.
- Human-readable labels are stored. Renaming/translating them can invalidate records unless migrated. No backend IDs, normalized locations, geocoding, housing results, or matching scores are included.
- Validation covers questionnaire rules, not facts such as whether a city exists or a listing actually offers an amenity. Validate and map again at an external service boundary.

## Verification and handoff

From website/: `npm run lint`, `npm run build`, and `./node_modules/.bin/tsc -p tsconfig.app.json --noEmit`.

From the repository root: `node website/src/features/housing-profile/tests/data-review.mjs` checks validation/storage behavior. The browser regression script tests/browser-review.mjs requires Vite on port 5173 and an isolated Chrome debugging instance on port 9223. It clears that test browser's profile for the origin: use a dedicated temporary browser profile.

`node website/src/features/housing-profile/tests/import-browser-review.mjs` exercises real file selection events, preview focus, Cancel, Escape, replacement, route remount, undo cleanup, and desktop/mobile layout in that same isolated browser setup.

The public API is ready to consume. Routing/shared-layout verification and server/account persistence are separate integration work. App.tsx and global styles have not been changed.

## Selection reference

Use exported question definitions as the source of truth. All categorical fields below can also be empty in a draft (and optional fields can be empty after completion).

| Basic/property field | Accepted nonempty values |
| --- | --- |
| transportation | Walking; Biking; Public transit; Driving |
| utilities | Yes; No; No preference |
| budgetFlexible, dateFlexible | Yes; No; Somewhat |
| lease | Month-to-month; Semester; 6 months; 12 months; Other |
| bedroom, bathroom | Private; Shared; No preference |
| furnishing | Furnished; Partially furnished; Unfurnished; No preference |
| floor | Ground floor; Lower floors; Upper floors; No preference |
| elevator, entrance | Required; Preferred; No preference |
| outdoor | Private; Shared; No preference |

Housing types: Apartment; House; Townhouse; Studio; Shared house; Student housing.

| Lifestyle field | Accepted nonempty values |
| --- | --- |
| sleep | Early bird; Night owl; Flexible |
| cleanliness | Very organized; Moderately tidy; Relaxed |
| noise | Quiet; Moderate; Lively |
| social | Introverted; Balanced; Social |
| guests | Rarely; Occasionally; Frequently |
| overnight | Comfortable; Sometimes; Uncomfortable |
| work | Frequently at home; Occasionally; Rarely |
| smoking | Non-smoker; Smoker; Prefer smoke-free home |
| pets | Have pets; Comfortable with pets; Prefer no pets |
| groceries | Share groceries; Separate groceries; No preference |
| cleaning | Weekly schedule; Clean as needed; Individual responsibilities |
| communication | Direct communication; Group discussions; Text messages; Flexible |

### Compatibility dictionary keys

- Cleanliness compatibility
- Sleep schedule compatibility
- Noise compatibility
- Guest frequency
- Smoking compatibility
- Pet compatibility
- Communication style
- Shared responsibilities
- Social habits
- Personal boundaries

### Dealbreaker selections

- Smoking indoors
- Pets in the home
- Frequent overnight guests
- Late-night noise
- Unshared cleaning responsibilities
- Shared groceries
- Unannounced guests

### Ranked/flexible priority selections

- Affordability
- Distance to campus/work
- Walkability
- Public transportation
- Apartment size
- Private bathroom
- In-unit laundry
- Pet-friendly housing
- Parking
- Natural lighting
- Quiet environment
- Accessibility
- Amenities
- Roommate compatibility

## Example JSON profile

Illustrative completed v1 envelope, not real user data. All 23 amenity keys appear below. This is the JSON export format.

```json
{
  "version": 1,
  "step": 6,
  "completed": true,
  "updatedAt": "2026-10-24T16:00:00.000Z",
  "profile": {
    "housingBasics": {
      "city": "Boston",
      "state": "MA",
      "neighborhoods": "Allston, Brighton",
      "proximity": "Boston University",
      "commute": 30,
      "transportation": "Public transit",
      "minRent": 900,
      "maxRent": 1500,
      "totalBudget": 1800,
      "utilities": "No preference",
      "budgetFlexible": "Somewhat",
      "moveInDate": "2027-01-01",
      "dateFlexible": "Yes",
      "lease": "6 months",
      "otherLease": ""
    },
    "propertyPreferences": {
      "housingTypes": [
        "Apartment",
        "Shared house"
      ],
      "bedrooms": 2,
      "bathrooms": 1,
      "bedroom": "Private",
      "bathroom": "No preference",
      "squareFootage": 0,
      "furnishing": "Partially furnished",
      "floor": "No preference",
      "elevator": "No preference",
      "roommates": 1,
      "entrance": "No preference",
      "outdoor": "Shared"
    },
    "amenities": {
      "Central air conditioning": "Don't care",
      "Heating": "Don't care",
      "Ceiling fans": "Don't care",
      "Natural lighting": "Don't care",
      "Dishwasher": "Don't care",
      "Full kitchen": "Don't care",
      "Refrigerator": "Don't care",
      "Oven/stove": "Don't care",
      "Microwave": "Don't care",
      "In-unit washer and dryer": "Nice to have",
      "Shared laundry": "Don't care",
      "Parking": "Don't care",
      "Covered parking": "Don't care",
      "High-speed internet": "Must have",
      "Gym": "Don't care",
      "Pool": "Don't care",
      "Study rooms": "Don't care",
      "Balcony or patio": "Don't care",
      "Outdoor space": "Don't care",
      "Secure building access": "Don't care",
      "Elevator": "Don't care",
      "Pet-friendly housing": "Don't care",
      "Accessible entrances and facilities": "Don't care"
    },
    "lifestyle": {
      "sleep": "Early bird",
      "cleanliness": "Moderately tidy",
      "noise": "Quiet",
      "social": "Balanced",
      "guests": "Occasionally",
      "overnight": "Sometimes",
      "work": "Frequently at home",
      "smoking": "Prefer smoke-free home",
      "pets": "Comfortable with pets",
      "groceries": "Separate groceries",
      "cleaning": "Weekly schedule",
      "communication": "Direct communication"
    },
    "roommatePreferences": {
      "importance": {
        "Cleanliness compatibility": 3,
        "Sleep schedule compatibility": 3,
        "Noise compatibility": 5,
        "Guest frequency": 3,
        "Smoking compatibility": 5,
        "Pet compatibility": 3,
        "Communication style": 3,
        "Shared responsibilities": 3,
        "Social habits": 3,
        "Personal boundaries": 3
      },
      "dealbreakers": [
        "Smoking indoors",
        "Late-night noise"
      ]
    },
    "priorities": {
      "ranked": [
        "Affordability",
        "Distance to campus/work",
        "Quiet environment",
        "Roommate compatibility",
        "In-unit laundry"
      ],
      "flexible": [
        "Apartment size",
        "Amenities"
      ]
    }
  },
  "completedSections": [
    0,
    1,
    2,
    3,
    4,
    5
  ]
}
```
