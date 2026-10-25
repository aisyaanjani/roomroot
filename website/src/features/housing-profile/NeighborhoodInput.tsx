import { useState } from 'react'
import { BLACKSBURG_NEIGHBORHOODS } from './locationData'
import { addNeighborhood, parseNeighborhoods, removeNeighborhood } from './neighborhoodModel'

export function NeighborhoodInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [entry, setEntry] = useState('')
  const items = parseNeighborhoods(value)
  function confirm() { if (entry.trim()) { onChange(addNeighborhood(value, entry)); setEntry('') } }
  return <fieldset className="hp-field hp-neighborhoods">
    <legend>Neighborhoods · optional</legend>
    <p className="hp-field-description">Search preferences only—not verified neighborhood boundaries. Do not enter an exact address.</p>
    <div className="hp-chip-list" aria-label="Selected neighborhoods">{items.map((item, index) => <span className="hp-chip" key={item.toLowerCase()}>{item}<button type="button" aria-label={`Remove ${item}`} onClick={() => onChange(removeNeighborhood(value, index))}>×</button></span>)}</div>
    <input aria-label="Add a neighborhood" list="hp-neighborhood-options" value={entry} placeholder="Type a neighborhood, then press Enter" onChange={event => { const next = event.target.value; if (next.includes(',')) { onChange(addNeighborhood(value, next)); setEntry('') } else setEntry(next) }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); confirm() } else if (event.key === 'Backspace' && !entry && items.length) onChange(removeNeighborhood(value, items.length - 1)) }} onBlur={confirm} />
    <datalist id="hp-neighborhood-options">{BLACKSBURG_NEIGHBORHOODS.map(item => <option key={item} value={item} />)}</datalist>
  </fieldset>
}
