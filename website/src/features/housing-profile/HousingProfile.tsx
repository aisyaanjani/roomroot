import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { amenities, compatibility, createHousingProfile, dealbreakers, headings, housingTypes, lifestyleQuestions, priorityOptions, sections } from './questions'
import { loadHousingProfile, resetHousingProfile, saveHousingProfile } from './storage'
import { applyImportedProfile, readImportUndoBackup, restoreProfileBeforeImport } from './importProfile'
import { ProfileImport } from './ProfileImport'
import type { AmenityPriority, HousingProfileData, HousingProfileDraft } from './types'
import { validateSection } from './validation'
import './HousingProfile.css'

function Choices({ label, options, value, onChange, multiple = false, invalid = false }: { label: string; options: string[]; value: string | string[]; onChange: (value: string) => void; multiple?: boolean; invalid?: boolean }) {
  return <fieldset className="hp-field" aria-invalid={invalid} aria-describedby={invalid ? 'hp-validation-errors' : undefined}><legend>{label}</legend><div className="hp-options">{options.map(option => <button key={option} type="button" aria-pressed={multiple ? value.includes(option) : value === option} onClick={() => onChange(option)}>{option}<span aria-hidden="true">{(multiple ? value.includes(option) : value === option) ? '✓' : '+'}</span></button>)}</div></fieldset>
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <fieldset className="hp-field"><legend>{label}</legend>{children}</fieldset> }
function toggle(values: string[], value: string) { return values.includes(value) ? values.filter(v => v !== value) : [...values, value] }
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)

export function HousingProfile() {
  const [draft, setDraft] = useState<HousingProfileDraft>(() => { const saved = loadHousingProfile() ?? createHousingProfile(); return {...saved, completedSections:saved.completedSections ?? Array.from({length:saved.step}, (_, index) => index)} })
  const [status, setStatus] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [exited, setExited] = useState(false)
  const [resetPending, setResetPending] = useState(false)
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
  function showErrors(issues: string[]) { setErrors(issues); if (issues.length) window.setTimeout(() => errorBox.current?.focus(), 0) }
  const completedSections = (draft.completedSections ?? Array.from({length: step}, (_, index) => index)).filter(index => validateSection(p, index).length === 0)
  const progress = Math.round(completedSections.length / 6 * 100)
  function update<K extends keyof HousingProfileData>(section: K, value: Partial<HousingProfileData[K]>) {
    const profile = { ...p, [section]: { ...p[section], ...value } }
    setDraft(d => ({ ...d, updatedAt:new Date().toISOString(), completed: false, profile }))
    if (errors.length) setErrors(validateSection(profile, step).map(issue => issue.message))
  }
  function validation(section: number): string[] { return validateSection(p, section).map(issue => issue.message) }
  function go(next: number) { setErrors([]); setDraft(d => ({ ...d, step: next, updatedAt:new Date().toISOString() })); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function next() {
    const issues = step === 5 ? sections.flatMap((_, index) => validation(index)) : validation(step)
    showErrors(issues)
    if (issues.length) return
    const completed = [...new Set([...completedSections, step])]
    setDraft(d => ({...d, completedSections:completed, completed:step === 5, step:step+1, updatedAt:new Date().toISOString()}))
    window.scrollTo({top:0, behavior:'smooth'})
  }
  function exportProfile() {
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
    const issue = errors.length ? validateSection(p, step).find(issue => issue.field === key) : undefined
    return { 'aria-label':label, 'aria-invalid':!!issue, 'aria-describedby':issue ? 'hp-validation-errors' : undefined }
  }
  function move(index: number, direction: number) { const ranked = [...p.priorities.ranked]; const other = index + direction; if (other < 0 || other >= ranked.length) return; [ranked[index], ranked[other]] = [ranked[other]!, ranked[index]!]; update('priorities', {ranked}) }
  const input = (key: 'city'|'state'|'neighborhoods'|'proximity'|'otherLease', label: string, placeholder = '') => <Field label={label}><input {...fieldProps(key, label)} required={['city','state','otherLease'].includes(key)} value={b[key]} placeholder={placeholder} onChange={e => update('housingBasics', {[key]:e.target.value})} /></Field>
  const basicChoice = (key: 'transportation'|'utilities'|'budgetFlexible'|'dateFlexible'|'lease', label: string, options: string[]) => <Choices invalid={errors.length > 0 && validateSection(p, step).some(issue => issue.field === key)} label={label} value={b[key]} options={options} onChange={v => update('housingBasics', {[key]:v})} />
  const propertyChoice = (key: 'bedroom'|'bathroom'|'furnishing'|'floor'|'elevator'|'entrance'|'outdoor', label: string, options: string[]) => <Choices label={label} value={h[key]} options={options} onChange={v => update('propertyPreferences', {[key]:v})} />
  return <main className="housing-profile"><header className="hp-brand"><span className="hp-logo" aria-hidden="true">⌂</span> ROOMROOT <span className="hp-private">Your space starts with you</span></header>
    <div className="hp-layout"><aside className="hp-sidebar"><p className="hp-eyebrow">A HOME THAT FITS</p><h2>A little about you.<br/>A lot more like home.</h2><p>Build a profile around the way you want to live.</p><ol>{sections.map((name, index) => <li key={name} data-completed={completedSections.includes(index)} aria-current={step === index ? 'step' : undefined}><span>{completedSections.includes(index) ? '✓' : `0${index+1}`}</span><span className="hp-sr">{completedSections.includes(index) ? 'Completed: ' : ''}</span>{name}</li>)}</ol><div className="hp-note">♡ Made for your next chapter.<small>Your answers stay in this browser. You can edit them anytime.</small></div></aside>
    <div className="hp-main"><div className="hp-progress-label"><span>{step === 6 ? 'Your profile' : `Step ${step+1} of 6`}</span><span>{progress}% complete</span></div><progress max={100} value={progress} aria-label="Questionnaire completion" />
    <ol className="hp-mobile-steps" aria-label="Section completion">{sections.map((name,index)=><li key={name} aria-current={step === index ? 'step' : undefined} data-completed={completedSections.includes(index)}><span aria-hidden="true">{completedSections.includes(index) ? '✓' : index+1}</span><span className="hp-sr">{name}{completedSections.includes(index) ? ', completed' : ''}</span></li>)}</ol>
    <p role="status" className="hp-save-status">{status}</p>
    {undoImport === 'available' && <p className="hp-undo-import"><button type="button" onClick={undoLastImport}>Undo import</button></p>}
    {step < 6 && <ProfileImport onReplace={replaceWithImport} />}
    {exited ? <section className="hp-panel"><h1 ref={title} tabIndex={-1}>Take your time. We'll be here.</h1><p>Your progress is kept in this browser when storage is available.</p><button className="hp-primary" onClick={() => setExited(false)}>Resume questionnaire</button></section> : <>
    <h1 ref={title} tabIndex={-1}>{step === 6 ? 'My Housing Profile' : headings[step]}</h1><p className="hp-intro">{step === 6 ? 'A picture of your next home, in your own words.' : 'There’s no one-size-fits-all home. Let’s find what matters to you.'}</p>
    {errors.length > 0 && <div id="hp-validation-errors" ref={errorBox} tabIndex={-1} className="hp-errors" role="alert"><strong>A few things need your attention:</strong><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
    <div className="hp-panel">
    {step === 0 && <><p className="hp-hint">Required: city, state, transportation, move-in date, and lease duration. Other choices are optional.</p><div className="hp-grid">{input('city','Preferred city *','e.g. Boston')}{input('state','State *','e.g. Massachusetts')}{input('neighborhoods','Neighborhoods · optional','Separate with commas')}{input('proximity','University or workplace · optional','Where do you need to be close to?')}</div><Field label={`Maximum commute · ${b.commute} minutes`}><input aria-label="Maximum commute in minutes" type="range" min={0} max={180} step={5} value={b.commute} onChange={e=>update('housingBasics',{commute:+e.target.value})}/></Field>{basicChoice('transportation','How will you get around? *',['Walking','Biking','Public transit','Driving'])}<h2>Your monthly budget</h2><p className="hp-hint">All amounts in USD. Use the sliders or enter an exact amount.</p><div className="hp-grid">{(['minRent','maxRent','totalBudget'] as const).map(key=><Field key={key} label={`${{minRent:'Minimum rent',maxRent:'Maximum rent',totalBudget:'Total budget with utilities'}[key]} · ${money(b[key])}`}><input {...fieldProps(key, `${key} slider`)} type="range" min={0} max={Math.max(10000,b[key])} step={50} value={b[key]} onChange={e=>update('housingBasics',{[key]:+e.target.value})}/><input {...fieldProps(key, `${key} exact amount`)} type="number" min={0} value={b[key]} onChange={e=>update('housingBasics',{[key]:Math.max(0,+e.target.value)})}/></Field>)}</div>{basicChoice('utilities','Must utilities be included? · optional',['Yes','No','No preference'])}{basicChoice('budgetFlexible','Is your budget flexible? · optional',['Yes','No','Somewhat'])}<Field label="Preferred move-in date *"><input {...fieldProps('moveInDate', 'Preferred move-in date')} required type="date" value={b.moveInDate} onChange={e=>update('housingBasics',{moveInDate:e.target.value})}/></Field>{basicChoice('dateFlexible','Is your date flexible? · optional',['Yes','No','Somewhat'])}{basicChoice('lease','Preferred lease duration *',['Month-to-month','Semester','6 months','12 months','Other'])}{b.lease === 'Other' && input('otherLease','Describe your lease duration *')}</>}
    {step === 1 && <><Choices invalid={errors.length > 0 && !h.housingTypes.length} label="Housing types * · choose all that fit" multiple options={housingTypes} value={h.housingTypes} onChange={v=>update('propertyPreferences',{housingTypes:toggle(h.housingTypes,v)})}/><p className="hp-hint">All remaining property preferences are optional. Zero means no minimum or no roommates.</p><div className="hp-grid">{(['bedrooms','bathrooms','squareFootage','roommates'] as const).map(key=><Field key={key} label={{bedrooms:'Minimum bedrooms',bathrooms:'Minimum bathrooms',squareFootage:'Preferred square footage',roommates:'Preferred number of roommates'}[key]}><input {...fieldProps(key, ({bedrooms:'Minimum bedrooms',bathrooms:'Minimum bathrooms',squareFootage:'Preferred square footage',roommates:'Preferred number of roommates'})[key])} type="number" min={0} step={key === 'bathrooms' ? 0.5 : 1} value={h[key]} onChange={e=>update('propertyPreferences',{[key]:Math.max(0,+e.target.value)})}/></Field>)}</div>{propertyChoice('bedroom','Bedroom',['Private','Shared','No preference'])}{propertyChoice('bathroom','Bathroom',['Private','Shared','No preference'])}{propertyChoice('furnishing','Furnishing',['Furnished','Partially furnished','Unfurnished','No preference'])}{propertyChoice('floor','Floor level',['Ground floor','Lower floors','Upper floors','No preference'])}{propertyChoice('elevator','Elevator requirement',['Required','Preferred','No preference'])}{propertyChoice('entrance','Private entrance',['Required','Preferred','No preference'])}{propertyChoice('outdoor','Outdoor space',['Private','Shared','No preference'])}</>}
    {step === 2 && <><p className="hp-hint">Choose what’s essential and what would be a bonus. Everything starts at “Don’t care.”</p><div className="hp-amenities">{amenities.map(([icon,name])=><fieldset className={`hp-amenity ${p.amenities[name!] === 'Must have' ? 'hp-essential' : ''}`} key={name}><legend><span aria-hidden="true">{icon}</span> {name}</legend><div>{(['Must have','Nice to have',"Don't care"] as AmenityPriority[]).map(priority=><button type="button" key={priority} aria-pressed={p.amenities[name!] === priority} onClick={()=>update('amenities',{[name!]:priority})}>{priority}</button>)}</div></fieldset>)}</div></>}
    {step === 3 && <><p className="hp-hint">Every question here is optional. Share what feels useful.</p>{lifestyleQuestions.map(q=><Choices key={q.key} label={q.label} options={q.options} value={p.lifestyle[q.key]} onChange={v=>update('lifestyle',{[q.key]:p.lifestyle[q.key] === v ? '' : v})}/>)}</>}
    {step === 4 && <><p className="hp-hint">1 = less important · 5 = essential. These preferences describe your priorities, not compatibility scores.</p>{compatibility.map(name=><fieldset key={name} className="hp-rating"><legend>{name}</legend><div>{[1,2,3,4,5].map(value=><button type="button" key={value} aria-label={`${name}: ${value} of 5`} aria-pressed={p.roommatePreferences.importance[name] === value} onClick={()=>update('roommatePreferences',{importance:{...p.roommatePreferences.importance,[name]:value}})}>{value}</button>)}</div></fieldset>)}<h2>Your dealbreakers</h2><p className="hp-hint">Optional firm boundaries, kept separately from your importance ratings.</p><Choices label="I’m not comfortable with…" multiple options={dealbreakers} value={p.roommatePreferences.dealbreakers} onChange={v=>update('roommatePreferences',{dealbreakers:toggle(p.roommatePreferences.dealbreakers,v)})}/></>}
    {step === 5 && <><p className="hp-hint">Select your top five, then move them into order. Your first choice matters most.</p><div className="hp-priority-options" role="group" aria-label="Select your top five priorities" aria-invalid={errors.length > 0 && p.priorities.ranked.length !== 5} aria-describedby={errors.length ? 'hp-validation-errors' : undefined}>{priorityOptions.map(name=><button type="button" key={name} disabled={p.priorities.ranked.length === 5 && !p.priorities.ranked.includes(name)} aria-pressed={p.priorities.ranked.includes(name)} onClick={()=>update('priorities',{ranked:toggle(p.priorities.ranked,name)})}>{name} {p.priorities.ranked.includes(name) ? '✓' : '+'}</button>)}</div><h2>Your top {p.priorities.ranked.length} / 5</h2><ol className="hp-ranked">{p.priorities.ranked.map((name,index)=><li key={name}><span>{index+1}</span><strong>{name}</strong><button aria-label={`Move ${name} up`} disabled={index === 0} onClick={()=>move(index,-1)}>↑</button><button aria-label={`Move ${name} down`} disabled={index === p.priorities.ranked.length-1} onClick={()=>move(index,1)}>↓</button></li>)}</ol><Choices label="Where could you be flexible? · optional" multiple options={priorityOptions} value={p.priorities.flexible} onChange={v=>update('priorities',{flexible:toggle(p.priorities.flexible,v)})}/></>}
    {step === 6 && <><div className="hp-summary-heading"><span className="hp-eyebrow">YOUR NEXT CHAPTER</span><p>Ready when you are. Review your preferences below.</p></div>{[
      {title:'Preferred location & budget',body:<dl><dt>Location</dt><dd>{b.city}, {b.state}{b.neighborhoods && ` · ${b.neighborhoods}`}</dd><dt>Proximity</dt><dd>{b.proximity || 'No preference'} · {b.commute} minutes · {b.transportation}</dd><dt>Monthly rent</dt><dd>{money(b.minRent)} – {money(b.maxRent)} · {money(b.totalBudget)} total</dd><dt>Budget details</dt><dd>Utilities included: {b.utilities || 'Unspecified'} · Budget flexibility: {b.budgetFlexible || 'Unspecified'}</dd><dt>Move-in</dt><dd>{b.moveInDate} · Date flexibility: {b.dateFlexible || 'Unspecified'}</dd><dt>Lease</dt><dd>{b.lease === 'Other' ? b.otherLease : b.lease}</dd></dl>},
      {title:'Property preferences',body:<dl>{Object.entries(h).map(([key,value])=><div key={key}><dt>{({housingTypes:'Housing types',bedrooms:'Minimum bedrooms',bathrooms:'Minimum bathrooms',bedroom:'Bedroom',bathroom:'Bathroom',squareFootage:'Square footage',furnishing:'Furnishing',floor:'Floor',elevator:'Elevator',roommates:'Roommates',entrance:'Private entrance',outdoor:'Outdoor space'} as Record<string,string>)[key]}</dt><dd>{Array.isArray(value) ? value.join(', ') : typeof value === 'number' ? (key === 'squareFootage' && value === 0 ? 'No minimum' : String(value)) : value || 'No preference'}</dd></div>)}</dl>},
      {title:'Amenities',body:<>{(['Must have','Nice to have'] as const).map(priority=><p key={priority}><strong>{priority}: </strong>{Object.entries(p.amenities).filter(([,v])=>v===priority).map(([name])=>name).join(', ') || 'None selected'}</p>)}</>},
      {title:'Lifestyle',body:<dl>{lifestyleQuestions.map(q=><div key={q.key}><dt>{q.label}</dt><dd>{p.lifestyle[q.key] || 'Not specified'}</dd></div>)}</dl>},
      {title:'Roommate preferences & dealbreakers',body:<><dl>{compatibility.map(name=><div key={name}><dt>{name}</dt><dd>{p.roommatePreferences.importance[name]} / 5</dd></div>)}</dl><p><strong>Dealbreakers: </strong>{p.roommatePreferences.dealbreakers.join(', ') || 'None selected'}</p></>},
      {title:'Personal priorities',body:<><ol>{p.priorities.ranked.map(name=><li key={name}>{name}</li>)}</ol><p><strong>Flexible: </strong>{p.priorities.flexible.join(', ') || 'None selected'}</p></>},
    ].map((section,index)=><section className="hp-summary-section" key={section.title}><div className="hp-summary-title"><h2>{section.title}</h2><button onClick={()=>go(index)}>Edit<span className="hp-sr"> {section.title}</span></button></div>{section.body}</section>)}<div className="hp-summary-actions"><button onClick={()=>go(0)}>Edit Profile</button><button className="hp-primary" onClick={()=>{const issues=sections.flatMap((_,index)=>validation(index)); showErrors(issues); if (!issues.length) setStatus(saveHousingProfile(draft) ? 'Profile saved on this device.' : 'Unable to save. Export your profile to keep a copy.')}}>Save Profile</button><button onClick={exportProfile}>Export Profile as JSON</button><ProfileImport onReplace={replaceWithImport} /><button onClick={()=>setResetPending(true)}>Reset Profile</button></div>{resetPending && <div className="hp-errors" role="alert"><p>Delete all answers saved on this device?</p><button onClick={()=>{if(resetHousingProfile()){setDraft(createHousingProfile());setResetPending(false);setErrors([])}else setStatus('Unable to reset storage. Please check your browser settings.')}}>Yes, reset profile</button><button onClick={()=>setResetPending(false)}>Keep my answers</button></div>}</>}
    </div>{step < 6 && <footer className="hp-navigation"><button disabled={step === 0} onClick={()=>go(step-1)}>← Back</button><button onClick={()=>{if(saveHousingProfile(draft)){setExited(true);setErrors([])}else setStatus('Unable to save. Export a copy before leaving.')}}>Save & Exit</button><button className="hp-primary" onClick={next}>{step === 5 ? 'Review my profile' : 'Next'} →</button></footer>}
    </>}
    </div></div></main>
}
