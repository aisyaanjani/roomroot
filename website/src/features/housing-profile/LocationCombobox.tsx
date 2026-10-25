import { useId, useRef, useState } from 'react'
import { nextComboboxIndex, suggestionStatus } from './locationInputModel'

export interface LocationOption { value: string; label: string }

export function LocationCombobox({ label, value, options, onChange, allowCustom = false, invalid = false, description, onCommit }: {
  label: string
  value: string
  options: LocationOption[]
  onChange: (value: string) => void
  allowCustom?: boolean
  invalid?: boolean
  description?: string
  onCommit?: (value: string) => void
}) {
  const id = useId().replace(/:/g, '')
  const listId = `location-list-${id}`
  const statusId = `location-status-${id}`
  const input = useRef<HTMLInputElement>(null)
  const displayValue = (candidate: string) => options.find(option => option.value === candidate)?.label ?? candidate
  const [typedQuery, setTypedQuery] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const query = typedQuery ?? displayValue(value)
  const needle = query.trim().toLowerCase()
  const visibleOptions = options.filter(option => !needle || option.label.toLowerCase().includes(needle) || option.value.toLowerCase().startsWith(needle))

  function choose(option: LocationOption) {
    setTypedQuery(null)
    onChange(option.value)
    onCommit?.(option.value)
    setOpen(false)
    setActive(-1)
  }
  function commitTyped() {
    const exact = options.find(option => option.value.toLowerCase() === query.trim().toLowerCase() || option.label.toLowerCase() === query.trim().toLowerCase())
    if (exact) choose(exact)
    else {
      onChange(query.trim())
      onCommit?.(query.trim())
      setOpen(false)
      setTypedQuery(null)
      setActive(-1)
    }
  }

  return <fieldset className="hp-field hp-combobox-field">
    <legend>{label}</legend>
    {description && <p className="hp-field-description">{description}</p>}
    <div className="hp-combobox">
      <input ref={input} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined} aria-invalid={invalid} aria-describedby={`${statusId}${invalid ? ' hp-validation-errors' : ''}`} value={query} onFocus={() => setOpen(true)} onChange={event => { const next = event.target.value; setTypedQuery(next); setOpen(true); setActive(-1); if (allowCustom) onChange(next) }} onBlur={() => { window.setTimeout(() => { if (document.activeElement !== input.current) { if (!allowCustom) commitTyped(); else { onCommit?.(query.trim()); setOpen(false); setTypedQuery(null) } } }, 0) }} onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(index => nextComboboxIndex(index, event.key === 'ArrowDown' ? 1 : -1, visibleOptions.length)) }
        else if (event.key === 'Enter') { if (open && active >= 0 && visibleOptions[active]) { event.preventDefault(); choose(visibleOptions[active]) } else if (allowCustom) { onChange(query.trim()); onCommit?.(query.trim()); setOpen(false) } }
        else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1); setTypedQuery(null) }
        else if (event.key === 'Tab') { if (allowCustom) { onChange(query.trim()); onCommit?.(query.trim()) } setOpen(false); setTypedQuery(null) }
      }} />
      {open && <ul id={listId} role="listbox" className="hp-suggestions">
        {visibleOptions.map((option, index) => <li id={`${listId}-${index}`} role="option" aria-selected={active === index} key={option.value} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(option)}>{option.label}</li>)}
        {!visibleOptions.length && <li className="hp-no-suggestions">No curated suggestions. You can keep typing.</li>}
      </ul>}
    </div>
    <span id={statusId} className="hp-sr" role="status">{open ? suggestionStatus(visibleOptions.length, active >= 0 ? visibleOptions[active]?.label : undefined) : ''}</span>
  </fieldset>
}
