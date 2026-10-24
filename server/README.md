# RoomRoot AI Matching Backend

This Express API compares a fictional housing seeker's profile with a fictional room host's profile. It combines deterministic checks for objective requirements with Gemma 4 analysis for nuanced lifestyle text. AI output is advisory—not a guarantee of compatibility, housing quality, or personal safety.

## Setup

Requirements: Node.js 20 or newer and a Google Gemini API key with access to `gemma-4-26b-a4b-it`.

```bash
cd server
npm install
cp .env.example .env
```

Open `.env` and replace `your_api_key_here` with your key. Never put the key in the React app, commit `.env`, or share it in logs. The repository's `.gitignore` excludes `.env` files while allowing `.env.example`.

Start the development server:

```bash
npm run dev
```

The API listens on `http://localhost:3001`. The React development origin `http://localhost:5173` is allowed by CORS.

## Endpoint

Send `POST /api/match` with JSON containing non-empty `seeker` and `host` objects:

```bash
curl -X POST http://localhost:3001/api/match \
  -H 'Content-Type: application/json' \
  -d '{
    "seeker": {
      "monthlyBudget": 1000,
      "leaseDurationMonths": 12,
      "sleepSchedule": "early",
      "quietHours": "10pm-7am",
      "smokingPreferences": "no smoking"
    },
    "host": {
      "monthlyRent": 850,
      "minimumLeaseMonths": 6,
      "sleepSchedule": "early",
      "quietHours": "10pm-7am",
      "smokingPreferences": "no smoking"
    }
  }'
```

Responses contain `eligible`, `compatibilityScore`, `summary`, `strengths`, `conflicts`, `questions`, `missingInformation`, and `hardConstraints`.

## How matching works

Objective eligibility is calculated in JavaScript. Rent above the seeker's budget and a requested lease outside the host's stated range are hard constraints. An ineligible result is returned without calling AI.

The deterministic compatibility score compares budget, lease duration, location, move-in date, schedules, quiet hours, cleaning, guests, pets, smoking, and shared-space expectations when both profiles provide the same field. Each comparable field has equal weight:

```text
score = round(matching comparable fields / all comparable fields × 100)
```

At least three comparable fields are required; otherwise the score is `null`. Gemma never creates or changes this score. Exact deterministic equality is intentionally simple for this prototype.

Gemma analyzes natural-language lifestyle details and returns structured JSON. The server requests a JSON schema, parses the result, validates its shape, removes unexpected values, and combines it with the deterministic result. Submitted profile text is explicitly treated as untrusted data.

## Testing

Run tests that do not require an API key:

```bash
npm test
```

These cover compatible and conflicting profiles, rent over budget, insufficient data, invalid profiles, and AI-output validation. Start the server with an empty key to verify the `AI_NOT_CONFIGURED` response. A successful live response is required before claiming the configured Gemma model works for the key.

## Frontend integration

Import `getCompatibilityMatch` from `website/src/services/matchingApi.ts` and pass the questionnaire's seeker and host objects. The helper defaults to `http://localhost:3001`. For another backend URL, set this in `website/.env.local`:

```text
VITE_API_BASE_URL=https://your-api.example.com
```

Only public configuration belongs in Vite environment variables. Never create a `VITE_` variable containing the Gemini key.

## Limitations and safety

- Field names are flexible only for the documented aliases in `matchingEngine.js`; a production API should use a strict versioned schema.
- Exact text comparisons do not understand synonyms; Gemma's narrative may provide nuance, but cannot affect objective eligibility or scoring.
- The server has a 20 KB JSON limit but still needs production authentication, rate limiting, abuse monitoring, secure hosting, and stricter validation.
- Protected characteristics must not be used for ranking. Accessibility needs may only be checked against requested property features.
- Do not use real personal information in tests. Users should independently verify listings, identity, safety, accessibility, and legal requirements.
