import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
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

export interface RoommateMatchingProps {
  currentProfile: HousingProfileData
  profiles?: FictionalRoommate[]
}

type AiState = { status: 'idle' | 'loading' | 'success' | 'unavailable'; result?: MatchResult; message?: string }

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
    if (!candidate || startedMatches.current.has(candidate.id)) return
    const id = candidate.id
    startedMatches.current.add(id)
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
      setAi(previous => ({ ...previous, [id]: { status: 'loading' } }))
      try {
        const value = await getCompatibilityMatch(request.seeker, request.host)
        if (!active) return
        setAi(previous => ({
          ...previous,
          [id]: value.aiGenerated
            ? { status: 'success', result: value }
            : { status: 'unavailable', message: 'Gemma did not return an explanation for this match.' },
        }))
      } catch (error) {
        if (!active) return
        const message = error instanceof Error ? error.message : 'AI explanation is temporarily unavailable.'
        setAi(previous => ({ ...previous, [id]: { status: 'unavailable', message } }))
      }
    }
    void loadMatch()
    return () => { active = false }
  }, [candidate, currentProfile])

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
                <div className="rm-score-row"><div className="rm-score" aria-label={`${result.compatibilityScore ?? 'Not enough information'} compatibility score`}>{result.compatibilityScore === null ? '—' : `${result.compatibilityScore}%`}</div><div><p className="rm-kicker">DETERMINISTIC MATCH</p><h3>{result.eligible ? 'Worth a conversation' : 'Review firm constraints'}</h3></div></div>
                <p className="rm-method">Calculated by RoomRoot’s weighted rules—not by AI.</p>
                {!!result.hardConstraints.length && <section className="rm-alert"><h3>Dealbreakers or hard constraints</h3><ul>{result.hardConstraints.map(item => <li key={item}>{item}</li>)}</ul></section>}
                <section><h3>Lifestyle breakdown</h3><div className="rm-breakdown">{result.breakdown.map(item => <div key={item.field} data-match={item.matches}><span>{item.matches ? '✓' : '!'}</span><div><strong>{item.field}</strong><small>Weight {item.weight.toFixed(1)}</small></div></div>)}</div></section>
                {!!result.discussionItems.length && <section><h3>Needs discussion</h3><ul>{result.discussionItems.map(item => <li key={item}>{item}</li>)}</ul></section>}
                {!!result.missingInformation.length && <details><summary>Missing information ({result.missingInformation.length})</summary><ul>{result.missingInformation.map(item => <li key={item}>{item}</li>)}</ul></details>}
                <section className="rm-ai"><p className="rm-kicker">GEMMA 4 EXPLANATION</p>{aiState?.status === 'loading' && <p role="status">Asking Gemma for additional context…</p>}{aiState?.status === 'unavailable' && <div className="rm-ai-note"><strong>AI explanation temporarily unavailable.</strong><p>Your deterministic score and breakdown above remain available. {aiState.message}</p></div>}{aiState?.status === 'success' && aiState.result && <><p>{aiState.result.summary}</p><h4>Strengths</h4><ul>{aiState.result.strengths.map(item => <li key={item}>{item}</li>)}</ul><h4>Potential conflicts</h4><ul>{aiState.result.conflicts.map(item => <li key={item}>{item}</li>)}</ul><h4>Questions to discuss</h4><ul>{aiState.result.questions.map(item => <li key={item}>{item}</li>)}</ul><small>Generated by Gemma 4; advisory, not a safety certification.</small></>}</section>
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
