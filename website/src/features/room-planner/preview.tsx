import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RoomPlanner } from './RoomPlanner'
createRoot(document.getElementById('rootspace-preview')!).render(<StrictMode><RoomPlanner /></StrictMode>)
