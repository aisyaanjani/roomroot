export interface HousingProfile {
  [key: string]: unknown
}

export interface MatchResult {
  eligible: boolean
  compatibilityScore: number | null
  summary: string
  strengths: string[]
  conflicts: string[]
  questions: string[]
  missingInformation: string[]
  hardConstraints: string[]
  dealbreakerConflicts: string[]
  discussionItems: string[]
  breakdown: MatchBreakdown[]
  aiGenerated: boolean
}

export interface MatchBreakdown {
  field: string
  matches: boolean
  weight: number
  seekerValue?: unknown
  hostValue?: unknown
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '')).replace(/\/$/, '')

async function requestMatch(path: string, seeker: HousingProfile, host: HousingProfile): Promise<MatchResult> {
  if (!API_BASE_URL) throw new Error('The matching service is not configured for this release.')
  const url = new URL(API_BASE_URL)
  if (import.meta.env.PROD && url.protocol !== 'https:') throw new Error('The matching service requires HTTPS.')
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(25_000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seeker, host }),
  })

  const body = await response.json().catch(() => ({ error: 'The server returned an invalid response.' }))
  if (!response.ok) throw new Error(body.error || 'Unable to analyze housing compatibility.')
  return body as MatchResult
}

export function getCompatibilityMatch(
  seeker: HousingProfile,
  host: HousingProfile,
): Promise<MatchResult> {
  return requestMatch('/api/match', seeker, host)
}

export function getDeterministicMatch(
  seeker: HousingProfile,
  host: HousingProfile,
): Promise<MatchResult> {
  return requestMatch('/api/match/deterministic', seeker, host)
}
