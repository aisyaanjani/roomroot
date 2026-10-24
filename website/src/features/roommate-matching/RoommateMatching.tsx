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

const priorityLabel = (weight: number) => {
  if (weight >= 4.5) return 'Top priority'
  if (weight >= 3.5) return 'High priority'
  if (weight >= 2.5) return 'Important'
  return 'Preference'
}

const answerLabel = (value: unknown) => Array.isArray(value) ? value.join(', ') : String(value ?? 'Not answered')

const logisticsFields = new Set(['monthly housing budget', 'monthly housing cost', 'lease duration', 'location', 'move-in date', 'housing type'])

function domainScore(items: MatchResult['breakdown'], logistics: boolean) {
  const selected = items.filter(item => logisticsFields.has(item.field) === logistics)
  const matched = selected.filter(item => item.matches).length
  return { matched, total: selected.length, percent: selected.length ? Math.round((matched / selected.length) * 100) : 0 }
}

function fallbackQuestions(items: MatchResult['breakdown']) {
  const mismatches = new Set(items.filter(item => !item.matches).map(item => item.field))
  const questions: string[] = []
  if (mismatches.has('sleep schedule') || mismatches.has('noise preference')) questions.push('What quiet hours work on weeknights, during exams, and on game weekends?')
  if (mismatches.has('cleanliness') || mismatches.has('cleaning expectations')) questions.push('How should we split kitchen and bathroom chores, and how often should they be done?')
  if (mismatches.has('guest frequency') || mismatches.has('overnight guests')) questions.push('How much notice should we give for visitors, and what overnight-guest boundaries feel fair?')
  if (mismatches.has('shared groceries')) questions.push('Which groceries and household supplies, if any, should we share?')
  if (mismatches.has('communication style')) questions.push('How should we bring up a problem before it turns into resentment?')
  return [...questions, 'What should we put in writing before signing a lease?'].slice(0, 3)
}

export function RoommateMatching({ currentProfile, profiles = fictionalRoommates }: RoommateMatchingProps) {
  const [state, dispatch] = useReducer(discoveryReducer, initialDiscoveryState)
  const [city, setCity] = useState('All cities')
  const [maxBudget, setMaxBudget] = useState(1300)
  const [moveInBy, setMoveInBy] = useState('')
  const [housingType, setHousingType] = useState('Any housing')
  const [roommateDynamic, setRoommateDynamic] = useState('Any dynamic')
  const [householdRhythm, setHouseholdRhythm] = useState('Any rhythm')
  const [sharedMeals, setSharedMeals] = useState('Any meal style')
  const [kitchenStyle, setKitchenStyle] = useState('Any kitchen')
  const [guestFrequency, setGuestFrequency] = useState('Any guest frequency')
  const [smokeFree, setSmokeFree] = useState(false)
  const [petPreference, setPetPreference] = useState('Any pet preference')
  const [searchMode, setSearchMode] = useState('Any search mode')
  const [occupancyCap, setOccupancyCap] = useState('Any household size')
  const [transitCorridor, setTransitCorridor] = useState('Any commute corridor')
  const [academicTerm, setAcademicTerm] = useState('Any lease term')
  const [privateBathroom, setPrivateBathroom] = useState(false)
  const [deterministic, setDeterministic] = useState<Record<string, MatchResult>>({})
  const [deterministicError, setDeterministicError] = useState<Record<string, string>>({})
  const [ai, setAi] = useState<Record<string, AiState>>({})
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)
  const startedMatches = useRef(new Set<string>())
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  const cities = useMemo(() => ['All cities', ...new Set(profiles.map(item => item.profile.housingBasics.city))], [profiles])
  const housingTypes = useMemo(() => ['Any housing', ...new Set(profiles.flatMap(item => item.profile.propertyPreferences.housingTypes))], [profiles])
  const filtered = useMemo(() => profiles.filter(item => {
    const basics = item.profile.housingBasics
    const lifestyle = item.profile.lifestyle
    return (city === 'All cities' || basics.city === city)
      && basics.minRent <= maxBudget
      && (!moveInBy || !basics.moveInDate || basics.moveInDate <= moveInBy)
      && (housingType === 'Any housing' || item.profile.propertyPreferences.housingTypes.includes(housingType))
      && (searchMode === 'Any search mode' || item.matchProfile.searchMode === searchMode)
      && (occupancyCap === 'Any household size' || item.matchProfile.occupancyCap === Number(occupancyCap))
      && (transitCorridor === 'Any commute corridor' || item.matchProfile.transitCorridor === transitCorridor)
      && (academicTerm === 'Any lease term' || item.matchProfile.academicTerm === academicTerm)
      && (!privateBathroom || item.matchProfile.privateBathroom)
      && (roommateDynamic === 'Any dynamic' || item.matchProfile.roommateDynamic === roommateDynamic)
      && (householdRhythm === 'Any rhythm' || item.matchProfile.householdRhythm === householdRhythm)
      && (sharedMeals === 'Any meal style' || item.matchProfile.sharedMeals === sharedMeals)
      && (kitchenStyle === 'Any kitchen' || item.matchProfile.kitchenStyle === kitchenStyle)
      && (guestFrequency === 'Any guest frequency' || lifestyle.guests === guestFrequency)
      && (!smokeFree || lifestyle.smoking === 'Prefer smoke-free home' || lifestyle.smoking === 'Non-smoker')
      && (petPreference === 'Any pet preference' || lifestyle.pets === petPreference)
  }), [academicTerm, city, guestFrequency, householdRhythm, housingType, kitchenStyle, maxBudget, moveInBy, occupancyCap, petPreference, privateBathroom, profiles, roommateDynamic, searchMode, sharedMeals, smokeFree, transitCorridor])

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
    if (!cached) return
    const target = candidate
    const timer = window.setTimeout(() => void requestAiInsights(target), 0)
    return () => window.clearTimeout(timer)
  }, [aiState, candidate, currentProfile, requestAiInsights, result])

  function resetDeck() { dispatch({ type: 'reset' }) }
  function updateFilter(update: () => void) { update(); dispatch({ type: 'rewind' }) }
  function saveCandidate() {
    if (!candidate) return
    dispatch({ type: 'save', id: candidate.id })
    if (!aiState) void requestAiInsights(candidate)
  }
  function swipe(action: 'pass' | 'like') {
    if (!candidate || swipeDirection) return
    setSwipeDirection(action === 'pass' ? 'left' : 'right')
    window.setTimeout(() => {
      dispatch({ type: action, id: candidate.id })
      setSwipeDirection(null)
    }, 180)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('button,input,select,a,summary')) return
    pointerStart.current = { x: event.clientX, y: event.clientY }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLElement>) {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start) return
    const horizontal = event.clientX - start.x
    const vertical = Math.abs(event.clientY - start.y)
    if (Math.abs(horizontal) < 75 || Math.abs(horizontal) < vertical * 1.25) return
    swipe(horizontal < 0 ? 'pass' : 'like')
  }

  return <main className="roommate-matching">
    <header className="rm-header">
      <div><span className="rm-mark" aria-hidden="true">⌂</span><strong>ROOMROOT</strong></div>
      <p>Hokie roommate discovery <span>· fictional demo profiles</span></p>
    </header>

    <section className="rm-shell">
      <aside className="rm-filters" aria-label="Match filters">
        <p className="rm-kicker">REFINE YOUR DECK</p>
        <h2>Find your rhythm.</h2>
        <label>City<select value={city} onChange={event => updateFilter(() => setCity(event.target.value))}>{cities.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Maximum rent <strong>{money(maxBudget)}</strong><input type="range" min="500" max="2000" step="50" value={maxBudget} onChange={event => updateFilter(() => setMaxBudget(Number(event.target.value)))} /></label>
        <label>Move in by<input type="date" value={moveInBy} onChange={event => updateFilter(() => setMoveInBy(event.target.value))} /></label>
        <label>Housing preference<select value={housingType} onChange={event => updateFilter(() => setHousingType(event.target.value))}>{housingTypes.map(value => <option key={value}>{value}</option>)}</select></label>
        <div className="rm-structural-filters"><p className="rm-kicker">BLACKSBURG HOUSING FIT</p>
          <label>What do you need?<select value={searchMode} onChange={event => updateFilter(() => setSearchMode(event.target.value))}>{['Any search mode','Has open room','Needs a room','Team up for a lease'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Total unrelated occupants<select value={occupancyCap} onChange={event => updateFilter(() => setOccupancyCap(event.target.value))}>{['Any household size','2','3','4'].map(value => <option key={value} value={value}>{value === 'Any household size' ? value : `${value} people`}</option>)}</select></label>
          <label>Campus commute<select value={transitCorridor} onChange={event => updateFilter(() => setTransitCorridor(event.target.value))}>{['Any commute corridor','Walk or bike','Hethwood','Toms Creek / UCB','North Main','South Main','Christiansburg'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Lease cycle<select value={academicTerm} onChange={event => updateFilter(() => setAcademicTerm(event.target.value))}>{['Any lease term','Spring 2027','Fall 2027','Academic year','12-month lease','Sublet'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="rm-check"><input type="checkbox" checked={privateBathroom} onChange={event => updateFilter(() => setPrivateBathroom(event.target.checked))} /> Private bathroom required</label>
        </div>
        <details className="rm-more-filters"><summary>More compatibility filters</summary>
          <label>Roommate dynamic<select value={roommateDynamic} onChange={event => updateFilter(() => setRoommateDynamic(event.target.value))}>{['Any dynamic','Friendly & communal','Independent','Study-focused','Balanced'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Household rhythm<select value={householdRhythm} onChange={event => updateFilter(() => setHouseholdRhythm(event.target.value))}>{['Any rhythm','Quiet & private','Social & communal','Balanced'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Shared meals<select value={sharedMeals} onChange={event => updateFilter(() => setSharedMeals(event.target.value))}>{['Any meal style','Often','Sometimes','Separate'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Kitchen style<select value={kitchenStyle} onChange={event => updateFilter(() => setKitchenStyle(event.target.value))}>{['Any kitchen','Vegetarian-friendly','Allergy-aware','No restrictions'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Guests<select value={guestFrequency} onChange={event => updateFilter(() => setGuestFrequency(event.target.value))}>{['Any guest frequency','Rarely','Occasionally','Frequently'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Pets<select value={petPreference} onChange={event => updateFilter(() => setPetPreference(event.target.value))}>{['Any pet preference','Have pets','Comfortable with pets','Prefer no pets'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="rm-check"><input type="checkbox" checked={smokeFree} onChange={event => updateFilter(() => setSmokeFree(event.target.checked))} /> Smoke-free household</label>
          <p className="rm-filter-note">Languages and cultural notes stay optional profile context—they never exclude or rank housing matches.</p>
        </details>
        <div className="rm-stats"><span><strong>{state.liked.length}</strong> liked</span><span><strong>{state.saved.length}</strong> saved</span></div>
      </aside>

      <div className="rm-content">
        <div className="rm-heading"><div><p className="rm-kicker">YOUR COMPATIBILITY DECK</p><h1>Meet your next roommate.</h1></div><button type="button" onClick={() => dispatch({ type: 'undo' })} disabled={!state.history.length}>↶ Undo</button></div>

        {!candidate ? <section className="rm-empty"><span aria-hidden="true">🌿</span><h2>You’ve reached the end of this deck.</h2><p>Adjust your filters or review the fictional profiles again.</p><button type="button" onClick={resetDeck}>Restart deck</button></section> :
          <article className={`rm-card${swipeDirection ? ` is-swiping-${swipeDirection}` : ''}`} tabIndex={0} aria-label={`${candidate.name} roommate match. Swipe or use arrow keys to decide.`} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onKeyDown={event => { if (event.key === 'ArrowLeft') swipe('pass'); if (event.key === 'ArrowRight') swipe('like') }}>
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
              <section className="rm-living-style"><h3>Living together</h3><dl><div><dt>Dynamic</dt><dd>{candidate.matchProfile.roommateDynamic}</dd></div><div><dt>Home vibe</dt><dd>{candidate.matchProfile.householdRhythm}</dd></div><div><dt>Meals</dt><dd>{candidate.matchProfile.sharedMeals}</dd></div><div><dt>Languages</dt><dd>{candidate.matchProfile.homeLanguages.join(' · ')}</dd></div><div><dt>Kitchen</dt><dd>{candidate.matchProfile.kitchenStyle}</dd></div></dl>{!!candidate.matchProfile.culturalNotes.length && <div className="rm-culture-notes">{candidate.matchProfile.culturalNotes.map(note => <span key={note}>{note}</span>)}</div>}<small>Shared voluntarily; not part of the match score.</small></section>
            </div>

            <div className="rm-analysis-pane">
              {!result && !deterministicError[candidate.id] && <div className="rm-loading" role="status"><span />Calculating deterministic compatibility…</div>}
              {deterministicError[candidate.id] && <div className="rm-alert" role="alert"><strong>Matching service unavailable</strong><p>{deterministicError[candidate.id]}</p></div>}
              {result && <>
                <div className="rm-score-row"><div className="rm-score" aria-label={`${result.compatibilityScore ?? 'Not enough information'} compatibility score`}>{result.compatibilityScore === null ? '—' : `${result.compatibilityScore}%`}</div><div><p className="rm-kicker">CORE COMPATIBILITY</p><h3>{result.eligible ? 'Worth a conversation' : 'Review firm constraints'}</h3></div></div>
                <p className="rm-method">Your score comes from stated preferences and dealbreakers. Smart notes only help explain what to discuss.</p>
                {!!result.hardConstraints.length && <section className="rm-alert"><h3>Dealbreakers or hard constraints</h3><ul>{result.hardConstraints.map(item => <li key={item}>{item}</li>)}</ul></section>}
                <section className="rm-domain-scores" aria-label="Compatibility score breakdown">{([['Lease & logistics', domainScore(result.breakdown, true)], ['Daily living rhythm', domainScore(result.breakdown, false)]] as const).map(([label, score]) => <div key={label}><div><strong>{label}</strong><span>{score.matched}/{score.total} aligned · {score.percent}%</span></div><progress max="100" value={score.percent}>{score.percent}%</progress></div>)}</section>
                <details className="rm-score-explainer" open><summary>How RoomRoot calculated {result.compatibilityScore === null ? 'this match' : `${result.compatibilityScore}%`}</summary><ol><li><strong>Check must-haves.</strong> Budget, dates, lease needs, and stated dealbreakers come first.</li><li><strong>Compare shared answers.</strong> RoomRoot checks lifestyle and housing expectations both people answered.</li><li><strong>Respect your priorities.</strong> Cleanliness or quiet matters more when you marked it as important.</li><li><strong>Calculate the score.</strong> Aligned priority points ÷ all comparable priority points. AI does not set or change the percentage.</li></ol></details>
                {!!result.breakdown.filter(item => !item.matches && item.weight >= 2.5 && item.seekerValue !== undefined && item.hostValue !== undefined).length && <section className="rm-mirror"><div className="rm-mirror-title"><div><p className="rm-kicker">EXPECTATION MIRROR</p><h3>Routines to coordinate</h3></div><span>Discuss first</span></div><p>Important differences, shown once and side by side.</p><div className="rm-mirror-grid">{result.breakdown.filter(item => !item.matches && item.weight >= 2.5 && item.seekerValue !== undefined && item.hostValue !== undefined).map(item => <article key={item.field}><strong>{item.field}</strong><div><span>You</span><b>{answerLabel(item.seekerValue)}</b></div><div><span>{candidate.name.split(' ')[0]}</span><b>{answerLabel(item.hostValue)}</b></div><small>{priorityLabel(item.weight)} for this match</small></article>)}</div></section>}
                <section className="rm-ai">
                  <div className="rm-ai-heading"><div><p className="rm-kicker">LIVING TOGETHER GUIDE · POWERED BY GEMMA</p><h3>How routines fit & what to ask before leasing</h3></div>{aiState?.status === 'success' && <span>Ready</span>}</div>
                  {!aiState && <div className="rm-guide-prompt"><p>Want a custom breakdown and three questions to ask {candidate.name.split(' ')[0]}?</p><button type="button" onClick={() => void requestAiInsights(candidate)}>Generate match guide</button></div>}
                  {aiState?.status === 'loading' && <div className="rm-ai-loading" role="status"><span />Building your living-together guide…</div>}
                  {aiState?.status === 'unavailable' && <><div className="rm-conversation-card"><h4>3 questions before signing a lease</h4><ul>{fallbackQuestions(result.breakdown).map(item => <li key={item}>{item}</li>)}</ul></div><button className="rm-refresh-link" type="button" onClick={() => void requestAiInsights(candidate)}>↻ Refresh custom guide</button></>}
                  {aiState?.status === 'success' && aiState.result && <>
                    <p className="rm-ai-summary">{aiState.result.summary}</p>
                    <div className="rm-ai-columns">
                      {!!aiState.result.strengths.length && <div className="rm-ai-positive"><h4>✓ Shared ground</h4><ul>{aiState.result.strengths.map(item => <li key={item}>{item}</li>)}</ul></div>}
                      {!!aiState.result.conflicts.length && <div className="rm-ai-watch"><h4>! Routines to coordinate</h4><ul>{aiState.result.conflicts.map(item => <li key={item}>{item}</li>)}</ul></div>}
                    </div>
                    {!!aiState.result.questions.length && <div className="rm-conversation-card"><h4>3 questions before signing a lease</h4><ul>{aiState.result.questions.map(item => <li key={item}>{item}</li>)}</ul></div>}
                    <details className="rm-ai-disclosure"><summary>What Gemma does here</summary><p>Gemma translates the comparison into conversation prompts. It does not rate people, change the score, verify identity, or certify safety.</p></details>
                  </>}
                </section>
                <details className="rm-aligned"><summary>See all aligned traits ({result.breakdown.filter(item => item.matches).length})</summary><div className="rm-aligned-chips">{result.breakdown.filter(item => item.matches).map(item => <span key={item.field}>✓ {item.field}</span>)}</div></details>
                {!!result.discussionItems.length && <section><h3>Needs discussion</h3><ul>{result.discussionItems.map(item => <li key={item}>{item}</li>)}</ul></section>}
                {!!result.missingInformation.length && <details><summary>Missing information ({result.missingInformation.length})</summary><ul>{result.missingInformation.map(item => <li key={item}>{item}</li>)}</ul></details>}
              </>}
            </div>
            <footer className="rm-actions">
              <button className="rm-pass" type="button" onClick={() => swipe('pass')}>✕ Pass</button>
              <button className="rm-save" type="button" aria-pressed={state.saved.includes(candidate.id)} onClick={saveCandidate}>☆ {state.saved.includes(candidate.id) ? 'Saved' : 'Save'}</button>
              <button className="rm-like" type="button" onClick={() => swipe('like')}>♡ Like</button>
            </footer>
          </article>}
      </div>
    </section>
  </main>
}
