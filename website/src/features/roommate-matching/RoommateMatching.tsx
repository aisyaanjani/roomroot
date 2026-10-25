import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { HousingProfileData } from '../housing-profile'
import type { MatchResult } from '../../services/matchingApi'
import { createMatchingRequest } from './adapter'
import { chatReducer, loadChatState, saveChatState, unreadMessageCount } from './chatState'
import type { ChatAction, ChatConversation, ChatMessage, ChatState } from './chatState'
import { calculateLocalMatch } from './deterministicMatching'
import { fictionalRoommates } from './demoProfiles'
import type { FictionalRoommate } from './demoProfiles'
import { discoveryReducer, loadDiscoveryState, saveDiscoveryState } from './discoveryState'
import './RoommateMatching.css'
import './RoommateMatchingEnhancements.css'

export interface RoommateMatchingProps {
  currentProfile: HousingProfileData
  profiles?: FictionalRoommate[]
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
const messageTime = (value: string) => new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}).format(new Date(value))

const simulatedReplies: Record<string, string[]> = {
  maya: [
    'That sounds lovely. I usually plan a shared dinner once or twice a week, but no pressure if schedules get busy.',
    'I appreciate you asking! A quick heads-up about guests and quiet hours works really well for me.',
  ],
  jordan: [
    'Hey, great question! I’m usually up for a relaxed game night, and I’m happy to coordinate around everyone’s schedule.',
    'Totally fair. Let’s make a simple plan for shared spaces so it feels easy for everybody.',
  ],
  priya: [
    'Thanks for bringing that up. Calm evenings and clear plans are important to me too.',
    'I’d be glad to talk through a routine that works for both of us before making any decisions.',
  ],
  leo: [
    'That sounds good! I’m pretty flexible and always happy to compare notes over coffee.',
    'Thanks for checking in. A little communication ahead of time makes shared plans much easier.',
  ],
  sam: [
    'I like that idea. I’m always up for figuring out a cozy routine that leaves room for everyone’s projects.',
    'That makes sense. We can keep it simple and check in if something needs adjusting.',
  ],
  aisha: [
    'Thanks for asking. A clear plan and a little notice are what work best for me.',
    'I appreciate the thoughtful question. I’m happy to agree on a routine together.',
  ],
  noah: [
    'Sounds good to me. I’m pretty easygoing, so just let me know what works for your schedule.',
    'Thanks for checking! A quick text beforehand is usually perfect for me.',
  ],
  elena: [
    'I’m glad you brought that up. Shared expectations make a home feel much more comfortable.',
    'That works for me. We can agree on a routine and revisit it if anything changes.',
  ],
}

const logisticsFields = new Set(['monthly housing budget', 'monthly housing cost', 'lease duration', 'location', 'move-in date', 'housing type'])

type ChatView = { screen: 'inbox' } | { screen: 'chat'; roommateId: string; returnTo: 'inbox' | 'matches' }

function domainScore(items: MatchResult['breakdown'], logistics: boolean) {
  const selected = items.filter(item => logisticsFields.has(item.field) === logistics)
  const matched = selected.filter(item => item.matches).length
  return { matched, total: selected.length, percent: selected.length ? Math.round((matched / selected.length) * 100) : 0 }
}

export function RoommateMatching({ currentProfile, profiles = fictionalRoommates }: RoommateMatchingProps) {
  const [state, dispatch] = useReducer(discoveryReducer, currentProfile, loadDiscoveryState)
  const [chatState, setChatState] = useState<ChatState>(() => loadChatState(currentProfile))
  const chatStateRef = useRef(chatState)
  const activeChatIdRef = useRef<string | null>(null)
  const messageEndRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLInputElement>(null)
  const inboxHeadingRef = useRef<HTMLHeadingElement>(null)
  const matchHeadingRef = useRef<HTMLHeadingElement>(null)
  const newMatchHeadingRef = useRef<HTMLHeadingElement>(null)
  const [chatView, setChatView] = useState<ChatView | null>(null)
  const [newlyMatched, setNewlyMatched] = useState<FictionalRoommate | null>(null)
  const [chatStorageUnavailable, setChatStorageUnavailable] = useState(false)
  const [messageDraft, setMessageDraft] = useState('')
  const [storageUnavailable, setStorageUnavailable] = useState(false)
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
  const [analysisTab, setAnalysisTab] = useState<'compatibility' | 'guide'>('compatibility')
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)
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
  const request = candidate ? createMatchingRequest(currentProfile, candidate.profile) : undefined
  const result = request ? calculateLocalMatch(request.seeker, request.host) : undefined
  const unreadCount = unreadMessageCount(chatState)
  const activeConversation = chatView?.screen === 'chat'
    ? chatState.conversations.find(item => item.roommateId === chatView.roommateId)
    : undefined

  useEffect(() => {
    if (chatView?.screen === 'chat') {
      messageEndRef.current?.scrollIntoView({ block: 'nearest' })
      messageInputRef.current?.focus()
    } else if (chatView?.screen === 'inbox') {
      inboxHeadingRef.current?.focus()
    }
  }, [activeConversation?.messages.length, chatView])

  useEffect(() => {
    if (newlyMatched) newMatchHeadingRef.current?.focus()
  }, [newlyMatched])

  function applyAction(action: Parameters<typeof discoveryReducer>[1]) {
    const next = discoveryReducer(state, action)
    dispatch(action)
    setStorageUnavailable(!saveDiscoveryState(currentProfile, next))
  }

  function applyChatAction(action: ChatAction) {
    const next = chatReducer(chatStateRef.current, action)
    chatStateRef.current = next
    setChatState(next)
    setChatStorageUnavailable(!saveChatState(currentProfile, next))
  }

  function openInbox() {
    activeChatIdRef.current = null
    setChatView({ screen: 'inbox' })
  }

  function openConversation(conversation: ChatConversation, fromInbox: boolean) {
    activeChatIdRef.current = conversation.roommateId
    applyChatAction({ type: 'read', roommateId: conversation.roommateId })
    setChatView({ screen: 'chat', roommateId: conversation.roommateId, returnTo: fromInbox ? 'inbox' : 'matches' })
    if (!fromInbox) setNewlyMatched(null)
  }

  function startChat(roommate: FictionalRoommate) {
    applyChatAction({ type: 'start', roommateId: roommate.id, roommateName: roommate.name })
    const conversation = chatStateRef.current.conversations.find(item => item.roommateId === roommate.id)
      ?? { roommateId: roommate.id, roommateName: roommate.name, messages: [] }
    openConversation(conversation, false)
  }

  function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = messageDraft.trim()
    if (!text || !activeConversation) return
    const roommateId = activeConversation.roommateId
    const createMessage = (sender: ChatMessage['sender'], content: string, unread = false): ChatMessage => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sender,
      text: content,
      createdAt: new Date().toISOString(),
      unread,
    })
    applyChatAction({ type: 'send', roommateId, message: createMessage('you', text) })
    setMessageDraft('')
    window.setTimeout(() => {
      const current = chatStateRef.current.conversations.find(item => item.roommateId === roommateId)
      if (!current) return
      const replies = simulatedReplies[roommateId] ?? ['Thanks for the message! I’m happy to talk through what makes a shared home feel comfortable.']
      const replyNumber = current.messages.filter(message => message.sender === 'roommate').length
      applyChatAction({
        type: 'reply',
        roommateId,
        message: createMessage('roommate', replies[replyNumber % replies.length], activeChatIdRef.current !== roommateId),
      })
    }, 450)
  }

  function resetDeck() { setNewlyMatched(null); setAnalysisTab('compatibility'); applyAction({ type: 'reset' }) }
  function updateFilter(update: () => void) { update(); setAnalysisTab('compatibility'); applyAction({ type: 'rewind' }) }
  function openGuide() {
    if (!candidate) return
    setAnalysisTab('guide')
  }
  function saveCandidate() {
    if (!candidate) return
    applyAction({ type: 'save', id: candidate.id })
  }
  function swipe(action: 'pass' | 'like') {
    if (!candidate || swipeDirection) return
    setNewlyMatched(null)
    setSwipeDirection(action === 'pass' ? 'left' : 'right')
    window.setTimeout(() => {
      applyAction({ type: action, id: candidate.id })
      setAnalysisTab('compatibility')
      if (action === 'like') setNewlyMatched(candidate)
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
          <fieldset className="rm-pill-field"><legend>What do you need?</legend><div>{[['Any search mode','Any'],['Has open room','Has room'],['Needs a room','Needs room'],['Team up for a lease','Team up']].map(([value,label]) => <button type="button" key={value} aria-pressed={searchMode === value} onClick={() => updateFilter(() => setSearchMode(value))}>{label}</button>)}</div></fieldset>
          <fieldset className="rm-pill-field"><legend>Total unrelated occupants</legend><div>{[['Any household size','Any'],['2','2 max'],['3','3 max'],['4','4 max']].map(([value,label]) => <button type="button" key={value} aria-pressed={occupancyCap === value} onClick={() => updateFilter(() => setOccupancyCap(value))}>{label}</button>)}</div></fieldset>
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
        <div className="rm-heading">
          <div><p className="rm-kicker">YOUR COMPATIBILITY DECK · LOCAL SCORING</p><h1 ref={matchHeadingRef} tabIndex={-1}>Meet your next roommate.</h1></div>
          <div className="rm-heading-actions">
            <button type="button" className="rm-inbox-button" onClick={openInbox}>Inbox{unreadCount > 0 && <span className="rm-unread-count" aria-label={`${unreadCount} unread messages`}>{unreadCount}</span>}</button>
            <button type="button" onClick={() => { setAnalysisTab('compatibility'); applyAction({ type: 'undo' }) }} disabled={!state.history.length}>↶ Undo</button>
          </div>
        </div>
        {storageUnavailable && <aside className="rm-unavailable" role="status"><strong>Actions could not be saved on this device.</strong><p>Like, Pass, Save, and Undo still work for this visit, but browser storage is unavailable.</p></aside>}
        {chatStorageUnavailable && <aside className="rm-unavailable" role="status"><strong>Chats could not be saved on this device.</strong><p>You can continue this conversation during this visit, but browser storage is unavailable.</p></aside>}

        {chatView ? chatView.screen === 'inbox' ? <section className="rm-chat-panel rm-inbox-panel" aria-labelledby="rm-inbox-title">
          <div className="rm-chat-panel-heading"><div><p className="rm-kicker">FICTIONAL DEMO · SAVED ON THIS DEVICE</p><h2 id="rm-inbox-title" ref={inboxHeadingRef} tabIndex={-1}>Your inbox</h2><p>These simulated conversations are only for this demo. No real person receives messages.</p></div><button type="button" onClick={() => { setChatView(null); matchHeadingRef.current?.focus() }}>Back to matches</button></div>
          {chatState.conversations.length ? <ul className="rm-inbox-list">{chatState.conversations.map(conversation => {
            const latest = conversation.messages.at(-1)
            const unread = conversation.messages.filter(message => message.sender === 'roommate' && message.unread).length
            return <li key={conversation.roommateId}><button type="button" onClick={() => openConversation(conversation, true)} aria-label={`Open conversation with ${conversation.roommateName}${unread ? `, ${unread} unread messages` : ''}`}>
              <span className="rm-inbox-avatar" aria-hidden="true">{conversation.roommateName.split(' ').map(part => part[0]).join('')}</span>
              <span className="rm-inbox-copy"><strong>{conversation.roommateName}</strong><small>{latest ? latest.text : 'Conversation started — say hello!'}</small></span>
              <span className="rm-inbox-meta">{latest && <time dateTime={latest.createdAt}>{messageTime(latest.createdAt)}</time>}{unread > 0 && <b className="rm-unread-count">{unread}</b>}</span>
            </button></li>
          })}</ul> : <div className="rm-chat-empty"><span aria-hidden="true">☕</span><h3>Your inbox is ready when you are.</h3><p>Like a fictional roommate, then choose Start chat to open a simulated conversation.</p><button type="button" onClick={() => setChatView(null)}>Browse matches</button></div>}
        </section> : activeConversation ? <section className="rm-chat-panel rm-conversation-panel" aria-labelledby="rm-chat-title">
          <div className="rm-chat-panel-heading rm-conversation-heading">
            <div><p className="rm-kicker">SIMULATED CONVERSATION · FICTIONAL DEMO</p><h2 id="rm-chat-title">{activeConversation.roommateName}</h2></div>
            <button type="button" onClick={() => {
              if (chatView.returnTo === 'inbox') {
                activeChatIdRef.current = null
                setChatView({ screen: 'inbox' })
              }
              else { activeChatIdRef.current = null; setChatView(null); matchHeadingRef.current?.focus() }
            }}>{chatView.returnTo === 'inbox' ? 'Back to inbox' : 'Back to matches'}</button>
          </div>
          <p className="rm-chat-disclaimer">Your messages stay in this browser. Replies are predefined simulations—not AI and not sent to a real person.</p>
          <div className="rm-chat-messages" role="log" aria-label={`Simulated messages with ${activeConversation.roommateName}`} aria-relevant="additions text">
            {activeConversation.messages.length ? activeConversation.messages.map(message => <article key={message.id} className={`rm-chat-message rm-message-${message.sender}`}>
              <div className="rm-message-label">{message.sender === 'you' ? 'You' : `Simulated reply · ${activeConversation.roommateName}`}{message.unread && <span className="rm-message-unread">Unread</span>}</div>
              <p>{message.text}</p>
              <time dateTime={message.createdAt}>{messageTime(message.createdAt)}</time>
            </article>) : <p className="rm-chat-first-message">Say hello to {activeConversation.roommateName}. This is a simulated chat with no real recipient.</p>}
            <div ref={messageEndRef} />
          </div>
          <form className="rm-chat-compose" onSubmit={sendMessage}>
            <label htmlFor="rm-chat-input">Your message</label>
            <div><input id="rm-chat-input" ref={messageInputRef} value={messageDraft} onChange={event => setMessageDraft(event.target.value)} maxLength={1000} autoComplete="off" placeholder={`Write a message to ${activeConversation.roommateName}…`} /><button type="submit" disabled={!messageDraft.trim()}>Send</button></div>
            <small>Up to 1,000 characters · Enter to send</small>
          </form>
        </section> : <section className="rm-empty" role="status"><h2>This conversation is unavailable.</h2><button type="button" onClick={openInbox}>Return to inbox</button></section> : <>
        {newlyMatched && <section className="rm-match-notice" aria-labelledby="rm-match-title">
          <div className="rm-match-avatar" aria-hidden="true">{newlyMatched.initials}</div>
          <div className="rm-match-copy"><p className="rm-kicker">SIMULATED MUTUAL MATCH · FICTIONAL DEMO</p><h2 id="rm-match-title" ref={newMatchHeadingRef} tabIndex={-1}>You and {newlyMatched.name} matched!</h2><p>This is a simulated match for this demo. No real person is notified, and no real person receives messages.</p></div>
          <div className="rm-match-actions"><button type="button" className="rm-match-start" onClick={() => startChat(newlyMatched)}>Start chat</button><button type="button" className="rm-match-dismiss" onClick={() => setNewlyMatched(null)}>Keep matching</button></div>
        </section>}
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
              {result && <>
                <div className="rm-score-row"><div className="rm-score" aria-label={`${result.compatibilityScore ?? 'Not enough information'} compatibility score`}>{result.compatibilityScore === null ? '—' : `${result.compatibilityScore}%`}</div><div><p className="rm-kicker">CORE COMPATIBILITY</p><h3>{result.eligible ? 'Worth a conversation' : 'Review firm constraints'}</h3></div></div>
                <p className="rm-method">This score is calculated locally from stated profile preferences and dealbreakers. It is deterministic, not AI-generated.</p>
                {!!result.hardConstraints.length && <section className="rm-alert"><h3>Dealbreakers or hard constraints</h3><ul>{result.hardConstraints.map(item => <li key={item}>{item}</li>)}</ul></section>}
                <div className="rm-analysis-tabs" role="tablist" aria-label="Match details"><button type="button" role="tab" aria-selected={analysisTab === 'compatibility'} onClick={() => setAnalysisTab('compatibility')}>Compatibility & rhythm</button><button type="button" role="tab" aria-selected={analysisTab === 'guide'} onClick={openGuide}>Coffee chat & house rules ✨</button></div>
                {analysisTab === 'compatibility' ? <div role="tabpanel" className="rm-tab-panel">
                  <section className="rm-domain-scores" aria-label="Compatibility score breakdown">{([['Lease & logistics', domainScore(result.breakdown, true)], ['Daily living rhythm', domainScore(result.breakdown, false)]] as const).map(([label, score]) => <div key={label}><div><strong>{label}</strong><span>{score.matched}/{score.total} aligned · {score.percent}%</span></div><progress max="100" value={score.percent}>{score.percent}%</progress></div>)}</section>
                  <details className="rm-score-explainer"><summary>ⓘ How RoomRoot calculated {result.compatibilityScore === null ? 'this match' : `${result.compatibilityScore}%`}</summary><ol><li><strong>Check must-haves.</strong> Budget, dates, lease needs, and stated dealbreakers come first.</li><li><strong>Compare shared answers.</strong> RoomRoot checks lifestyle and housing expectations both people answered.</li><li><strong>Respect your priorities.</strong> Cleanliness or quiet matters more when you marked it as important.</li><li><strong>Calculate the score.</strong> Aligned priority points ÷ all comparable priority points. AI does not set or change the percentage.</li></ol></details>
                  {!!result.breakdown.filter(item => !item.matches && item.weight >= 2.5 && item.seekerValue !== undefined && item.hostValue !== undefined).length && <section className="rm-mirror"><div className="rm-mirror-title"><div><p className="rm-kicker">EXPECTATION MIRROR</p><h3>Routines to coordinate</h3></div><span>Discuss first</span></div><p>Important differences, shown once and side by side.</p><div className="rm-mirror-grid">{result.breakdown.filter(item => !item.matches && item.weight >= 2.5 && item.seekerValue !== undefined && item.hostValue !== undefined).map(item => <article key={item.field}><strong>{item.field}</strong><div><span>You</span><b>{answerLabel(item.seekerValue)}</b></div><div><span>{candidate.name.split(' ')[0]}</span><b>{answerLabel(item.hostValue)}</b></div><small>{priorityLabel(item.weight)} for this match</small></article>)}</div></section>}
                  <details className="rm-aligned"><summary>See all aligned traits ({result.breakdown.filter(item => item.matches).length})</summary><div className="rm-aligned-chips">{result.breakdown.filter(item => item.matches).map(item => <span key={item.field}>✓ {item.field}</span>)}</div></details>
                  {!!result.discussionItems.length && <section><h3>Needs discussion</h3><ul>{result.discussionItems.map(item => <li key={item}>{item}</li>)}</ul></section>}
                  {!!result.missingInformation.length && <details><summary>Missing information ({result.missingInformation.length})</summary><ul>{result.missingInformation.map(item => <li key={item}>{item}</li>)}</ul></details>}
                </div> : <section className="rm-ai rm-ai-editorial" role="tabpanel">
                  <div className="rm-ai-heading"><div><p className="rm-kicker">COFFEE CHAT & HOUSE RULES</p><h3>AI conversation guidance is turned off</h3></div></div>
                  <p className="rm-ai-disabled">Personalized AI conversation guidance requires a backend AI-provider request. No AI-generated notes or fallback results are shown in this release; compatibility scoring and deck actions remain available locally.</p>
                </section>}
              </>}
            </div>
            <footer className="rm-actions">
              <button className="rm-pass" type="button" onClick={() => swipe('pass')}>✕ Pass</button>
              <button className="rm-save" type="button" aria-pressed={state.saved.includes(candidate.id)} onClick={saveCandidate}>☆ {state.saved.includes(candidate.id) ? 'Saved' : 'Save'}</button>
              <button className="rm-like" type="button" onClick={() => swipe('like')}>♡ Like</button>
            </footer>
          </article>}
        </>}
      </div>
    </section>
  </main>
}
