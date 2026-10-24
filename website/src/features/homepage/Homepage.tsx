import { useState } from 'react'
import './Homepage.css'
import heroRoom from '../../assets/roomroot-interior.svg'
import sunnyRoomScene from '../../assets/sample-room-sunlit.svg'
import quietRoomScene from '../../assets/sample-room-quiet.svg'
import gardenRoomScene from '../../assets/sample-room-garden.svg'

const ArrowUpRight = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20" className="arrow-icon">
    <path d="M5 15 15 5M6 5h9v9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const Sprout = () => (
  <svg aria-hidden="true" viewBox="0 0 32 32" className="brand-mark">
    <path d="M16 26V14m0 6c-7 0-10-4-10-10 6 0 10 2 10 8m0-2c0-6 4-10 10-10 0 6-3 10-10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CheckIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16" className="check-icon">
    <path d="m3.5 8.3 3 3 6-6.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const homes = [
  { name: 'A sunny room near the park', area: 'Northside · Example', price: '$850', detail: 'A calm home with a little garden and a shared Sunday breakfast.', tags: ['Early riser', 'Garden space'], tone: 'sage' },
  { name: 'A quiet room in a creative home', area: 'East End · Example', price: '$720', detail: 'Room to recharge, make things, and share the kitchen at your own pace.', tags: ['Quiet evenings', 'Flexible lease'], tone: 'linen' },
  { name: 'Room to grow together', area: 'Riverside · Example', price: 'Exchange', detail: 'A welcoming spare room with a shared love of plants and fresh air.', tags: ['Step-free entry', 'Pet friendly'], tone: 'moss' },
]

const communityTopics = [
  { name: 'House routines', title: 'What small routine made sharing easier?', excerpt: 'We’re thinking about a quick kitchen reset after dinner. What’s worked in your home?', secondTitle: 'How do you divide the little chores?', secondExcerpt: 'Looking for a simple way to keep everyday tasks feeling fair.', reply: 'A short tidy together made it feel easy, not like a chore.' },
  { name: 'Shared spaces', title: 'How do you make a shared living room feel like yours?', excerpt: 'We want it to feel comfortable for everyone, even with different styles.', secondTitle: 'What helps a shared space stay welcoming?', secondExcerpt: 'We’re talking about quiet corners and having friends over.', reply: 'Agreeing on a few shared basics left room for everyone’s touches.' },
  { name: 'First conversations', title: 'What’s a useful question to ask before moving in?', excerpt: 'We’re making a list of everyday things worth talking through early.', secondTitle: 'How do you bring up different schedules?', secondExcerpt: 'We’d like to compare routines before making a decision.', reply: 'Ask what a restful evening usually looks like for each person.' },
]

const roomScenes = [sunnyRoomScene, quietRoomScene, gardenRoomScene]

export function Homepage() {
  const [homePreferences, setHomePreferences] = useState({ evenings: 'quiet', schedule: 'early', downtime: 'private' })
  const [communityTopic, setCommunityTopic] = useState(communityTopics[0].name)
  const selectedCommunityTopic = communityTopics.find((topic) => topic.name === communityTopic) ?? communityTopics[0]
  const preferences = {
    evenings: { quiet: 'quiet evenings', social: 'a more social home' },
    schedule: { early: 'early starts', late: 'later schedules' },
    downtime: { shared: 'shared downtime', private: 'room to recharge' },
  }
  const conversationPrompt = `How could we make space for ${preferences.evenings[homePreferences.evenings as keyof typeof preferences.evenings]}, ${preferences.schedule[homePreferences.schedule as keyof typeof preferences.schedule]}, and ${preferences.downtime[homePreferences.downtime as keyof typeof preferences.downtime]}?`

  const setPreference = (group: keyof typeof homePreferences, value: string) => {
    setHomePreferences((current) => ({ ...current, [group]: value }))
  }

  return (
    <div className="rr-homepage">
      <main id="main" tabIndex={-1}>
        <section className="hero section-wrap" id="top" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> A more thoughtful way to share a home</div>
            <h1 id="hero-title">A little extra room can change <em>someone’s world.</em></h1>
            <p className="hero-lede">RoomRoot helps people find housing and housemates that fit their routines, needs, and the way they like to live.</p>
            <div className="hero-actions">
              <a className="button button-green" href="#browse">Find a room <ArrowUpRight /></a>
              <a className="button button-outline" href="#share-space">Share a space <ArrowUpRight /></a>
            </div>
            <div className="hero-note"><span className="note-avatars" aria-hidden="true"><span>R</span><span>M</span><span>J</span></span><span>Good homes begin with good conversations.</span></div>
          </div>
          <figure className="hero-art"><img src={heroRoom} width="960" height="760" alt="A welcoming sage-green living room with a sofa, broad window, wall art, and leafy plants" /></figure>
        </section>

        <section className="values-strip" aria-label="RoomRoot principles">
          <div><span className="value-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M19.5 4.5C11 4.5 5.3 8.4 5.3 14c0 3 2.1 5.2 5.1 5.2 5.6 0 9.1-6.1 9.1-14.7Z" /><path d="M4 21c3.3-5.2 7.1-8.1 12.3-11" /></svg></span><span>Compatibility comes first</span></div>
          <div><span className="value-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m3.5 10 8.5-7 8.5 7v10.5h-17z" /><path d="M9 20.5v-7h6v7M3.5 10h17" /></svg></span><span>Space for different needs</span></div>
          <div><span className="value-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5.5h16v11H11l-4.5 3v-3H4z" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></svg></span><span>Built around honest expectations</span></div>
        </section>

        <section className="how-section section-wrap" id="how-it-works" aria-labelledby="how-title">
          <div className="how-heading"><span className="section-kicker">A thoughtful start, step by step</span><h2 id="how-title">Room to make the <em>right fit.</em></h2><p>Get to know the space, the people, and the everyday details that make sharing work.</p></div>
          <ol className="steps-grid">
            <li id="share-space"><span className="step-number">01</span><h3>Create a profile</h3><p>If you’re sharing, describe the room, budget, location, lease length, and amenities. If you’re looking, start with what you need.</p></li>
            <li><span className="step-number">02</span><h3>Compare living preferences</h3><p>Consider schedules, quiet hours, shared spaces, guests, cleaning, pets, and accessibility needs.</p></li>
            <li><span className="step-number">03</span><h3>Discuss expectations</h3><p>Talk through the details together, ask questions, and decide whether the arrangement feels right.</p></li>
          </ol>
        </section>

        <section className="home-feeling section-wrap" aria-labelledby="feeling-title">
          <div className="feeling-heading">
            <span className="section-kicker">A small example, just for you</span>
            <h2 id="feeling-title">What does feeling at home <em>mean to you?</em></h2>
            <p>Choose a few everyday preferences and see how they might start a good conversation.</p>
          </div>
          <div className="feeling-experience">
            <div className="preference-groups">
              <fieldset className="preference-group">
                <legend>Evenings</legend>
                <div className="choice-row">
                  <label className={homePreferences.evenings === 'quiet' ? 'choice selected' : 'choice'}><input type="radio" name="evenings" value="quiet" checked={homePreferences.evenings === 'quiet'} onChange={() => setPreference('evenings', 'quiet')} /><span>Quiet &amp; cozy</span></label>
                  <label className={homePreferences.evenings === 'social' ? 'choice selected' : 'choice'}><input type="radio" name="evenings" value="social" checked={homePreferences.evenings === 'social'} onChange={() => setPreference('evenings', 'social')} /><span>Easygoing &amp; social</span></label>
                </div>
              </fieldset>
              <fieldset className="preference-group">
                <legend>Daily rhythm</legend>
                <div className="choice-row">
                  <label className={homePreferences.schedule === 'early' ? 'choice selected' : 'choice'}><input type="radio" name="schedule" value="early" checked={homePreferences.schedule === 'early'} onChange={() => setPreference('schedule', 'early')} /><span>Early starts</span></label>
                  <label className={homePreferences.schedule === 'late' ? 'choice selected' : 'choice'}><input type="radio" name="schedule" value="late" checked={homePreferences.schedule === 'late'} onChange={() => setPreference('schedule', 'late')} /><span>Later days</span></label>
                </div>
              </fieldset>
              <fieldset className="preference-group">
                <legend>Downtime</legend>
                <div className="choice-row">
                  <label className={homePreferences.downtime === 'shared' ? 'choice selected' : 'choice'}><input type="radio" name="downtime" value="shared" checked={homePreferences.downtime === 'shared'} onChange={() => setPreference('downtime', 'shared')} /><span>Time together</span></label>
                  <label className={homePreferences.downtime === 'private' ? 'choice selected' : 'choice'}><input type="radio" name="downtime" value="private" checked={homePreferences.downtime === 'private'} onChange={() => setPreference('downtime', 'private')} /><span>Room to recharge</span></label>
                </div>
              </fieldset>
            </div>
            <aside className="feeling-preview" aria-label="Fictional example conversation prompt">
              <span className="example-pill">Example prompt</span>
              <div className="preview-vignette" aria-hidden="true"><span className="vignette-window" /><span className="vignette-sun" /><span className="vignette-sofa" /><span className="vignette-plant"><i /><i /><i /></span><span className="vignette-table" /></div>
              <p className="prompt-label">A question to explore together</p>
              <p className="conversation-prompt" aria-live="polite" key={conversationPrompt}>{conversationPrompt}</p>
              <p className="fictional-note">A fictional homepage preview. No match or compatibility score is calculated.</p>
            </aside>
          </div>
        </section>

        <section className="explore-section" id="browse" aria-labelledby="browse-title">
          <div className="section-wrap">
            <div className="homes-heading"><div><span className="section-kicker">Browse rooms · Homepage preview</span><h2 id="browse-title">Find your kind of <em>home.</em></h2></div><span className="preview-badge">Room browsing is in development</span></div>
            <p className="sample-note"><span aria-hidden="true"><Sprout /></span> Fictional examples only. No exact addresses or live listings are shown.</p>
            <div className="home-cards">
              {homes.map((home, index) => (
                <article className="home-card" key={home.name}>
                  <div className="card-art"><img src={roomScenes[index]} alt="" /><span className="sample-label">Fictional example</span></div>
                  <div className="card-content"><div className="card-topline"><span className="area-label">{home.area}</span><span className="example-avatar" aria-label="Fictional example">Ex</span></div><h3>{home.name}</h3><p>{home.detail}</p><div className="tag-row">{home.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="card-bottom"><span className="price">{home.price}{home.price !== 'Exchange' && <small> / month</small>}</span><span className="card-arrow" aria-hidden="true"><ArrowUpRight /></span></div></div>
                </article>
              ))}
            </div>
            <div className="practical-tags" aria-label="Practical room details"><span>Location</span><span>Price range</span><span>Lease duration</span><span>Room amenities</span><span>Accessibility</span></div>
          </div>
        </section>

        <section className="feature-section section-wrap" aria-labelledby="features-title">
          <div className="feature-heading"><span className="section-kicker">More ways to feel at home</span><h2 id="features-title">RoomRoot, <em>by design.</em></h2><p>Build your housing profile, explore the roommate demo, and plan your space. Room browsing and community discussions remain fictional previews.</p></div>
          <div className="feature-grid">
            <article className="feature-card match-card" id="match"><span className="feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 8h5l2 4h7m2-4-3-3m3 3-3 3M4 16h5l2-4" /><circle cx="4" cy="8" r="1.4" /><circle cx="4" cy="16" r="1.4" /></svg></span><span className="feature-status">Demo available</span><h3>Lifestyle compatibility</h3><p>Match around routines, preferences, and expectations. Compare practical details that shape everyday life together:</p><div className="practical-tags match-preferences" aria-label="Practical living preferences"><span>Quiet hours</span><span>Work &amp; study schedules</span><span>Guests</span><span>Shared spaces</span><span>Cleaning</span><span>Pets</span><span>Smoking preferences</span><span>Accessibility needs</span><span>Budget</span><span>Location</span><span>Lease length</span><span>Room amenities</span></div><div className="mirror-preview"><span>Expectation Mirror</span><span className="mirror-lines"><i /><i /><i /></span><span className="mirror-hint">Questions to talk through together</span></div><p className="match-question"><strong>For example:</strong> “What are quiet hours for you?” or “How should we plan guests and kitchen clean-up?”</p><a className="feature-link" href="#matches">Explore roommate matching <ArrowUpRight /></a></article>
            <article className="feature-card community-card" id="community" aria-labelledby="community-title">
              <span className="feature-icon community-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 6.5h14v9H11l-4 3v-3H5z" /><path d="M9 10.5h.01M12 10.5h.01M15 10.5h.01" strokeWidth="2.4" /></svg></span>
              <span className="feature-status">Planned feature · example preview</span>
              <h3 id="community-title">Anonymous community</h3>
              <p>A thoughtful space for shared-housing questions and neighborly advice.</p>
              <fieldset className="community-topics">
                <legend>Browse a conversation</legend>
                {communityTopics.map((topic) => <label className={communityTopic === topic.name ? 'topic-chip selected' : 'topic-chip'} key={topic.name}><input type="radio" name="community-topic" value={topic.name} checked={communityTopic === topic.name} onChange={(event) => setCommunityTopic(event.currentTarget.value)} /><span>{topic.name}</span></label>)}
              </fieldset>
              <div className="community-post" aria-live="polite" aria-atomic="true">
                <span className="post-example-label">Fictional post · {selectedCommunityTopic.name}</span>
                <h4 key={`${selectedCommunityTopic.name}-title`}>{selectedCommunityTopic.title}</h4>
                <p key={`${selectedCommunityTopic.name}-excerpt`}>{selectedCommunityTopic.excerpt}</p>
                <div className="sample-reply"><span>Example reply</span><p key={`${selectedCommunityTopic.name}-reply`}>{selectedCommunityTopic.reply}</p></div>
              </div>
              <div className="community-post community-post-secondary" aria-live="polite" aria-atomic="true">
                <span className="post-example-label">Another fictional post · {selectedCommunityTopic.name}</span>
                <h4 key={`${selectedCommunityTopic.name}-second-title`}>{selectedCommunityTopic.secondTitle}</h4>
                <p key={`${selectedCommunityTopic.name}-second-excerpt`}>{selectedCommunityTopic.secondExcerpt}</p>
              </div>
              <p className="community-reminder">Keep it kind and protect privacy: don’t share names, exact addresses, or identifying details. No forum, anonymity, moderation, or reporting features are live in this preview.</p>
              <a className="feature-link" href="#safety">Community values <ArrowUpRight /></a>
            </article>
            <article className="feature-card profile-card" id="profile-preview"><span className="feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4.5" y="4" width="15" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M7 15c.5-1.3 1.2-2 2-2s1.5.7 2 2m2-5h3m-3 3h3" /></svg></span><span className="feature-status">Demo available</span><h3>Housing profile</h3><p>Bring your needs, preferences, and questions into one useful starting point.</p><div className="profile-preview" aria-hidden="true"><span><b><CheckIcon /></b> Quiet hours &amp; schedule</span><span><b><CheckIcon /></b> Accessibility &amp; amenities</span><span><b><CheckIcon /></b> Shared-space preferences</span></div><a className="feature-link" href="#profile">Build your housing profile <ArrowUpRight /></a></article>
            <article className="feature-card viewer-card" id="room-viewer"><span className="feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" /><path d="m4.5 7.8 7.5 4.4 7.5-4.4M12 12.2V21" /></svg></span><span className="feature-status">Demo available</span><h3>3D room viewer</h3><p>Imagine how a room might feel and explore ways to make it your own.</p><div className="room-preview" aria-hidden="true"><span className="room-back" /><span className="room-floor" /><span className="room-window" /><span className="room-plant"><i /><i /><i /></span><span className="room-chair" /></div><a className="feature-link" href="#planner">Open RootSpace <ArrowUpRight /></a></article>
          </div>
        </section>

        <section className="trust-section section-wrap" id="safety" aria-labelledby="trust-title">
          <div className="trust-illustration" aria-hidden="true"><div className="trust-circle"><span className="trust-symbol"><Sprout /></span></div><div className="trust-plant"><i /><i /><i /><b /></div></div>
          <div className="trust-copy"><span className="section-kicker">Trust grows with care</span><h2 id="trust-title">Good boundaries make <em>good beginnings.</em></h2><p>Sharing a home takes trust. RoomRoot is being built around privacy, honest agreements, and respectful conversation.</p><ul className="trust-list"><li><span aria-hidden="true"><CheckIcon /></span><span><strong>Privacy-conscious by design</strong><small>Share useful housing preferences without putting private details on display.</small></span></li><li><span aria-hidden="true"><CheckIcon /></span><span><strong>Clear agreements</strong><small>Make room for a direct conversation about house expectations before deciding.</small></span></li><li><span aria-hidden="true"><CheckIcon /></span><span><strong>Respectful community</strong><small>Community guidelines and reporting or moderation tools are product goals.</small></span></li></ul><p className="trust-footnote">These are goals for RoomRoot as it develops, not a promise that these services are already available.</p></div>
        </section>

        <section className="closing-cta" id="get-started" aria-labelledby="cta-title">
          <div className="cta-orbit orbit-one" /><div className="cta-orbit orbit-two" />
          <div className="cta-content"><span className="section-kicker">There’s room for a better fit</span><h2 id="cta-title">Let’s make space<br />for <em>belonging.</em></h2><p>Start with the details that make a place feel like home.</p><div className="hero-actions cta-actions"><a className="button button-cream" href="#browse">Find a room <ArrowUpRight /></a><a className="button button-ghost" href="#share-space">Share a space <ArrowUpRight /></a></div></div>
        </section>
      </main>

      <footer className="site-footer"><div className="footer-main"><a className="brand footer-brand" href="#top"><span className="brand-icon"><Sprout /></span><span>roomroot</span></a><p>A little more room for everyone.</p><nav aria-label="Footer navigation"><a href="#browse">Browse rooms</a><a href="#matches">Match</a><a href="#community">Community</a><a href="#how-it-works">How it works</a></nav><a className="footer-top" href="#top">Back to top ↑</a></div><div className="footer-bottom"><span>© 2026 RoomRoot. Made for a more connected kind of home.</span><span>Thoughtful sharing starts here.</span></div></footer>
    </div>
  )
}
