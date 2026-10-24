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
type MatchTab = 'compatibility' | 'coffee'

const logisticsFields = new Set([
  'monthly housing budget',
  'monthly housing cost',
  'lease duration',
  'location',
  'move-in date',
  'housing type',
])

const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(value)

function groupScore(items: MatchResult['breakdown']) {
  const weight = items.reduce((total, item) => total + item.weight, 0)
  return weight
    ? Math.round(items.reduce((total, item) => total + (item.matches ? item.weight : 0), 0) / weight * 100)
    : null
}

function describeValue(value: unknown) {
  if (Array.isArray(value)) return value.join(', ')
  return value === undefined || value === null || value === '' ? 'Not shared' : String(value)
}

function createLocalGuide(candidate: FictionalRoommate, currentProfile: HousingProfileData, result: MatchResult) {
  const differences = result.breakdown.filter(item => !item.matches && !logisticsFields.has(item.field))
  const questions = differences.slice(0, 3).map(item =>
    `How would you balance ${describeValue(item.seekerValue)} and ${describeValue(item.hostValue)} around ${item.field}?`,
  )
  const backupQuestions = [
    'What quiet hours would help each of you feel comfortable at home?',
    'How much notice feels right before inviting guests over?',
    'What would a fair shared-space cleaning routine look like?',
  ]
  for (const question of backupQuestions) {
    if (questions.length === 3) break
    questions.push(question)
  }

  const rules = [
    candidate.profile.lifestyle.cleaning && `Agree on a shared-space routine; ${candidate.name} prefers ${candidate.profile.lifestyle.cleaning.toLowerCase()}.`,
    candidate.profile.lifestyle.overnight && `Talk through overnight-guest boundaries; ${candidate.name} is ${candidate.profile.lifestyle.overnight.toLowerCase()} with overnight guests.`,
    candidate.profile.lifestyle.communication && `Choose a way to raise household concerns; ${candidate.name} prefers ${candidate.profile.lifestyle.communication.toLowerCase()}.`,
    currentProfile.lifestyle.smoking && candidate.profile.lifestyle.smoking && `Make the smoking expectations explicit: your profile says “${currentProfile.lifestyle.smoking}” and ${candidate.name}'s says “${candidate.profile.lifestyle.smoking}”.`,
  ].filter((item): item is string => Boolean(item))

  return {
    summary: `${candidate.name}'s profile describes ${candidate.tagline.charAt(0).toLowerCase()}${candidate.tagline.slice(1)} Start by comparing that rhythm with your own.`,
    questions,
    rules: rules.slice(0, 3),
  }
}

export function RoommateMatching({ currentProfile, profiles = fictionalRoommates }: RoommateMatchingProps) {
  const [state, dispatch] = useReducer(discoveryReducer, initialDiscoveryState)
  const [city, setCity] = useState('All cities')
  const [maxBudget, setMaxBudget] = useState(2000)
  const [moveInBy, setMoveInBy] = useState('')
  const [housingType, setHousingType] = useState('Any housing')
  const [activeTab, setActiveTab] = useState<MatchTab>('compatibility')
  const [showAllAligned, setShowAllAligned] = useState(false)
  const [deterministic, setDeterministic] = useState<Record<string, MatchResult>>({})
  const [deterministicError, setDeterministicError] = useState<Record<string, string>>({})
  const [ai, setAi] = useState<Record<string, AiState>>({})
  const startedMatches = useRef(new Set<string>())
  const completedMatches = useRef(new Set<string>())
  const startedGuides = useRef(new Set<string>())

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
    if (!candidate || started.has(candidate.id) || completedMatches.current.has(candidate.id)) return
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
      completedMatches.current.add(id)
      setDeterministic(previous => ({ ...previous, [id]: deterministicResult }))
    }
    void loadMatch()
    return () => {
      active = false
      started.delete(id)
    }
  }, [candidate, currentProfile])

  useEffect(() => {
    if (!candidate || !result || activeTab !== 'coffee' || startedGuides.current.has(candidate.id)) return
    const id = candidate.id
    startedGuides.current.add(id)
    setAi(previous => ({ ...previous, [id]: { status: 'loading' } }))
    const request = createMatchingRequest(currentProfile, candidate.profile)
    void getCompatibilityMatch(request.seeker, request.host).then(value => {
      setAi(previous => ({
        ...previous,
        [id]: value.aiGenerated
          ? { status: 'success', result: value }
          : { status: 'unavailable', result: value, message: 'AI guidance is unavailable for this match.' },
      }))
    }).catch(error => {
      const message = error instanceof Error ? error.message : 'AI guidance is temporarily unavailable.'
      setAi(previous => ({ ...previous, [id]: { status: 'unavailable', message } }))
    })
  }, [activeTab, candidate, currentProfile, result])

  function resetDeck() { setActiveTab('compatibility'); dispatch({ type: 'reset' }) }
  function updateFilter(update: () => void) { update(); setActiveTab('compatibility'); dispatch({ type: 'rewind' }) }
  function moveDeck(action: 'like' | 'pass', id: string) {
    setActiveTab('compatibility')
    setShowAllAligned(false)
    dispatch({ type: action, id })
  }
  function selectTab(tab: MatchTab) { setActiveTab(tab) }
  function handleTabKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!candidate) return
    const tabs: MatchTab[] = ['compatibility', 'coffee']
    const currentIndex = tabs.indexOf(activeTab)
    const nextIndex = event.key === 'ArrowRight'
      ? (currentIndex + 1) % tabs.length
      : event.key === 'ArrowLeft'
        ? (currentIndex - 1 + tabs.length) % tabs.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabs.length - 1
            : -1
    if (nextIndex < 0) return
    event.preventDefault()
    const nextTab = tabs[nextIndex]!
    setActiveTab(nextTab)
    document.getElementById(`rm-tab-${nextTab}`)?.focus()
  }

  return <main className="roommate-matching">
    <header className="rm-header">
      <div><span className="rm-mark" aria-hidden="true">⌂</span><strong>ROOMROOT</strong></div>
      <p>Roommate discovery <span>· fictional hackathon profiles</span></p>
    </header>

    <section className="rm-shell">
      <aside className="rm-filters" aria-label="Match filters">
        <div className="rm-filter-scroll">
          <p className="rm-kicker">REFINE YOUR DECK</p>
          <h2>Find your rhythm.</h2>
          <label>City<select value={city} onChange={event => updateFilter(() => setCity(event.target.value))}>{cities.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Maximum rent <strong>{money(maxBudget)}</strong><input type="range" min="700" max="2500" step="50" value={maxBudget} onChange={event => updateFilter(() => setMaxBudget(Number(event.target.value)))} /></label>
          <label>Move in by<input type="date" value={moveInBy} onChange={event => updateFilter(() => setMoveInBy(event.target.value))} /></label>
          <label>Housing preference<select value={housingType} onChange={event => updateFilter(() => setHousingType(event.target.value))}>{housingTypes.map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
        <div className="rm-stats"><span><strong>{state.liked.length}</strong> liked</span><span><strong>{state.saved.length}</strong> saved</span></div>
      </aside>

      <div className="rm-content">
        <div className="rm-heading"><div><p className="rm-kicker">YOUR COMPATIBILITY DECK</p><h1>Meet your next roommate.</h1></div><button type="button" onClick={() => { setActiveTab('compatibility'); setShowAllAligned(false); dispatch({ type: 'undo' }) }} disabled={!state.history.length}>↶ Undo</button></div>

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
                <div className="rm-score-row">
                  <div className="rm-score" aria-label={`${result.compatibilityScore ?? 'Not enough information'} compatibility score`}>{result.compatibilityScore === null ? '—' : `${result.compatibilityScore}%`}</div>
                  <div className="rm-score-copy">
                    <p className="rm-kicker">DETERMINISTIC MATCH</p>
                    <h3>{result.eligible ? 'Worth a conversation' : 'Review firm constraints'}</h3>
                    <details className="rm-scoring">
                      <summary>ⓘ How scoring works</summary>
                      <p>Calculated by RoomRoot’s weighted rules—not by AI. Shared answers are compared, and lifestyle comparisons use the average importance rating from both profiles. Dealbreakers are evaluated separately.</p>
                    </details>
                  </div>
                </div>
                <div className="rm-tabs" role="tablist" aria-label="Roommate match details" onKeyDown={handleTabKeyDown}>
                  <button id="rm-tab-compatibility" type="button" role="tab" aria-selected={activeTab === 'compatibility'} aria-controls="rm-panel-compatibility" tabIndex={activeTab === 'compatibility' ? 0 : -1} onClick={() => selectTab('compatibility')}>Compatibility &amp; rhythm</button>
                  <button id="rm-tab-coffee" type="button" role="tab" aria-selected={activeTab === 'coffee'} aria-controls="rm-panel-coffee" tabIndex={activeTab === 'coffee' ? 0 : -1} onClick={() => selectTab('coffee')}>Coffee chat &amp; house rules <span aria-hidden="true">✨</span></button>
                </div>
                <div id="rm-panel-compatibility" role="tabpanel" aria-labelledby="rm-tab-compatibility" className="rm-tab-panel" hidden={activeTab !== 'compatibility'}>
                  {!!result.hardConstraints.length && <section className="rm-alert"><h3>Dealbreakers or hard constraints</h3><ul>{result.hardConstraints.map(item => <li key={item}>{item}</li>)}</ul></section>}
                  <section className="rm-progress-group" aria-label="Compatibility overview">
                    {[
                      { label: 'Lease & logistics', items: result.breakdown.filter(item => logisticsFields.has(item.field)) },
                      { label: 'Daily living rhythm', items: result.breakdown.filter(item => !logisticsFields.has(item.field)) },
                    ].map(group => {
                      const value = groupScore(group.items)
                      return <div className="rm-progress-item" key={group.label}>
                        <div><strong>{group.label}</strong><span>{value === null ? 'Not enough shared details' : `${value}% aligned`}</span></div>
                        <progress max={100} value={value ?? 0} aria-label={`${group.label}: ${value === null ? 'not enough shared details' : `${value}% aligned`}`} />
                      </div>
                    })}
                  </section>
                  <section className="rm-expectations">
                    <h3>Expectation Mirror</h3>
                    <div className="rm-mirror-grid">{result.breakdown.filter(item => !logisticsFields.has(item.field)).slice(0, 3).map(item =>
                      <article className="rm-mirror-card" key={item.field} data-match={item.matches}>
                        <span className="rm-mirror-status">{item.matches ? 'In sync' : 'Worth a chat'}</span>
                        <h4>{item.field}</h4>
                        <p><span>You</span>{describeValue(item.seekerValue)}</p>
                        <p><span>{candidate.name.split(' ')[0]}</span>{describeValue(item.hostValue)}</p>
                      </article>,
                    )}</div>
                  </section>
                  {(() => {
                    const aligned = result.breakdown.filter(item => item.matches && !logisticsFields.has(item.field))
                    return <section className="rm-aligned-traits">
                      <button type="button" aria-expanded={showAllAligned} onClick={() => setShowAllAligned(value => !value)}>{showAllAligned ? 'Hide aligned traits' : `See all aligned traits (${aligned.length})`}</button>
                      {showAllAligned && <ul>{aligned.map(item => <li key={item.field}><strong>{item.field}</strong><span>You: {describeValue(item.seekerValue)} · {candidate.name.split(' ')[0]}: {describeValue(item.hostValue)}</span></li>)}</ul>}
                    </section>
                  })()}
                  {!!result.discussionItems.length && <section className="rm-discussion"><h3>Worth discussing</h3><ul>{result.discussionItems.map(item => <li key={item}>{item}</li>)}</ul></section>}
                  {!!result.missingInformation.length && <details className="rm-missing"><summary>Missing information ({result.missingInformation.length})</summary><ul>{result.missingInformation.map(item => <li key={item}>{item}</li>)}</ul></details>}
                </div>
                <div id="rm-panel-coffee" role="tabpanel" aria-labelledby="rm-tab-coffee" className="rm-tab-panel rm-coffee-panel" hidden={activeTab !== 'coffee'}>
                  {aiState?.status === 'loading' && <div className="rm-guide-loading" role="status"><span aria-hidden="true">✿</span><strong>Gathering the little details</strong><p>Putting together a thoughtful first conversation…</p><div className="rm-guide-progress" /></div>}
                  {aiState?.status !== 'loading' && (() => {
                    const localGuide = createLocalGuide(candidate, currentProfile, result)
                    const generated = aiState?.status === 'success' ? aiState.result : undefined
                    return <>
                      <p className="rm-kicker">A LITTLE ROOMMATE PREVIEW</p>
                      <h3 className="rm-editorial-heading">What living with {candidate.name.split(' ')[0]} may feel like</h3>
                      <p className="rm-living-summary">{generated?.summary ?? localGuide.summary}</p>
                      {aiState?.status === 'unavailable' && <p className="rm-guide-source" role="note">A profile-based guide is ready. {aiState.message}</p>}
                      <section><h4>Three questions for a coffee chat</h4><ol>{(generated?.questions.length ? generated.questions : localGuide.questions).slice(0, 3).map((question, index) => <li key={`${question}-${index}`}>{question}</li>)}</ol></section>
                      <section><h4>House rules worth discussing</h4><ul>{localGuide.rules.length ? localGuide.rules.map(rule => <li key={rule}>{rule}</li>) : <li>Talk together about shared-space routines, guests, and how you’ll raise concerns.</li>}</ul></section>
                      {generated?.strengths.length ? <section><h4>Good starting points</h4><ul>{generated.strengths.map(item => <li key={item}>{item}</li>)}</ul></section> : null}
                      {generated && <small className="rm-guide-source">AI-assisted, based on the profile details shared; a conversation starter, not a guarantee.</small>}
                    </>
                  })()}
                </div>
              </>}
            </div>
            <footer className="rm-actions">
              <button className="rm-pass" type="button" onClick={() => moveDeck('pass', candidate.id)}>✕ Pass</button>
              <button className="rm-save" type="button" aria-pressed={state.saved.includes(candidate.id)} onClick={() => dispatch({ type: 'save', id: candidate.id })}>☆ {state.saved.includes(candidate.id) ? 'Saved' : 'Save'}</button>
              <button className="rm-like" type="button" onClick={() => moveDeck('like', candidate.id)}>♡ Like</button>
            </footer>
          </article>}
      </div>
    </section>
  </main>
}
