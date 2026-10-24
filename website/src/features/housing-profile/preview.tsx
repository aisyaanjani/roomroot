import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HousingProfile } from './HousingProfile'

const root = document.getElementById('housing-profile-preview')
if (root) createRoot(root).render(<StrictMode><HousingProfile /></StrictMode>)
