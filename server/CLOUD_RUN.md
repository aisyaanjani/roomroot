# Deploy the RoomRoot API to Cloud Run

This guide deploys the existing Express server from source. Cloud Run builds only the contents of `server/`; the website and local `.env` file are not uploaded. RoomRoot can use OpenRouter's exact free Gemma 4 model or retain the original Google transport for rollback. Provider keys come only from Secret Manager.

Cloud Run, Cloud Build, Artifact Registry, Secret Manager, and Gemini API usage can consume trial credits. Review the project's Billing reports and set budget alerts before deploying. A budget alert does not automatically cap spending.

## Prerequisites

Install the Google Cloud CLI, sign in, and select the existing trial project:

```bash
gcloud auth login
gcloud projects list
gcloud config set project gen-lang-client-0420174255
gcloud config set run/region us-central1
```

Choose a region appropriate for the team and verify that Gemma API access is available there. The examples below use `us-central1`.

Set reusable shell variables:

```bash
export PROJECT_ID="gen-lang-client-0420174255"
export REGION="us-central1"
export SERVICE="roomroot-api"
export SERVICE_ACCOUNT="roomroot-api"
export FRONTEND_URL="https://frontend-not-deployed.invalid"
```

Until the website is deployed, the reserved `.invalid` origin intentionally prevents browser origins from calling the production API. Health checks and command-line requests without an `Origin` header still work. Replace it with the exact HTTPS website origin before connecting the frontend; do not include a trailing slash or path.

Enable only the APIs needed for source deployment and secret injection:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

This may prompt the project to use its already-configured billing account. Do not upgrade or change billing as part of these steps.

## Required permissions

The account performing a source deployment needs these project-level roles, unless a broader existing role already provides the same permissions:

- Cloud Run Source Developer (`roles/run.sourceDeveloper`)
- Service Usage Consumer (`roles/serviceusage.serviceUsageConsumer`)
- permission to act as the runtime identity, normally Service Account User (`roles/iam.serviceAccountUser`) on `roomroot-api@gen-lang-client-0420174255.iam.gserviceaccount.com`

Creating the runtime service account, enabling APIs, creating a secret, and changing IAM policies also requires the corresponding administrative permissions. Project owners normally have these permissions; otherwise a project administrator must perform those setup steps.

Current Google Cloud source deployments use the Compute Engine default service account for Cloud Build unless another build identity is selected. Obtain the project number and grant that build identity Cloud Run Builder if it does not already have the role:

```bash
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" \
  --format='value(projectNumber)')"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.builder"
```

## Create the runtime identity and secret

Create a dedicated service account instead of granting secret access to a broad default identity:

```bash
gcloud iam service-accounts create "$SERVICE_ACCOUNT" \
  --display-name="RoomRoot Cloud Run API"
```

Create the secret container:

```bash
gcloud secrets create gemini-api-key --replication-policy="automatic"
```

Add the API key without putting it in a command argument, source file, frontend variable, or Git history:

```bash
read -s GEMINI_API_KEY_VALUE
printf '%s' "$GEMINI_API_KEY_VALUE" | \
  gcloud secrets versions add gemini-api-key --data-file=-
unset GEMINI_API_KEY_VALUE
```

Grant only this runtime identity permission to read this secret:

```bash
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Cloud Run validates secret access during deployment. The deployer also needs permission to deploy Cloud Run services, use the runtime service account, and perform source builds.

### Add the OpenRouter key without displaying it

Do not place the key in a command argument. Disable shell tracing, read it silently, pipe it directly to Secret Manager, and clear the shell variable:

```bash
set +x
gcloud secrets create openrouter-api-key --replication-policy="automatic"
read -s OPENROUTER_API_KEY_VALUE
printf '%s' "$OPENROUTER_API_KEY_VALUE" | \
  gcloud secrets versions add openrouter-api-key --data-file=-
unset OPENROUTER_API_KEY_VALUE
```

Grant the existing RoomRoot runtime identity access to only this secret:

```bash
gcloud secrets add-iam-policy-binding openrouter-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Creating or updating a secret and deploying a Cloud Run revision can consume trial credits or incur charges. These commands are preparation only; run them only after explicit approval. Keep the existing `gemini-api-key` secret for optional Google rollback.

## Deploy from source

Run the deployment from the server directory:

```bash
cd server

gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --service-account="${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:1" \
  --set-env-vars="FRONTEND_ORIGIN=${FRONTEND_URL},AI_RATE_LIMIT_MAX=10" \
  --min-instances=0 \
  --max-instances=1 \
  --cpu=1 \
  --memory=512Mi \
  --concurrency=10 \
  --timeout=30s
```

For the existing deployed `roomroot-api` service, the provider-only configuration change would be:

```bash
gcloud run services update roomroot-api \
  --project="gen-lang-client-0420174255" \
  --region="us-central1" \
  --update-secrets="OPENROUTER_API_KEY=openrouter-api-key:1" \
  --update-env-vars="AI_PROVIDER=openrouter,AI_MODEL=google/gemma-4-26b-a4b-it:free"
```

This creates a new revision of the existing service; it does not create another service. It preserves the service's existing minimum/maximum instances, memory, CPU, CORS, rate limiter, and health endpoint unless those settings are separately changed. Review the current service configuration before executing it. Do not run it without explicit deployment approval.

Replace secret version `1` if the enabled key is stored in another version. Pinning a version makes deployments reproducible; deploy a new revision when rotating it.

These deliberately conservative settings scale to zero, cap the service at one instance, use 1 vCPU and 512 MiB memory, and allow Cloud Run 30 seconds while the application aborts Gemma requests after 20 seconds. A scale-from-zero request can be slower because of a cold start.

`--allow-unauthenticated` is needed for a browser frontend to call the service directly. CORS is not authentication. For a non-public backend, remove that flag and put an authenticated gateway or server-side caller in front of the service.

## Verify the deployment

Read the deployed URL without copying secrets:

```bash
export SERVICE_URL="$(gcloud run services describe "$SERVICE" \
  --region "$REGION" \
  --format='value(status.url)')"

curl --fail --silent --show-error "$SERVICE_URL/health"
```

Expected response:

```json
{"status":"ok"}
```

Use fictional profiles for an `/api/match` smoke test. Then configure the frontend build with the public backend URL:

```text
VITE_API_BASE_URL=https://YOUR_CLOUD_RUN_SERVICE_URL
```

`VITE_API_BASE_URL` is public configuration. Never create a `VITE_GEMINI_API_KEY`, `VITE_OPENROUTER_API_KEY`, or otherwise place a provider key in the frontend.

## Monitor free usage

OpenRouter's dashboard and Activity page show requests and model routing. `GET https://openrouter.ai/api/v1/key` reports the current key's free-tier status, usage, and configured credit limit. Never print the response fields that identify the key or account into public logs. A zero credit limit can block requests even to a zero-price model; do not remove that restriction or buy credits without explicit approval. If the free model has no provider capacity, keep the deterministic UI available and retry later rather than selecting another model.

## CORS and later updates

Production requests with an `Origin` header are accepted only when the origin exactly matches `FRONTEND_ORIGIN`. Multiple explicitly approved origins may be supplied as a comma-separated value. Localhost origins are added automatically only when `NODE_ENV` is not `production`.

Once the website has a production URL, replace the temporary `.invalid` origin:

```bash
gcloud run services update "$SERVICE" \
  --region "$REGION" \
  --update-env-vars="FRONTEND_ORIGIN=https://YOUR_DEPLOYED_FRONTEND_DOMAIN"
```

## Abuse-protection limitations

`POST /api/match` has a small in-memory, per-IP fixed-window limit (10 requests per minute by default). It reduces accidental or casual repeated AI calls but is not durable or sufficient against distributed abuse:

- counters reset on cold starts and deployments;
- counters are not shared if the maximum instance count is raised;
- IP-based controls can affect users behind shared networks;
- CORS does not block scripts, servers, or direct HTTP clients.

Before broader public use, add authentication, per-user quotas, a distributed rate limiter or API gateway, monitoring/alerts, and provider-side quota limits. The deterministic endpoint does not invoke Gemma and is not subject to this AI limiter.

## Rollback and cleanup

List revisions and direct traffic to a known revision if necessary:

```bash
gcloud run revisions list --service="$SERVICE" --region="$REGION"
gcloud run services update-traffic "$SERVICE" \
  --region="$REGION" \
  --to-revisions="KNOWN_GOOD_REVISION=100"
```

To stop future Cloud Run serving charges after the trial, delete the service. This is destructive and should be run only when the team intends to remove the deployment:

```bash
gcloud run services delete "$SERVICE" --region="$REGION"
```

Artifact Registry images, build history, logs, and Secret Manager versions are separate resources and may need their own retention or cleanup decisions.
