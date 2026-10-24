# RoomRoot AI Matching Backend

This Express API compares a fictional housing seeker's profile with a fictional room host's profile. It combines deterministic checks for objective requirements with Gemma 4 analysis for nuanced lifestyle text. AI output is advisory—not a guarantee of compatibility, housing quality, or personal safety.

## Setup

Requirements: Node.js 20 or newer and either an OpenRouter key with access to the free Gemma 4 route or a Google Gemini API key with access to `gemma-4-26b-a4b-it`.

```bash
cd server
npm install
cp .env.example .env
```

Open `.env` and replace `your_api_key_here` with your key. Never put the key in the React app, commit `.env`, or share it in logs. The repository's `.gitignore` excludes `.env` files while allowing `.env.example`.

Choose the Gemma 4 API provider in `.env`. Google remains the default:

```text
AI_PROVIDER=google
GEMINI_API_KEY=your_google_api_key
```

For OpenRouter's free Gemma 4 route, use:

```text
AI_PROVIDER=openrouter
AI_MODEL=google/gemma-4-26b-a4b-it:free
OPENROUTER_API_KEY=your_openrouter_api_key
```

The OpenRouter transport accepts only `google/gemma-4-26b-a4b-it:free`; the Google transport accepts only `models/gemma-4-26b-a4b-it`. Any substitute or paid model identifier is rejected instead of being used as a fallback. Provider credentials are server-only. Both transports use the same compact prompt, strict response validation, 20-second timeout, deterministic score, and fallback behavior.

OpenRouter hosts genuine Google Gemma 4 weights through a free, capacity-dependent route. Free availability and quotas can change, requests can fail when providers are busy, and the free route is not a production SLA. Check the [official model page](https://openrouter.ai/google/gemma-4-26b-a4b-it:free) and [OpenRouter limits](https://openrouter.ai/docs/api-reference/limits) before a demo. Gemma 4 is released under the [Apache 2.0 license](https://huggingface.co/google/gemma-4-26b-a4b-it/blob/main/LICENSE).

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

The deterministic compatibility score compares budget, lease duration, location, move-in date, schedules, quiet hours, cleaning, guests, pets, smoking, and shared-space expectations when both profiles provide the same field. Lifestyle fields use the mean of the available 1–5 importance answers; other comparable fields use weight 1:

```text
score = round(matched comparable weight / total comparable weight × 100)
```

At least three comparable fields are required; otherwise the score is `null`. Gemma never creates or changes this score. Exact deterministic equality is intentionally simple for this prototype.

Gemma analyzes natural-language lifestyle details and returns structured JSON. The server requests a JSON schema, parses the result, validates its shape, removes unexpected values, and combines it with the deterministic result. Submitted profile text is explicitly treated as untrusted data.

## Testing

Run tests that do not require an API key:

```bash
npm test
```

These cover provider selection, authentication configuration, provider status errors, cancellation, successful and malformed model responses, deterministic fallback, compatibility rules, and strict AI-output validation. Start the server with the selected provider key empty to verify the `AI_NOT_CONFIGURED` response. A successful live response that also passes strict validation is required before claiming the configured Gemma model works for the key.

Provider errors are deliberately sanitized. RoomRoot distinguishes rejected credentials, payment-required responses, denied model access, missing models, provider rate limits, provider failures, timeouts, and invalid generated JSON without logging profile text or upstream response bodies. The frontend obtains the deterministic result first, so it remains usable when the AI endpoint is unavailable.

## Frontend integration

Import `getCompatibilityMatch` from `website/src/services/matchingApi.ts` and pass the questionnaire's seeker and host objects. The helper defaults to `http://localhost:3001`. For another backend URL, set this in `website/.env.local`:

```text
VITE_API_BASE_URL=https://your-api.example.com
```

Only public configuration belongs in Vite environment variables. Never create a `VITE_` variable containing either provider key.

## Limitations and safety

- Field names are flexible only for the documented aliases in `matchingEngine.js`; a production API should use a strict versioned schema.
- Exact text comparisons do not understand synonyms; Gemma's narrative may provide nuance, but cannot affect objective eligibility or scoring.
- The server has a 20 KB JSON limit and a basic per-instance AI rate limiter, but public production use still needs authentication, durable distributed limits, abuse monitoring, and stricter versioned request validation.
- OpenRouter's free route is intended for evaluation and hackathon traffic; monitor the OpenRouter Activity and key pages and never remove a zero-spend restriction merely to make a request succeed.
- Protected characteristics must not be used for ranking. Accessibility needs may only be checked against requested property features.
- Do not use real personal information in tests. Users should independently verify listings, identity, safety, accessibility, and legal requirements.
