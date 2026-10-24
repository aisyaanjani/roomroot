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
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '')

export async function getCompatibilityMatch(
  seeker: HousingProfile,
  host: HousingProfile,
): Promise<MatchResult> {
  const response = await fetch(`${API_BASE_URL}/api/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seeker, host }),
  })

  const body = await response.json().catch(() => ({ error: 'The server returned an invalid response.' }))

  if (!response.ok) {
    throw new Error(body.error || 'Unable to analyze housing compatibility.')
  }

  return body as MatchResult
}
