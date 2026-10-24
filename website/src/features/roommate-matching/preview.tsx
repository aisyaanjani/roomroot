import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RoommateMatching } from './RoommateMatching'
import { createPreviewProfile } from './previewProfile'
import './Preview.css'

const currentProfile = createPreviewProfile()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="rm-preview">
      <aside className="rm-preview-notice" role="note">
        <strong>Isolated development preview</strong>
        <span>Current seeker: Alex Morgan — fictional completed Housing Profile</span>
      </aside>
      <RoommateMatching currentProfile={currentProfile} />
    </div>
  </StrictMode>,
)
