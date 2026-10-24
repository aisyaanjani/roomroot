import { lazy, Suspense, useEffect, useState } from 'react'
import { HousingProfile, loadHousingProfile, validateSection } from './features/housing-profile'
import { RoommateMatching } from './features/roommate-matching'
import './App.css'

const RoomPlanner = lazy(() => import('./features/room-planner').then(module => ({ default: module.RoomPlanner })))
const routes = ['home', 'profile', 'matches', 'planner'] as const
type Route = typeof routes[number]
const readRoute = (): Route => {
  const value = window.location.hash.slice(1)
  return routes.includes(value as Route) ? value as Route : 'home'
}

function App() {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    const update = () => setRoute(readRoute())
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  const draft = loadHousingProfile()
  const ready = draft?.completed && Array.from({ length: 6 }, (_, i) => validateSection(draft.profile, i)).every(issues => issues.length === 0)
  return <>
    <nav className="rr-nav" aria-label="Main navigation">
      <a href="#home">RoomRoot 🌱</a>
      <a href="#profile" aria-current={route === 'profile' ? 'page' : undefined}>Housing profile</a>
      <a href="#matches" aria-current={route === 'matches' ? 'page' : undefined}>Find roommates</a>
      <a href="#planner" aria-current={route === 'planner' ? 'page' : undefined}>Room planner</a>
    </nav>
    {route === 'home' && <Home />}
    {route === 'profile' && <><HousingProfile /><p className="rr-next"><a href="#matches">Continue to roommate matching →</a></p></>}
    {route === 'matches' && (ready && draft ? <RoommateMatching currentProfile={draft.profile} /> : <main className="rr-next"><h1>Your next chapter starts here.</h1><p>Complete your housing profile to explore the fictional roommate demo.</p><a href="#profile">Complete housing profile →</a></main>)}
    {route === 'planner' && <Suspense fallback={<p role="status">Loading room planner…</p>}><RoomPlanner /></Suspense>}
  </>
}


function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: '#F7F5EF',
      padding: '80px 24px',
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#46634B', fontSize: '52px' }}>
        RoomRoot 🌱
      </h1>

      <h2 style={{ color: '#333' }}>
        A home starts with connection.
      </h2>

      <p style={{ color: '#666', fontSize: '18px' }}>
        Making affordable shared housing more accessible
        through AI-powered lifestyle compatibility.
      </p>

      <button onClick={() => { window.location.hash = 'profile' }} style={{
        backgroundColor: '#46634B',
        color: 'white',
        padding: '14px 28px',
        border: 'none',
        borderRadius: '12px',
        marginTop: '24px',
        cursor: 'pointer'
      }}>
        Find Your Room
      </button>
    </main>
  )
}

export default App