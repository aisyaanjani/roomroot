# Roommate Matching integration

`RoommateMatching` is a scoped feature that consumes the Housing Profile questionnaire and the existing RoomRoot matching API. It does not define another questionnaire, profile schema, or scoring engine.

## Data flow

1. The parent reads a completed `HousingProfileDraft` with the Housing Profile feature's public API.
2. It passes `draft.profile`—the actual exported `HousingProfileData`—to `RoommateMatching`.
3. `adapter.ts` maps that profile and each fictional candidate to the backend wire format.
4. The component calls `POST /api/match/deterministic` first and renders its authoritative score and breakdown.
5. It then calls the existing `POST /api/match` through `matchingApi.ts`. A genuine successful Gemma response is labeled as AI-generated. Timeout or model errors leave the deterministic result visible with an unavailable notice.

The frontend never computes a compatibility percentage. Importance weights, hard constraints, missing-answer handling, and dealbreakers are all evaluated by `server/matchingEngine.js`.

## Render from a completed profile

Routing is intentionally not changed by this feature. In the route or layout chosen by the team:

```tsx
import {
  loadHousingProfile,
  sections,
  validateSection,
} from '../housing-profile'
import { RoommateMatching } from '../roommate-matching'

export function MatchingPage() {
  const draft = loadHousingProfile()
  const valid = draft?.completed && sections.every(
    (_, index) => validateSection(draft.profile, index).length === 0,
  )

  if (!draft || !valid) {
    return <p>Complete your Housing Profile before viewing matches.</p>
  }

  return <RoommateMatching currentProfile={draft.profile} />
}
```

The parent should reload the saved profile when entering or refreshing the matching route because the questionnaire persists to local storage and does not publish live updates.

## Backend requirements

Run the server on port 3001:

```bash
cd server
npm run dev
```

The website defaults to `http://localhost:3001`. Set `VITE_API_BASE_URL` for a deployed backend. Never expose `GEMINI_API_KEY` through a Vite variable.

## Demo data

`demoProfiles.ts` contains eight explicitly labeled fictional profiles. They are created from the Housing Profile feature's own `createHousingProfile()` factory and typed as `HousingProfileData`. They contain no real personal data and are never represented as live users.

## Matching behavior

- Comparable lifestyle answers use the mean of both profiles' 1–5 importance ratings.
- Missing answers are excluded from the score and listed for discussion.
- Explicit questionnaire dealbreakers are evaluated separately from the score.
- Ambiguous dealbreakers, such as whether a smoker smokes indoors, become discussion items rather than automatic rejection.
- Budget-range overlap and lease duration remain deterministic hard constraints.
- Protected characteristics are neither mapped nor scored.

## Verification

From `server/`:

```bash
npm test
```

From `website/`:

```bash
npm run test:matching
npm run lint
npm run build
```
