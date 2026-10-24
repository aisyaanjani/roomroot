import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { HousingProfileData } from '../housing-profile'
import {
  getCompatibilityMatch,
  getDeterministicMatch,
} from '../../services/matchingApi'
import type { MatchResult } from '../../services/matchingApi'
import { createMatchingRequest } from './adapter'
import { fictionalRoommates } from './demoProfiles'
import type { FictionalRoommate } from './demoProfiles'
import { discoveryReducer, initialDiscoveryState } from './discoveryState'
import './RoommateMatching.css'
import './RoommateMatchingEnhancements.css'

export interface RoommateMatchingProps {
  currentProfile: HousingProfileData
  profiles?: FictionalRoommate[]
}

type AiState = { status: 'idle' | 'loading' | 'success' | 'unavailable'; result?: MatchResult; message?: string }

const aiCacheKey = (profileId: string, currentProfile: HousingProfileData) =>
  `roomroot:match-insights:${profileId}:${JSON.stringify(currentProfile)}`

function readCachedInsights(key: string): MatchResult | undefined {
  try {
    const value = sessionStorage.getItem(key)
    return value ? JSON.parse(value) as MatchResult : undefined
  } catch {
    return undefined
  }
}

function cacheInsights(key: string, value: MatchResult) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Matching still works when storage is unavailable or full.
  }
}

const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(value)

export function RoommateMatching({ currentProfile, profiles = fictionalRoommates }: RoommateMatchingProps) {
  const [state, dispatch] = useReducer(discoveryReducer, initialDiscoveryState)
  const [city, setCity] = useState('All cities')
  const [maxBudget, setMaxBudget] = useState(2000)
  const [moveInBy, setMoveInBy] = useState('')
  const [housingType, setHousingType] = useState('Any housing')
  const [deterministic, setDeterministic] = useState<Record<string, MatchResult>>({})
  const [deterministicError, setDeterministicError] = useState<Record<string, string>>({})
  const [ai, setAi] = useState<Record<string, AiState>>({})
  const startedMatches = useRef(new Set<string>())

  const cities = useMemo(() => ['All cities', ...new Set(profiles.map(item => item.profile.housingBasics.city))], [profiles])
  const housingTypes = useMemo(() => ['Any housing', ...new Set(profiles.flatMap(item => item.profile.propertyPreferences.housingTypes))], [profiles])
  const filtered = useMemo(() => profiles.filter(item => {
    const basics = item.profile.housingBasics
    return (city === 'All cities' || basics.city === city)
      && basics.minRent <= maxBudget
      && (!moveInBy || !basics.moveInDate || basics.moveInDate <= moveInBy)
      && (housingType === 'Any housing' || item.profile.propertyPreferences.housingTypes.includes(housingType))
  }), [city, housingType, maxBudget, moveInBy, profiles])

  const candidate = filtered[state.currentIndex]
  const result = candidate ? deterministic[candidate.id] : undefined
  const aiState = candidate ? ai[candidate.id] : undefined

  useEffect(() => {
    const started = startedMatches.current
    if (!candidate || started.has(candidate.id) || deterministic[candidate.id]) return
    const id = candidate.id
    started.add(id)
    const request = createMatchingRequest(currentProfile, candidate.profile)
    let active = true
    async function loadMatch() {
      let deterministicResult: MatchResult
      try {
        deterministicResult = await getDeterministicMatch(request.seeker, request.host)
      } catch (error) {
        if (!active) return
        const message = error instanceof Error ? error.message : 'Matching is temporarily unavailable.'
        setDeterministicError(previous => ({ ...previous, [id]: message }))
        return
      }
      if (!active) return
      setDeterministic(previous => ({ ...previous, [id]: deterministicResult }))
    }
    void loadMatch()
    return () => {
      active = false
      started.delete(id)
    }
  }, [candidate, currentProfile, deterministic])

  const requestAiInsights = useCallback(async (target: FictionalRoommate) => {
    if (ai[target.id]?.status === 'loading') return
    const id = target.id
    const request = createMatchingRequest(currentProfile, target.profile)
    const cacheKey = aiCacheKey(id, currentProfile)
    const cached = readCachedInsights(cacheKey)
    if (cached) {
      setAi(previous => ({ ...previous, [id]: { status: 'success', result: cached } }))
      return
    }
    setAi(previous => ({ ...previous, [id]: { status: 'loading' } }))
    try {
      const value = await getCompatibilityMatch(request.seeker, request.host)
      if (value.aiGenerated) cacheInsights(cacheKey, value)
      setAi(previous => ({
        ...previous,
        [id]: value.aiGenerated
          ? { status: 'success', result: value }
          : { status: 'unavailable', message: 'No additional match notes were returned.' },
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Smart match notes are temporarily unavailable.'
      setAi(previous => ({ ...previous, [id]: { status: 'unavailable', message } }))
    }
  }, [ai, currentProfile])

  useEffect(() => {
    if (!candidate || !result || aiState) return
    const cached = readCachedInsights(aiCacheKey(candidate.id, currentProfile))
    const target = candidate
    const timer = window.setTimeout(() => void requestAiInsights(target), cached ? 0 : 450)
    return () => window.clearTimeout(timer)
  }, [aiState, candidate, currentProfile, requestAiInsights, result])

  function resetDeck() { dispatch({ type: 'reset' }) }
  function updateFilter(update: () => void) { update(); dispatch({ type: 'rewind' }) }

  return <main className="roommate-matching">
    <header className="rm-header">
      <div><span className="rm-mark" aria-hidden="true">⌂</span><strong>ROOMROOT</strong></div>
      <p>Roommate discovery <span>· fictional hackathon profiles</span></p>
    </header>

    <section className="rm-shell">
      <aside className="rm-filters" aria-label="Match filters">
        <p className="rm-kicker">REFINE YOUR DECK</p>
        <h2>Find your rhythm.</h2>
        <label>City<select value={city} onChange={event => updateFilter(() => setCity(event.target.value))}>{cities.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Maximum rent <strong>{money(maxBudget)}</strong><input type="range" min="700" max="2500" step="50" value={maxBudget} onChange={event => updateFilter(() => setMaxBudget(Number(event.target.value)))} /></label>
        <label>Move in by<input type="date" value={moveInBy} onChange={event => updateFilter(() => setMoveInBy(event.target.value))} /></label>
        <label>Housing preference<select value={housingType} onChange={event => updateFilter(() => setHousingType(event.target.value))}>{housingTypes.map(value => <option key={value}>{value}</option>)}</select></label>
        <div className="rm-stats"><span><strong>{state.liked.length}</strong> liked</span><span><strong>{state.saved.length}</strong> saved</span></div>
      </aside>

      <div className="rm-content">
        <div className="rm-heading"><div><p className="rm-kicker">YOUR COMPATIBILITY DECK</p><h1>Meet your next roommate.</h1></div><button type="button" onClick={() => dispatch({ type: 'undo' })} disabled={!state.history.length}>↶ Undo</button></div>

        {!candidate ? <section className="rm-empty"><span aria-hidden="true">🌿</span><h2>You’ve reached the end of this deck.</h2><p>Adjust your filters or review the fictional profiles again.</p><button type="button" onClick={resetDeck}>Restart deck</button></section> :
          <article className="rm-card">
            <div className="rm-profile-pane">
              <div className="rm-avatar" aria-hidden="true">{candidate.initials}</div>
              <span className="rm-demo-label">FICTIONAL DEMO PROFILE</span>
              <h2>{candidate.name}</h2>
              <p className="rm-tagline">{candidate.tagline}</p>
              <dl className="rm-facts">
                <div><dt>Location</dt><dd>{candidate.profile.housingBasics.city}, {candidate.profile.housingBasics.state}</dd></div>
                <div><dt>Budget</dt><dd>{money(candidate.profile.housingBasics.minRent)}–{money(candidate.profile.housingBasics.maxRent)}</dd></div>
                <div><dt>Move-in</dt><dd>{candidate.profile.housingBasics.moveInDate}</dd></div>
                <div><dt>Home</dt><dd>{candidate.profile.propertyPreferences.housingTypes.join(' · ')}</dd></div>
              </dl>
              <div className="rm-chips">{Object.values(candidate.profile.lifestyle).filter(Boolean).slice(0, 5).map(value => <span key={value}>{value}</span>)}</div>
            </div>

            <div className="rm-analysis-pane">
              {!result && !deterministicError[candidate.id] && <div className="rm-loading" role="status"><span />Calculating deterministic compatibility…</div>}
              {deterministicError[candidate.id] && <div className="rm-alert" role="alert"><strong>Matching service unavailable</strong><p>{deterministicError[candidate.id]}</p></div>}
              {result && <>
                <div className="rm-score-row"><div className="rm-score" aria-label={`${result.compatibilityScore ?? 'Not enough information'} compatibility score`}>{result.compatibilityScore === null ? '—' : `${result.compatibilityScore}%`}</div><div><p className="rm-kicker">CORE COMPATIBILITY</p><h3>{result.eligible ? 'Worth a conversation' : 'Review firm constraints'}</h3></div></div>
                <p className="rm-method">Your score comes from stated preferences and dealbreakers. Smart notes only help explain what to discuss.</p>
                {!!result.hardConstraints.length && <section className="rm-alert"><h3>Dealbreakers or hard constraints</h3><ul>{result.hardConstraints.map(item => <li key={item}>{item}</li>)}</ul></section>}
                <section><h3>Lifestyle breakdown</h3><div className="rm-breakdown">{result.breakdown.map(item => <div key={item.field} data-match={item.matches}><span>{item.matches ? '✓' : '!'}</span><div><strong>{item.field}</strong><small>Weight {item.weight.toFixed(1)}</small></div></div>)}</div></section>
                {!!result.discussionItems.length && <section><h3>Needs discussion</h3><ul>{result.discussionItems.map(item => <li key={item}>{item}</li>)}</ul></section>}
                {!!result.missingInformation.length && <details><summary>Missing information ({result.missingInformation.length})</summary><ul>{result.missingInformation.map(item => <li key={item}>{item}</li>)}</ul></details>}
                <section className="rm-ai">
                  <div className="rm-ai-heading"><div><p className="rm-kicker">SMART MATCH NOTES</p><h3>AI flagged these</h3></div>{aiState?.status === 'success' && <span>Ready</span>}</div>
                  {!aiState && <div className="rm-ai-skeleton" aria-hidden="true"><span /><span /><span /></div>}
                  {aiState?.status === 'loading' && <div className="rm-ai-loading" role="status"><span />Checking the details that matter day to day…</div>}
                  {aiState?.status === 'unavailable' && <div className="rm-ai-note"><strong>Smart notes are taking a break.</strong><p>Your verified score and dealbreakers are still ready. {aiState.message}</p><button type="button" onClick={() => candidate && void requestAiInsights(candidate)}>Refresh insights</button></div>}
                  {aiState?.status === 'success' && aiState.result && <>
                    <p className="rm-ai-summary">{aiState.result.summary}</p>
                    <div className="rm-ai-columns">
                      {!!aiState.result.strengths.length && <div className="rm-ai-positive"><h4>✓ Looks aligned</h4><ul>{aiState.result.strengths.map(item => <li key={item}>{item}</li>)}</ul></div>}
                      {!!aiState.result.conflicts.length && <div className="rm-ai-watch"><h4>! Talk this through</h4><ul>{aiState.result.conflicts.map(item => <li key={item}>{item}</li>)}</ul></div>}
                    </div>
                    {!!aiState.result.questions.length && <div className="rm-conversation-card"><h4>Ask before you commit</h4><ul>{aiState.result.questions.map(item => <li key={item}>{item}</li>)}</ul></div>}
                    <details className="rm-ai-disclosure"><summary>How these notes work</summary><p>AI turns the profile comparison into plain-language prompts. It does not change the rules-based score, verify identity, or certify safety.</p></details>
                  </>}
                </section>
              </>}
            </div>
            <footer className="rm-actions">
              <button className="rm-pass" type="button" onClick={() => dispatch({ type: 'pass', id: candidate.id })}>✕ Pass</button>
              <button className="rm-save" type="button" aria-pressed={state.saved.includes(candidate.id)} onClick={() => dispatch({ type: 'save', id: candidate.id })}>☆ {state.saved.includes(candidate.id) ? 'Saved' : 'Save'}</button>
              <button className="rm-like" type="button" onClick={() => dispatch({ type: 'like', id: candidate.id })}>♡ Like</button>
            </footer>
          </article>}
      </div>
    </section>
  </main>
}
