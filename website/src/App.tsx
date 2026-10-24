import { lazy, Suspense, useEffect, useState } from 'react'
import { HousingProfile, loadHousingProfile, validateSection } from './features/housing-profile'
import { RoommateMatching } from './features/roommate-matching'
import { Homepage } from './features/homepage/Homepage'
import { SiteNavigation } from './features/homepage/SiteNavigation'
import './App.css'

const RoomPlanner = lazy(() => import('./features/room-planner').then(module => ({ default: module.RoomPlanner })))
const featureRoutes = ['profile', 'matches', 'planner'] as const
const readHash = () => window.location.hash.slice(1) || 'home'

function App() {
  const [hash, setHash] = useState(readHash)
  const route = featureRoutes.some(value => value === hash) ? hash : 'home'
  useEffect(() => {
    const update = () => setHash(readHash())
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = route === 'home' && hash !== 'home' ? document.getElementById(hash) : null
      if (target) target.scrollIntoView({ block: 'start' })
      else window.scrollTo(0, 0)
    })
    return () => cancelAnimationFrame(frame)
  }, [hash, route])
  // Re-read the saved envelope on route entry; never treat incomplete drafts as matches.
  const draft = loadHousingProfile()
  const ready = draft?.completed && Array.from({ length: 6 }, (_, i) => validateSection(draft.profile, i)).every(issues => issues.length === 0)
  return <>
    <SiteNavigation route={route} />
    <div id="feature-content" tabIndex={-1}>
      {route === 'home' && <Homepage />}
      {route === 'profile' && <><HousingProfile /><p className="rr-next"><a href="#matches">Continue to roommate matching →</a></p></>}
      {route === 'matches' && (ready && draft ? <RoommateMatching currentProfile={draft.profile} /> : <main className="rr-next"><h1>Your next chapter starts here.</h1><p>Complete your housing profile to explore the fictional roommate demo.</p><a href="#profile">Complete housing profile →</a></main>)}
      {route === 'planner' && <Suspense fallback={<p className="rr-next" role="status">Loading room planner…</p>}><RoomPlanner /></Suspense>}
    </div>
  </>
}
export default App
