# RoomRoot release preparation — October 24, 2026

## Integrated and verified

PR #1 merged with normal two-parent commit `b4e2080`; PR #2 with `604a3d4`.
PR #1's sole conflict was `website/package-lock.json`; it was resolved by
regenerating the lock from both features' merged dependencies. No feature
branch was reset or force-pushed. The refreshed PR #2 delta is 10 backend-only
files: Cloud Run support, provider integration, associated docs and tests.

Main contains the homepage, housing questionnaire, matching UI and engine,
and the existing 2D/3D room planner. The integration adds hash navigation
(`#home`, `#profile`, `#matches`, `#planner`) and requires a valid completed
profile before discovery. Candidates remain clearly labeled fictional demos;
there is no real housing listing database, account system, or multi-user sync.
Profile answers and planner state are stored on the current device.

The release uses only `google/gemma-4-26b-a4b-it:free` through OpenRouter.
Paid IDs, other providers and injected alternate configurations fail closed.
The request caps prompt/completion prices at zero. No retry or fallback model
is configured. The public model catalog was checked directly: both prices were
`0`. This verifies catalog/configuration, not authenticated generation. The
local fictional matching preview displayed a deterministic 81% score and an
upstream free-provider rate-limit error, preserving the deterministic result.
No genuine OpenRouter explanation is claimed by this release review.

## Frontend deployment option

GitHub Pages can host this public repository's noncommercial hackathon demo
on GitHub Free. It does not run the backend or proxy API paths. Do not enable
a paid plan, custom domain purchase, or larger billed Actions runner.

Prepared URL: `https://aisyaanjani.github.io/roomroot/` (not deployed by this
review). The origin sent to backend CORS must be `https://aisyaanjani.github.io`,
without the repository path. Hash routing makes direct links work without an
SPA rewrite service. Vite's release mode builds assets under `/roomroot/`.

```sh
cd website
npm ci --ignore-scripts
npm run build -- --mode release
```

The tracked `.env.release` contains only the public backend URL and base path.
Ordinary production builds have no localhost fallback and fail closed if no
API URL is configured. All public API requests require HTTPS. They target
`https://roomroot-api-429143177894.us-central1.run.app/api/match` and
`/api/match/deterministic`, with a 25-second client timeout.

`.github/workflows/pages.yml` is manual-only. It refuses private repositories,
non-main branches, and runs without the explicit backend-cost-risk input.
After separate owner approval, enable Pages with GitHub Actions as source,
configure the github-pages environment reviewer if available, and run the
workflow from the reviewed main commit. No cloud deployment is automated.

GitHub Pages restricts commercial SaaS/transaction use. Reassess hosting before
a commercial launch. Its documented limits include a 1 GB site and a soft
100 GB monthly bandwidth allowance. Sources:
[Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages),
[Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## Verification

- Backend: 25 tests, including real local HTTP tests for health, deterministic
  routing, allowed/denied CORS, preflight, payload limits, malformed JSON,
  missing credentials and request rate limiting. Provider transports are mocked.
- Frontend matching: 4 tests; housing-profile data/storage validation passes.
- Planner model, stage 3 and stage 4 model suites pass.
- Frontend lint, TypeScript and production/release builds pass.
- Local browser: homepage CTA, profile UI/validation, incomplete-profile guard,
  planner navigation, add furniture and switch to 3D; fictional matching preview
  displayed deterministic score and graceful AI unavailability.
- A full six-step questionnaire completion and public deployed end-to-end
  release have not been verified. Native date input did not commit through the
  browser automation; form validation correctly blocked advancement. No data
  was bypassed or fabricated to mark the questionnaire complete.
- The lazy-loaded 3D viewer generates a ~940 kB minified chunk warning; builds
  succeed. No repeated performance tuning is required to prepare this demo.

## Remaining release gates

1. Owner approval of cost exposure is required for **any** Cloud Run deploy,
   Secret Manager mutation, remote source build, or public frontend traffic.
   Cloud Run free tier is not a hard spending ceiling. With an absolute zero
   spend requirement, leave this release undeployed unless that risk is resolved.
2. Existing backend is healthy in console but still has the Gemini secret
   reference and placeholder CORS origin. It is publicly accessible through
   `allUsers`, uses min 0/max 20 instances, 1 CPU/512 MiB, request-based billing.
   No cloud settings, secrets, billing, traffic, or IAM were changed.
3. After approval, bind the existing runtime identity to a pinned OpenRouter
   secret version, set exact provider/model and frontend origin, and deploy
   this server code to the existing service only. See [Cloud runbook](server/CLOUD_RUN.md).
4. Verify one real authenticated exact-free-model explanation. Stop on 402/429
   or model unavailability; never purchase credits or change models.
5. After backend checks, publish Pages; verify static assets, profile persistence,
   CORS, deterministic matching, AI failure handling, and planner 2D/3D. Roll back
   the frontend to the prior Pages deployment if checks fail. Cloud traffic
   rollback also requires approval; never restore a paid-capable provider.

CORS does not authenticate clients. The current per-IP in-memory limit is
per-instance and restarts with the process. It cannot cap global usage or cost.
A public production release needs abuse controls; never embed a shared secret
in the frontend as an authentication substitute. No API keys were read into
this report or committed. Lifestyle-only prompts omit direct identity/contact
fields; before using real profiles, review provider data handling and consent.
