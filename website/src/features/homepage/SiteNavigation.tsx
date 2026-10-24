import './Homepage.css'

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

export function SiteNavigation({route}:{route:string}){return <div className="rr-homepage rr-navigation">
      <a className="skip-link" onClick={event=>{event.preventDefault();const target=document.getElementById(route==='home'?'main':'feature-content');target?.focus();target?.scrollIntoView({block:'start'})}} href={route === 'home' ? '#main' : '#feature-content'}>Skip to content</a>
      <header className="site-header">
        <div className="nav-wrap">
          <a className="brand" href="#home" aria-label="RoomRoot home"><span className="brand-icon"><Sprout /></span><span>roomroot</span></a>
          <nav aria-label="Main navigation" className="main-nav">
            <a href="#rooms" aria-current={route === 'rooms' ? 'page' : undefined}>Browse Rooms</a>
            <a href="#matches" aria-current={route === 'matches' ? 'page' : undefined}>Match</a>
            <a href="#profile" aria-current={route === 'profile' ? 'page' : undefined}>Housing Profile</a>
            <a href="#planner" aria-current={route === 'planner' ? 'page' : undefined}>RootSpace</a>
            <a href="#community">Community</a>
            <a href="#how-it-works">How it works</a>
          </nav>
          <a className="button button-small button-green nav-cta" href="#profile">Get started <ArrowUpRight /></a>
        </div>
      </header>

</div>}
