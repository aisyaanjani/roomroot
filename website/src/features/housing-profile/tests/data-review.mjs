// Run: node website/src/features/housing-profile/tests/data-review.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from '../../../../node_modules/typescript/lib/typescript.js'
const base = new URL('../', import.meta.url)
const urls = new Map()
function moduleUrl(name) {
  if (urls.has(name)) return urls.get(name)
  const source = fs.readFileSync(new URL(`${name}.ts`, base), 'utf8')
  const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2023}}).outputText.replace(/from '(\.\/[^']+)'/g, (_, path) => `from '${moduleUrl(path.slice(2))}'`)
  const url = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
  urls.set(name, url)
  return url
}
const {createHousingProfile}=await import(moduleUrl('questions'))
const {validateSection}=await import(moduleUrl('validation'))
const storage=await import(moduleUrl('storage'))
const draft=createHousingProfile()
assert.equal(validateSection(draft.profile,0).length,4)
assert.equal(validateSection(draft.profile,1).length,1)
assert.deepEqual([2,3,4].map(section=>validateSection(draft.profile,section)),[[],[],[]])
assert.match(validateSection(draft.profile,5)[0].message,/5 more/)
const values=new Map()
globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}
assert.equal(storage.saveHousingProfile(draft),true)
assert.deepEqual(storage.loadHousingProfile(),draft)
for(const change of [d=>d.step=7,d=>d.completedSections=[-1],d=>d.completedSections=[1,1],d=>d.completed=true,d=>d.profile.housingBasics.moveInDate='2026-02-30',d=>d.profile.housingBasics.minRent=-1,d=>d.profile.lifestyle.sleep='bad',d=>d.profile.amenities.unknown='Must have',d=>d.profile.priorities.ranked=['bad']]) {
  const invalid=structuredClone(draft);change(invalid);assert.equal(storage.isHousingProfileDraft(invalid),false)
}
const profile=structuredClone(draft.profile)
Object.assign(profile.housingBasics,{city:'Boston',state:'MA',transportation:'Walking',moveInDate:'2026-12-01',lease:'Other'})
assert.equal(validateSection(profile,0)[0].field,'otherLease')
profile.housingBasics.otherLease='9 months'
assert.deepEqual(validateSection(profile,0),[])
profile.housingBasics.minRent=2000
assert.equal(validateSection(profile,0)[0].field,'minRent')
profile.propertyPreferences.roommates=1.5
assert.equal(validateSection(profile,1).some(issue=>issue.field==='roommates'),true)
values.set(storage.HOUSING_PROFILE_STORAGE_KEY,'{broken');assert.equal(storage.loadHousingProfile(),null)
assert.equal(storage.resetHousingProfile(),true);assert.equal(storage.loadHousingProfile(),null)
globalThis.localStorage={getItem(){throw Error()},setItem(){throw Error()},removeItem(){throw Error()}}
assert.equal(storage.saveHousingProfile(draft),false);assert.equal(storage.loadHousingProfile(),null);assert.equal(storage.resetHousingProfile(),false)
console.log('PASS: required/optional validation, budget/date/numeric rules, exact persistence, malformed saved data, completed-state validation, reset and storage failures.')
