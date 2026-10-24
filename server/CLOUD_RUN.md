# RoomRoot release gate — existing service only

This runbook supersedes the original Google-provider deployment instructions.
Do not execute cloud writes without the owner's separate approval. No cloud
mutation was performed during the October 24, 2026 integration review.

## Verified existing deployment

- Project: `gen-lang-client-0420174255`
- Service: `roomroot-api`; region: `us-central1`
- URL: `https://roomroot-api-429143177894.us-central1.run.app`
- Console reports healthy; current source revision has not been redeployed.
- Port 8080, 1 CPU, 512 MiB, request-based billing, min instances 0,
  max instances 20, concurrency 10, request timeout 30 seconds.
- `FRONTEND_ORIGIN=https://frontend-not-deployed.invalid`
- `AI_RATE_LIMIT_MAX=10`
- Secret reference: `GEMINI_API_KEY` → `gemini-api-key`, version 2.
  Secret contents were not read.
- Console warns the service is publicly accessible through `allUsers`, even
  though the authentication radio shows IAM. Treat it as public.

## Financial gate

The owner requires zero spending. A free-tier allowance is not a hard spending
cap. Cloud Run compute, requests, egress, source builds, image storage, logs,
and Secret Manager usage can incur charges or consume trial credits. Monthly
free usage is shared across the billing account. A budget alert or max-instance
setting cannot guarantee a zero bill. Do not add billing, buy credits, enable
APIs, create services, change secrets/IAM, build remotely, deploy, or send live
smoke-test traffic without specific approval of the remaining cost risk.

## Prepared configuration, after approval only

Reuse this service, region, project, and its current runtime identity. Inspect
that identity's email and existing secrets first; do not create a second
service account or duplicate service. Preserve teammates' unrelated variables.

1. Confirm the exact release commit and capture the existing revision/traffic
   allocation for rollback. Do not roll back to an AI provider that can bill.
2. Confirm whether an `openrouter-api-key` secret already exists. If approved,
   use or add a pinned version through secure input; never pass key material
   on a command line, in GitHub, or in frontend variables. Grant only the
   existing runtime identity access to that one secret if separately approved.
3. Set these public runtime values:
   ```text
   NODE_ENV=production
   AI_PROVIDER=openrouter
   AI_MODEL=google/gemma-4-26b-a4b-it:free
   FRONTEND_ORIGIN=https://aisyaanjani.github.io
   AI_RATE_LIMIT_MAX=10
   ```
   Reference the approved pinned secret as `OPENROUTER_API_KEY`. Remove the
   Gemini environment binding if approved; preserve the secret resource itself.
4. Deploy the repository's `server/` directory to **roomroot-api** only.
   Its `.gcloudignore` excludes local credentials. Keep request-based billing,
   min instances 0, and no GPU. Consider reducing max instances from 20 to 1,
   but this still permits charges and needs approval. Keep timeout ≥25 seconds.
   Avoid `--set-env-vars` that replaces unrelated variables; update narrowly.
5. Do not change public-access/IAM settings without approval. CORS is a browser
   rule, not authentication. Non-browser clients can call the public service.
   The in-memory rate limit is per instance, resets on restart, and is not a
   global spend limit. A production public launch needs an abuse-control design.
6. After approved deployment, inspect health, verify preflight for the exact
   frontend origin (no `/roomroot/` path), reject other origins, verify the
   deterministic endpoint, then try one fictional AI request. Stop on payment,
   quota, model, auth, or provider errors; never select another model or retry
   endlessly. Require `aiGenerated: true` and validated JSON to claim real AI.
7. Publish the frontend only after backend verification and approval of traffic
   exposure. Build with `npm run build -- --mode release` from `website/`.
   See the repository's `RELEASE.md` for Pages and rollback steps.

## API and secrets

Frontend requests go directly to the HTTPS backend at `/api/match` and
`/api/match/deterministic`; `/health` is backend-only. GitHub Pages serves static
files and has no API proxy. Never place secrets in `VITE_` values. The current
backend rejects providers other than OpenRouter and accepts only the exact
free model. Provider payloads cap prompt/completion prices at zero. No paid
fallback exists. The public catalog listed prompt/completion prices as zero on
October 24, 2026; authenticated generation remains unverified in this review.

Sources: [Cloud Run pricing](https://cloud.google.com/run/pricing),
[OpenRouter model](https://openrouter.ai/google/gemma-4-26b-a4b-it:free).
