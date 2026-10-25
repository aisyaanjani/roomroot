# Roommate Matching integration

`RoommateMatching` is a scoped feature that consumes the Housing Profile questionnaire. It does not define another questionnaire or profile schema.

## Static release behavior

The published GitHub Pages release calculates deterministic compatibility locally in the browser. Like, Pass, Save, and Undo state is stored locally with the housing profile. It does not call Cloud Run or an AI provider. Personalized AI conversation guidance remains unavailable and is clearly identified as requiring a backend AI-provider request; no AI-generated or fabricated fallback notes are shown.

The deterministic scoring implementation is a browser-safe copy of the server rules. Keep its focused fixtures aligned with `server/test/matchingEngine.test.js` when changing scoring. The static release does not require `VITE_API_BASE_URL`.

## Data flow

1. The parent reads a completed `HousingProfileDraft` with the Housing Profile feature's public API.
2. It passes `draft.profile`—the actual exported `HousingProfileData`—to `RoommateMatching`.
3. `adapter.ts` normalizes that profile and each fictional candidate.
4. `deterministicMatching.ts` calculates the compatibility score and breakdown entirely in the browser, with no application API request.
5. Like, Pass, Save, and Undo update locally persisted deck state scoped to the housing profile.
6. The Coffee Chat tab explains that personalized AI conversation guidance is unavailable; it does not call an AI provider or show generated fallback content.

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

## Isolated development preview

Run Vite, then open:

```text
http://localhost:5173/src/features/roommate-matching/preview.html
```

This page mounts the real `RoommateMatching` component with a clearly labeled fictional completed seeker profile and the existing fictional candidates. It does not use `App.tsx`, `main.tsx`, application routing, global styles, or a backend.

## Backend parity

The server matching engine remains available to API clients. It is not required by the static site or isolated preview. When changing scoring, run its tests as well as the browser scoring fixtures so both implementations stay aligned:

```bash
npm test
```

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
