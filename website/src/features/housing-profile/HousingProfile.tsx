import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { amenities, compatibility, createHousingProfile, dealbreakers, headings, housingTypes, leaseOptions, lifestyleQuestions, priorityOptions, sections } from './questions'
import { isHousingProfileDraft, loadHousingProfile, resetHousingProfile, saveHousingProfile } from './storage'
import { applyImportedProfile, readImportUndoBackup, restoreProfileBeforeImport } from './importProfile'
import { ProfileImport } from './ProfileImport'
import { LocationCombobox } from './LocationCombobox'
import { NeighborhoodInput } from './NeighborhoodInput'
import { ProximityInput } from './ProximityInput'
import { COMMUTE_AREAS, filterCities, STATE_OPTIONS } from './locationData'
import type { AmenityPriority, HousingProfileData, HousingProfileDraft } from './types'
import type { ProfileIssue } from './validation'
import { validateSection } from './validation'
import { canNavigateToSection, getProfileReview, importanceLabels, toggleAnswer } from './profileUx'
import './HousingProfile.css'

function Choices({ label, options, value, onChange, multiple = false, clearable = false, invalid = false, error, errorId }: { label: string; options: string[]; value: string | string[]; onChange: (value: string) => void; multiple?: boolean; clearable?: boolean; invalid?: boolean; error?: string; errorId?: string }) {
  return <fieldset className="hp-field" aria-invalid={invalid} aria-describedby={error ? `hp-validation-errors ${errorId ?? ''}`.trim() : undefined}><legend>{label}</legend><div className="hp-options">{options.map(option => <button key={option} type="button" aria-pressed={multiple ? value.includes(option) : value === option} onClick={() => onChange(option)}>{option}<span aria-hidden="true">{(multiple ? value.includes(option) : value === option) ? '✓' : '+'}</span></button>)}{clearable && <button type="button" aria-pressed={!value} onClick={() => onChange('')}>Not specified</button>}</div>{error && <p id={errorId} className="hp-field-error" role="alert">{error}</p>}</fieldset>
}
function Field({ label, children, description, descriptionId, error, errorId }: { label: string; children: ReactNode; description?: string; descriptionId?: string; error?: string; errorId?: string }) { return <fieldset className="hp-field"><legend>{label}</legend>{description && <p id={descriptionId} className="hp-field-description">{description}</p>}{children}{error && <p id={errorId} className="hp-field-error" role="alert">{error}</p>}</fieldset> }
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
type LocatedIssue = ProfileIssue & { section: number }

export function HousingProfile() {
  const [draft, setDraft] = useState<HousingProfileDraft>(() => { const saved = loadHousingProfile() ?? createHousingProfile(); return {...saved, completedSections:saved.completedSections ?? Array.from({length:saved.step}, (_, index) => index)} })
  const [status, setStatus] = useState('')
  const [errors, setErrors] = useState<LocatedIssue[]>([])
  const [exited, setExited] = useState(false)
  const [resetPending, setResetPending] = useState(false)
  const [locationReview, setLocationReview] = useState('')
  const [undoImport, setUndoImport] = useState<'available' | 'none' | 'unavailable'>(() => readImportUndoBackup().status)
  const errorBox = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const draftRef = useRef(draft)
  const { profile: p, step } = draft
  const b = p.housingBasics
  const h = p.propertyPreferences
  useEffect(() => { draftRef.current = draft }, [draft])
  useEffect(() => {
    const timer = window.setTimeout(() => setStatus(saveHousingProfile(draft) ? 'Progress saved on this device' : 'Unable to save on this device. Export your profile to keep a copy.'), 0)
    return () => window.clearTimeout(timer)
  }, [draft])
  useEffect(() => {
    const flush = () => { saveHousingProfile(draftRef.current) }
    window.addEventListener('pagehide', flush)
    return () => { window.removeEventListener('pagehide', flush); flush() }
  }, [])
  useEffect(() => { title.current?.focus() }, [step, exited])
  function showErrors(issues: LocatedIssue[]) { setErrors(issues); if (issues.length) window.setTimeout(() => errorBox.current?.focus(), 0) }
  const completedSections = (draft.completedSections ?? Array.from({length: step}, (_, index) => index)).filter(index => validateSection(p, index).length === 0)
  const progress = Math.round(completedSections.length / 6 * 100)
  function update<K extends keyof HousingProfileData>(section: K, value: Partial<HousingProfileData[K]>) {
    const profile = { ...p, [section]: { ...p[section], ...value } }
    setDraft(d => {
      const previouslyCompleted = d.completedSections ?? Array.from({ length: d.step }, (_, index) => index)
      const completedSections = previouslyCompleted.filter(index => validateSection(profile, index).length === 0)
      return { ...d, completedSections, updatedAt:new Date().toISOString(), completed: false, profile }
    })
    if (errors.length) setErrors(previous => {
      const sectionsToValidate = previous.some(issue => issue.section !== step)
        ? sections.map((_, index) => index)
        : [step]
      return sectionsToValidate.flatMap(index => validateSection(profile, index).map(issue => ({ ...issue, section: index })))
    })
  }
  function updateState(state: string) {
    if (b.city.trim() && b.state !== state) setLocationReview(`Review whether ${b.city.trim()} matches the newly selected state.`)
    update('housingBasics', {state})
  }
  function validation(section: number) { return validateSection(p, section).map(issue => ({ ...issue, section })) }
  function go(next: number) {
    if (!canNavigateToSection(next, step, completedSections)) return
    setErrors([])
    setDraft(d => ({ ...d, step: next, updatedAt:new Date().toISOString() }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function next() {
    const issues = step === 5 ? sections.flatMap((_, index) => validation(index)) : validation(step)
    showErrors(issues)
    if (issues.length) return
    const completed = [...new Set([...completedSections, step])]
    setDraft(d => ({...d, completedSections:completed, completed:step === 5, step:step+1, updatedAt:new Date().toISOString()}))
    window.scrollTo({top:0, behavior:'smooth'})
  }
  function exportProfile() {
    if (!isHousingProfileDraft(draft)) {
      setStatus('This profile has an invalid number and cannot be exported yet. Correct the highlighted value, then try again.')
      return
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], {type:'application/json'}))
    const link = document.createElement('a'); link.href=url; link.download='roomroot-housing-profile.json'
    document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function replaceWithImport(imported: HousingProfileDraft) {
    const result = applyImportedProfile(imported, loadHousingProfile(), saveHousingProfile)
    if (!result.ok || !result.draft) {
      setStatus('Unable to save the imported profile in this browser. Your current profile was not changed.')
      return false
    }
    setUndoImport(result.undoStatus ?? 'unavailable')
    setDraft(result.draft)
    setExited(false)
    setResetPending(false)
    setErrors([])
    setStatus(result.undoStatus === 'available'
      ? 'Profile imported and saved on this device. Undo is available for this browser tab session.'
      : 'Profile imported and saved on this device. Session storage is unavailable, so this import cannot be undone.')
    window.scrollTo({top:0, behavior:'smooth'})
    return true
  }
  function undoLastImport() {
    if (undoImport !== 'available') return
    const result = restoreProfileBeforeImport(saveHousingProfile)
    if (!result.ok || !result.draft) {
      setStatus('Unable to restore the previous profile in this browser.')
      return
    }
    setDraft(result.draft)
    setUndoImport(result.undoStatus === 'unavailable' ? 'unavailable' : 'none')
    setExited(false)
    setErrors([])
    setStatus(result.undoStatus === 'unavailable'
      ? 'The previous profile was restored, but the session backup could not be cleared because session storage is unavailable.'
      : 'The previous profile has been restored.')
    window.scrollTo({top:0, behavior:'smooth'})
  }
  function fieldProps(key: string, label: string) {
    const issue = errors.find(issue => issue.section === step && issue.field === key)
    const errorId = `hp-field-error-${key}`
    return { 'aria-label':label, 'aria-invalid':!!issue, 'aria-describedby':issue ? `hp-validation-errors ${errorId}` : undefined }
  }
  function move(index: number, direction: number) { const ranked = [...p.priorities.ranked]; const other = index + direction; if (other < 0 || other >= ranked.length) return; [ranked[index], ranked[other]] = [ranked[other]!, ranked[index]!]; update('priorities', {ranked}) }
  const input = (key: 'otherLease', label: string, placeholder = '') => <Field label={label} error={issueFor(key)?.message} errorId={`hp-field-error-${key}`}><input {...fieldProps(key, label)} required value={b[key]} placeholder={placeholder} onChange={e => update('housingBasics', {[key]:e.target.value})} /></Field>
  const issueFor = (key: string) => errors.find(issue => issue.section === step && issue.field === key)
  const basicChoice = (key: 'transportation'|'utilities'|'budgetFlexible'|'dateFlexible'|'lease', label: string, options: string[], clearable = false) => <Choices invalid={!!issueFor(key)} error={issueFor(key)?.message} errorId={`hp-field-error-${key}`} label={label} value={b[key]} options={options} clearable={clearable} onChange={v => update('housingBasics', {[key]:v})} />
  const propertyChoice = (key: 'bedroom'|'bathroom'|'furnishing'|'floor'|'elevator'|'entrance'|'outdoor', label: string, options: string[]) => <Choices label={label} value={h[key]} options={options} onChange={v => update('propertyPreferences',{[key]:h[key]===v ? '' : v})} />
  const review = getProfileReview(p)
  const leaseValues = [...leaseOptions, ...(b.lease === 'Semester' ? ['Semester'] : []), ...(b.lease === '6 months' ? ['6 months'] : [])]
  const budgetFields: Array<{ key: 'minRent' | 'maxRent' | 'totalBudget'; label: string; description: string }> = [
    { key: 'minRent', label: 'Minimum expected rent', description: 'The lowest monthly rent you would consider.' },
    { key: 'maxRent', label: 'Maximum affordable rent', description: 'The highest monthly rent you can pay before utilities.' },
    { key: 'totalBudget', label: 'Maximum total monthly housing cost', description: 'Your overall monthly limit, including rent and utilities.' },
  ]
  const reviewSection = <section className="hp-review" aria-labelledby="hp-review-heading">
    <h2 id="hp-review-heading">Review incomplete or conflicting answers</h2>
    <p>Required gaps and contradictory values are listed separately from helpful review suggestions. Optional answers do not block completion.</p>
    <div className="hp-review-columns">
      <div><h3>Needs attention to finish</h3>{review.blocking.length ? <ul>{review.blocking.map((item,index)=><li key={`${item.section}-${item.message}-${index}`}><button type="button" onClick={() => go(item.section)}>{sections[item.section]}: {item.message}</button></li>)}</ul> : <p>No blocking issues.</p>}</div>
      <div><h3>Suggestions to review</h3>{review.suggestions.length ? <ul>{review.suggestions.map((item,index)=><li key={`${item.section}-${item.message}-${index}`}><button type="button" onClick={() => go(item.section)}>{sections[item.section]}: {item.message}</button></li>)}</ul> : <p>No suggestions right now.</p>}</div>
    </div>
  </section>
  return <main className="housing-profile"><header className="hp-brand"><span className="hp-logo" aria-hidden="true">⌂</span> ROOMROOT <span className="hp-private">Your space starts with you</span></header>
    <div className="hp-layout"><aside className="hp-sidebar"><p className="hp-eyebrow">A HOME THAT FITS</p><h2>A little about you.<br/>A lot more like home.</h2><p>Build a profile around the way you want to live.</p><nav aria-label="Profile sections"><ol>{sections.map((name, index) => <li key={name} data-completed={completedSections.includes(index)}><button type="button" aria-current={step === index ? 'step' : undefined} aria-label={`Section ${index + 1}: ${name}${completedSections.includes(index) ? ', completed' : ''}`} disabled={!canNavigateToSection(index, step, completedSections)} onClick={() => go(index)}><span aria-hidden="true">{completedSections.includes(index) ? '✓' : `0${index+1}`}</span>{name}</button></li>)}</ol></nav><div className="hp-note">♡ Made for your next chapter.<small>Your progress saves on this device. Export a backup anytime; answers can be edited later.</small></div></aside>
    <div className="hp-main"><div className="hp-progress-label"><span>{step === 6 ? 'Your profile' : `Step ${step+1} of 6`}</span><span>{progress}% complete</span></div><progress max={100} value={progress} aria-label="Questionnaire completion" />
    <nav aria-label="Profile sections"><ol className="hp-mobile-steps">{sections.map((name,index)=><li key={name} data-completed={completedSections.includes(index)}><button type="button" aria-current={step === index ? 'step' : undefined} aria-label={`Section ${index + 1}: ${name}${completedSections.includes(index) ? ', completed' : ''}`} disabled={!canNavigateToSection(index, step, completedSections)} onClick={() => go(index)}><span aria-hidden="true">{completedSections.includes(index) ? '✓' : index+1}</span><span className="hp-sr">{name}{completedSections.includes(index) ? ', completed' : ''}</span></button></li>)}</ol></nav>
    <p role="status" className="hp-save-status">{status}</p>
    {undoImport === 'available' && <p className="hp-undo-import"><button type="button" onClick={undoLastImport}>Undo import</button></p>}
    {step < 6 && <ProfileImport onReplace={replaceWithImport} />}
    {exited ? <section className="hp-panel"><h1 ref={title} tabIndex={-1}>Take your time. We'll be here.</h1><p>Your progress is kept in this browser when storage is available.</p><button className="hp-primary" onClick={() => setExited(false)}>Resume questionnaire</button></section> : <>
    <h1 ref={title} tabIndex={-1}>{step === 6 ? 'My Housing Profile' : headings[step]}</h1><p className="hp-intro">{step === 6 ? 'A picture of your next home, in your own words.' : 'There’s no one-size-fits-all home. Let’s find what matters to you.'}</p>
    {step === 0 && <aside className="hp-intro-info"><strong>About 4–6 minutes</strong><span>Your progress saves automatically on this device. Export a backup anytime. Optional answers can be skipped, and you can edit everything later. Some controls start with suggested values; review them to make sure they fit.</span></aside>}
    {errors.length > 0 && <div id="hp-validation-errors" ref={errorBox} tabIndex={-1} className="hp-errors" role="alert"><strong>A few things need your attention:</strong><ul>{errors.map((error,index)=><li key={`${error.section}-${error.field}-${index}`}><button type="button" onClick={() => go(error.section)}>{sections[error.section]}: {error.message}</button></li>)}</ul></div>}
    <div className="hp-panel">
    {step === 0 && <>
      <p className="hp-hint">Required: city, state, transportation, move-in date, and lease duration. Other answers are optional. Location suggestions stay on this device.</p>
      <details className="hp-why"><summary>ⓘ Why we ask about location and commute</summary><p>City, state, commute area, and travel preferences help describe where you hope to live. Location answers are not used to infer personal traits.</p></details>
      <div className="hp-grid">
      <LocationCombobox label="Preferred state *" value={b.state} options={STATE_OPTIONS} onChange={updateState} invalid={errors.some(issue => issue.section === step && issue.field === 'state')} />
      <LocationCombobox label="Preferred city *" value={b.city} options={filterCities(b.state, b.city).map(city => ({value:city,label:city}))} onChange={city => update('housingBasics',{city})} allowCustom invalid={errors.some(issue => issue.section === step && issue.field === 'city')} description="Choose a local suggestion or enter another city." />
      {locationReview && <p className="hp-location-review" role="status">{locationReview} <button type="button" onClick={() => setLocationReview('')}>Dismiss</button></p>}
      <NeighborhoodInput value={b.neighborhoods} onChange={neighborhoods => update('housingBasics',{neighborhoods})} />
      <ProximityInput value={b.proximity} onChange={proximity => update('housingBasics',{proximity})} />
      <Field label="Preferred commute area · optional"><select aria-label="Preferred commute area" value={b.commuteArea} onChange={event => update('housingBasics',{commuteArea:event.target.value})}><option value="">No preference</option>{COMMUTE_AREAS.map(area => <option key={area}>{area}</option>)}</select></Field>
      </div>
      <Field label={`Maximum commute · ${Number.isFinite(b.commute) ? b.commute : 'not set'} minutes`} description="Starting point: 30 minutes. Adjust it if that is not useful for your search.">
        <input aria-label="Maximum commute in minutes" type="range" min={0} max={180} step={5} value={Number.isFinite(b.commute) ? b.commute : 0} onChange={event => update('housingBasics',{commute:Number(event.target.value)})}/>
      </Field>
      {basicChoice('transportation','How will you get around? *',['Walking','Biking','Public transit','Driving'])}
      <h2>Your monthly budget</h2>
      <p className="hp-hint">All amounts are monthly USD. New profiles start with example amounts; adjust the sliders or enter exact amounts that fit your limits.</p>
      <details className="hp-why"><summary>ⓘ Why we ask about budget</summary><p>Expected rent, affordable rent, and total housing cost help describe different limits. The total includes utilities and should cover your maximum rent.</p></details>
      <div className="hp-grid hp-budget-grid">{budgetFields.map(({key,label,description})=>{
        const fieldError = issueFor(key)
        const id = `hp-field-error-${key}`
        const descriptionId = `hp-field-description-${key}`
        const describedBy = [descriptionId, fieldError ? `hp-validation-errors ${id}` : ''].filter(Boolean).join(' ')
        const value = Number.isFinite(b[key]) ? b[key] : ''
        return <Field key={key} label={`${label} · ${Number.isFinite(b[key]) ? money(b[key]) : 'Enter an amount'}`} description={description} descriptionId={descriptionId} error={fieldError?.message} errorId={id}>
          <input aria-label={`${label}, slider`} aria-invalid={!!fieldError} aria-describedby={describedBy} type="range" min={0} max={Math.max(10000,Number.isFinite(b[key]) ? b[key] : 0)} step={50} value={Number.isFinite(b[key]) ? b[key] : 0} onChange={event => update('housingBasics',{[key]:Number(event.target.value)})}/>
          <input aria-label={`${label}, exact amount`} aria-invalid={!!fieldError} aria-describedby={describedBy} type="number" min={0} step={50} value={value} onChange={event => update('housingBasics',{[key]:event.target.value === '' ? Number.NaN : Number(event.target.value)})}/>
        </Field>
      })}</div>
      {basicChoice('utilities','Must utilities be included? · optional',['Yes','No','No preference'],true)}
      {basicChoice('budgetFlexible','Is your budget flexible? · optional',['Yes','No','Somewhat','No preference'],true)}
      <Field label="Preferred move-in date *" error={issueFor('moveInDate')?.message} errorId="hp-field-error-moveInDate"><input {...fieldProps('moveInDate', 'Preferred move-in date')} required type="date" value={b.moveInDate} onChange={event=>update('housingBasics',{moveInDate:event.target.value})}/></Field>
      {basicChoice('dateFlexible','Is your date flexible? · optional',['Yes','No','Somewhat','No preference'],true)}
      {basicChoice('lease','Preferred lease duration *',leaseValues)}
      {b.lease === 'Semester' && <p className="hp-legacy-review" role="status">This saved lease choice is kept as-is. Review it later to choose a spring or fall semester without guessing.</p>}
      {b.lease === 'Other' && input('otherLease','Describe your preferred lease duration *')}
    </>}
    {step === 1 && <><Choices invalid={errors.some(issue => issue.section === step && issue.field === 'housingTypes')} label="Housing types * · choose all that fit" multiple options={housingTypes} value={h.housingTypes} onChange={v=>update('propertyPreferences',{housingTypes:toggleAnswer(h.housingTypes,v)})}/><p className="hp-hint">All remaining property preferences are optional. Zero means no minimum or no roommates.</p><div className="hp-grid">{(['bedrooms','bathrooms','squareFootage','roommates'] as const).map(key=>{const labels={bedrooms:'Minimum bedrooms',bathrooms:'Minimum bathrooms',squareFootage:'Preferred square footage',roommates:'Preferred number of roommates'};const issue=issueFor(key);const id=`hp-field-error-${key}`;return <Field key={key} label={labels[key]} error={issue?.message} errorId={id}><input aria-label={labels[key]} aria-invalid={!!issue} aria-describedby={issue ? `hp-validation-errors ${id}` : undefined} type="number" min={0} step={key === 'bathrooms' ? 0.5 : 1} value={Number.isFinite(h[key]) ? h[key] : ''} onChange={event=>update('propertyPreferences',{[key]:event.target.value === '' ? Number.NaN : Number(event.target.value)})}/></Field>})}</div>{propertyChoice('bedroom','Bedroom',['Private','Shared','No preference'])}{propertyChoice('bathroom','Bathroom',['Private','Shared','No preference'])}{propertyChoice('furnishing','Furnishing',['Furnished','Partially furnished','Unfurnished','No preference'])}{propertyChoice('floor','Floor level',['Ground floor','Lower floors','Upper floors','No preference'])}{propertyChoice('elevator','Elevator requirement',['Required','Preferred','No preference'])}{propertyChoice('entrance','Private entrance',['Required','Preferred','No preference'])}{propertyChoice('outdoor','Outdoor space',['Private','Shared','No preference'])}</>}
    {step === 2 && <><p className="hp-hint">Everything starts at “No preference.” That is only a starting setting; change it when an amenity matters to you.</p><details className="hp-why"><summary>ⓘ Why we ask about amenities</summary><p>Amenities help describe the home you want. “Must have” entries can be used as housing-search filters; they do not affect roommate compatibility.</p></details><div className="hp-amenities">{amenities.map(([icon,name])=><fieldset className={`hp-amenity ${p.amenities[name!] === 'Must have' ? 'hp-essential' : ''}`} key={name}><legend><span aria-hidden="true">{icon}</span> {name}</legend><div>{(['Must have','Nice to have',"Don't care"] as AmenityPriority[]).map(priority=><button type="button" key={priority} aria-pressed={p.amenities[name!] === priority} onClick={()=>update('amenities',{[name!]:priority})}>{priority === "Don't care" ? 'No preference' : priority}</button>)}</div></fieldset>)}</div></>}
    {step === 3 && <><p className="hp-hint">Every answer here is optional. Choosing the selected answer again or “Not specified” clears it.</p><details className="hp-why"><summary>ⓘ Why we ask about lifestyle</summary><p>These answers describe daily routines and may be used to compare living preferences. They are optional and do not label anyone as a good or bad roommate.</p></details>{lifestyleQuestions.map(q=><Choices key={q.key} label={`${q.label} · optional`} options={q.options} value={p.lifestyle[q.key]} clearable onChange={v=>update('lifestyle',{[q.key]:v})}/>)}</>}
    {step === 4 && <><p className="hp-hint">Each topic starts at 3 — Worth discussing. Ratings stay numeric and affect weighting, but they are not dealbreakers.</p><details className="hp-why"><summary>ⓘ Why we ask for importance ratings</summary><p>Ratings describe how much each topic matters to you and affect its weight in deterministic compatibility. They do not create or replace dealbreakers. Gemma does not determine the compatibility percentage.</p></details>{compatibility.map(name=>{const selected=p.roommatePreferences.importance[name];return <fieldset key={name} className="hp-rating"><legend>{name}<span className="hp-rating-label">{selected} — {importanceLabels[selected]}</span></legend><div>{[1,2,3,4,5].map(value=><button type="button" key={value} aria-label={`${name}: ${value} — ${importanceLabels[value]}`} aria-pressed={selected === value} onClick={()=>update('roommatePreferences',{importance:{...p.roommatePreferences.importance,[name]:value}})}>{value}</button>)}</div></fieldset>})}<h2>Your dealbreakers</h2><p className="hp-hint">Optional firm boundaries, checked separately from importance ratings.</p><details className="hp-why"><summary>ⓘ Why we ask about dealbreakers</summary><p>Dealbreakers are firm boundaries and are checked separately from the percentage. They can flag a conflict but do not change importance ratings.</p></details><Choices label="I’m not comfortable with… · optional" multiple options={dealbreakers} value={p.roommatePreferences.dealbreakers} onChange={v=>update('roommatePreferences',{dealbreakers:toggleAnswer(p.roommatePreferences.dealbreakers,v)})}/></>}
    {step === 5 && <><p className="hp-hint">Select your top five, then move them into order. Your first choice matters most.</p><details className="hp-why"><summary>ⓘ Why we ask about personal priorities</summary><p>Your ranked priorities help describe what matters most in a home. Flexible items are separate; if an item appears in both lists, review whether that is intentional.</p></details><div className="hp-priority-options" role="group" aria-label="Select your top five priorities" aria-invalid={errors.some(issue=>issue.section===step&&issue.field==='ranked')} aria-describedby={errors.length ? 'hp-validation-errors' : undefined}>{priorityOptions.map(name=><button type="button" key={name} disabled={p.priorities.ranked.length === 5 && !p.priorities.ranked.includes(name)} aria-pressed={p.priorities.ranked.includes(name)} onClick={()=>update('priorities',{ranked:toggleAnswer(p.priorities.ranked,name)})}>{name} {p.priorities.ranked.includes(name) ? '✓' : '+'}</button>)}</div><h2>Your top {p.priorities.ranked.length} / 5</h2><ol className="hp-ranked">{p.priorities.ranked.map((name,index)=><li key={name}><span>{index+1}</span><strong>{name}</strong><button aria-label={`Move ${name} up`} disabled={index === 0} onClick={()=>move(index,-1)}>↑</button><button aria-label={`Move ${name} down`} disabled={index === p.priorities.ranked.length-1} onClick={()=>move(index,1)}>↓</button></li>)}</ol><Choices label="Where could you be flexible? · optional" multiple options={priorityOptions} value={p.priorities.flexible} onChange={v=>update('priorities',{flexible:toggleAnswer(p.priorities.flexible,v)})}/>{reviewSection}</>}
    {step === 6 && <><div className="hp-summary-heading"><span className="hp-eyebrow">YOUR NEXT CHAPTER</span><p>Ready when you are. Review your preferences below.</p></div>{reviewSection}{[
      {title:'Preferred location & budget',body:<dl><dt>Location</dt><dd>{b.city}, {b.state}{b.neighborhoods && ` · ${b.neighborhoods}`}</dd><dt>Need to be near</dt><dd>{b.proximity || 'No specific landmark'}</dd><dt>Commute fit</dt><dd>{b.commuteArea || 'No preferred area'} · {b.commute} minutes · {b.transportation}</dd><dt>Monthly rent</dt><dd>{money(b.minRent)} – {money(b.maxRent)} · {money(b.totalBudget)} total</dd><dt>Budget details</dt><dd>Utilities included: {b.utilities || 'Unspecified'} · Budget flexibility: {b.budgetFlexible || 'Unspecified'}</dd><dt>Move-in</dt><dd>{b.moveInDate} · Date flexibility: {b.dateFlexible || 'Unspecified'}</dd><dt>Lease</dt><dd>{b.lease === 'Other' ? b.otherLease : b.lease}</dd></dl>},
      {title:'Property preferences',body:<dl>{Object.entries(h).map(([key,value])=><div key={key}><dt>{({housingTypes:'Housing types',bedrooms:'Minimum bedrooms',bathrooms:'Minimum bathrooms',bedroom:'Bedroom',bathroom:'Bathroom',squareFootage:'Square footage',furnishing:'Furnishing',floor:'Floor',elevator:'Elevator',roommates:'Roommates',entrance:'Private entrance',outdoor:'Outdoor space'} as Record<string,string>)[key]}</dt><dd>{Array.isArray(value) ? value.join(', ') : typeof value === 'number' ? (key === 'squareFootage' && value === 0 ? 'No minimum' : String(value)) : value || 'No preference'}</dd></div>)}</dl>},
      {title:'Amenities',body:<>{(['Must have','Nice to have'] as const).map(priority=><p key={priority}><strong>{priority}: </strong>{Object.entries(p.amenities).filter(([,v])=>v===priority).map(([name])=>name).join(', ') || 'None selected'}</p>)}</>},
      {title:'Lifestyle',body:<dl>{lifestyleQuestions.map(q=><div key={q.key}><dt>{q.label}</dt><dd>{p.lifestyle[q.key] || 'Not specified'}</dd></div>)}</dl>},
      {title:'Roommate preferences & dealbreakers',body:<><dl>{compatibility.map(name=><div key={name}><dt>{name}</dt><dd>{p.roommatePreferences.importance[name]} / 5</dd></div>)}</dl><p><strong>Dealbreakers: </strong>{p.roommatePreferences.dealbreakers.join(', ') || 'None selected'}</p></>},
      {title:'Personal priorities',body:<><ol>{p.priorities.ranked.map(name=><li key={name}>{name}</li>)}</ol><p><strong>Flexible: </strong>{p.priorities.flexible.join(', ') || 'None selected'}</p></>},
    ].map((section,index)=><section className="hp-summary-section" key={section.title}><div className="hp-summary-title"><h2>{section.title}</h2><button onClick={()=>go(index)}>Edit<span className="hp-sr"> {section.title}</span></button></div>{section.body}</section>)}<section className="hp-privacy-review"><h2>How profile information is used</h2><dl><dt>Information shown to potential roommates</dt><dd>This questionnaire does not publish or show your answers to potential roommates.</dd><dt>Information used for deterministic compatibility</dt><dd>When matching is requested, location, rent and lease details, housing types, lifestyle answers, importance ratings, and dealbreakers may be used. Importance affects weighting; dealbreakers are checked separately.</dd><dt>Information stored only in this browser</dt><dd>Your questionnaire draft autosaves in this browser. Server-backed matching sends selected profile details to RoomRoot's matching service. Exported JSON may contain your housing and lifestyle preferences; keep the file somewhere private.</dd><dt>AI-assisted conversation guidance</dt><dd>If AI guidance is requested, compact lifestyle details are sent to the configured Gemma service for advisory conversation prompts. Gemma does not determine or change the compatibility percentage.</dd></dl><p>Protected characteristics such as race, ethnicity, religion, and disability are not collected for compatibility scoring or filters.</p></section><div className="hp-summary-actions"><button onClick={()=>go(0)}>Edit Profile</button><button className="hp-primary" onClick={()=>{const issues=sections.flatMap((_,index)=>validation(index)); showErrors(issues); if (!issues.length) setStatus(saveHousingProfile(draft) ? 'Profile saved on this device.' : 'Unable to save. Export your profile to keep a copy.')}}>Save Profile</button><button onClick={exportProfile}>Export Profile as JSON</button><ProfileImport onReplace={replaceWithImport} /><button onClick={()=>setResetPending(true)}>Reset Profile</button></div>{resetPending && <div className="hp-errors" role="alert"><p>Delete all answers saved on this device?</p><button onClick={()=>{if(resetHousingProfile()){setDraft(createHousingProfile());setResetPending(false);setErrors([])}else setStatus('Unable to reset storage. Please check your browser settings.')}}>Yes, reset profile</button><button onClick={()=>setResetPending(false)}>Keep my answers</button></div>}</>}
    </div>{step < 6 && <footer className="hp-navigation"><button disabled={step === 0} onClick={()=>go(step-1)}>← Back</button><button onClick={()=>{if(saveHousingProfile(draft)){setExited(true);setErrors([])}else setStatus('Unable to save. Export a copy before leaving.')}}>Save & Exit</button><button className="hp-primary" onClick={next}>{step === 5 ? 'Review my profile' : 'Next'} →</button></footer>}
    </>}
    </div></div></main>
}
