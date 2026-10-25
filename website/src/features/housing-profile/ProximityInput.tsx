import { useState } from 'react'
import { PROXIMITY_CHOICES } from './locationData'

const landmarks = PROXIMITY_CHOICES.filter(value => value !== 'Other' && value !== 'No specific landmark')
function modeFor(value: string) { return landmarks.includes(value as typeof landmarks[number]) ? value : value ? 'Other' : 'No specific landmark' }

export function ProximityInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [mode, setMode] = useState(() => modeFor(value))
  const selectedMode = mode === 'Other' && !landmarks.includes(value as typeof landmarks[number]) ? 'Other' : modeFor(value)
  return <fieldset className="hp-field">
    <legend>Need to be near · optional</legend>
    <p className="hp-field-description">This helps estimate commute fit. Do not enter an exact home address.</p>
    <select aria-label="Need to be near" value={selectedMode} onChange={event => { const next = event.target.value; setMode(next); if (next === 'No specific landmark') onChange(''); else if (next !== 'Other') onChange(next) }}>
      {PROXIMITY_CHOICES.map(option => <option key={option}>{option}</option>)}
    </select>
    {selectedMode === 'Other' && <input aria-label="Other landmark or workplace" value={value} placeholder="Landmark, campus, or workplace" onChange={event => onChange(event.target.value)} />}
  </fieldset>
}
