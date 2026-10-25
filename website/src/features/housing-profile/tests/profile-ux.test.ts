import assert from 'node:assert/strict'
import test from 'node:test'

import { createHousingProfile } from '../questions.ts'
import { canNavigateToSection, getProfileReview, importanceLabels, toggleAnswer } from '../profileUx.ts'
import { validateSection } from '../validation.ts'

function completeProfile() {
  const profile = createHousingProfile().profile
  Object.assign(profile.housingBasics, {
    city: 'Blacksburg',
    state: 'VA',
    transportation: 'Walking',
    moveInDate: '2027-08-15',
    lease: 'Academic year',
  })
  profile.propertyPreferences.housingTypes = ['Apartment']
  profile.priorities.ranked = ['Affordability', 'Walkability', 'Parking', 'Accessibility', 'Amenities']
  return profile
}

test('allows navigation to the current and completed sections only', () => {
  assert.equal(canNavigateToSection(2, 2, [0, 1]), true)
  assert.equal(canNavigateToSection(1, 2, [0]), true)
  assert.equal(canNavigateToSection(3, 2, [0, 1]), false)
  assert.equal(canNavigateToSection(1, 0, [0, 1]), true)
  assert.equal(canNavigateToSection(3, 1, [1, 3]), false)
  assert.equal(canNavigateToSection(2, 0, [1]), false)
})

test('maps each numeric importance rating to its display label', () => {
  assert.deepEqual(importanceLabels, {
    1: 'Barely matters',
    2: 'Nice to align',
    3: 'Worth discussing',
    4: 'Important',
    5: 'Essential to daily comfort',
  })
})

test('optional selected answers can be cleared without changing unrelated values', () => {
  assert.deepEqual(toggleAnswer(['Early bird', 'Quiet'], 'Early bird'), ['Quiet'])
  assert.deepEqual(toggleAnswer(['Quiet'], 'Lively'), ['Quiet', 'Lively'])
})

test('valid budget boundaries are accepted and contradictory rent limits identify both fields', () => {
  const profile = completeProfile()
  Object.assign(profile.housingBasics, { minRent: 1000, maxRent: 1000, totalBudget: 1000 })
  assert.deepEqual(validateSection(profile, 0), [])

  profile.housingBasics.minRent = 1200
  profile.housingBasics.maxRent = 1000
  const rentIssues = validateSection(profile, 0)
  assert.equal(rentIssues.some(issue => issue.field === 'minRent'), true)
  assert.equal(rentIssues.some(issue => issue.field === 'maxRent'), true)

  profile.housingBasics.minRent = 900
  profile.housingBasics.totalBudget = 800
  const totalIssues = validateSection(profile, 0)
  assert.equal(totalIssues.some(issue => issue.field === 'totalBudget'), true)
  assert.equal(totalIssues.some(issue => issue.field === 'maxRent'), true)
})

test('rejects negative, NaN, and infinite budget values without changing numeric values', () => {
  const profile = completeProfile()
  for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    profile.housingBasics.minRent = value
    const issues = validateSection(profile, 0)
    assert.equal(issues.some(issue => issue.field === 'minRent'), true)
    assert.equal(profile.housingBasics.minRent, value)
  }
})

test('separates blocking omissions from lifestyle, priorities, and custom-location suggestions', () => {
  const incomplete = getProfileReview(createHousingProfile().profile)
  assert.equal(incomplete.blocking.length > 0, true)
  assert.equal(incomplete.suggestions.length, 0)

  const profile = completeProfile()
  profile.housingBasics.city = 'A custom city'
  profile.lifestyle.smoking = 'Smoker'
  profile.roommatePreferences.dealbreakers = ['Smoking indoors']
  profile.priorities.flexible = ['Affordability']
  const review = getProfileReview(profile)
  assert.equal(review.blocking.length, 0)
  assert.equal(review.suggestions.some(item => item.message.includes('Smoking indoors')), true)
  assert.equal(review.suggestions.some(item => item.message.includes('both your top priorities')), true)
  assert.equal(review.suggestions.some(item => item.message.includes('custom city and state')), true)
})

test('flags a legacy semester without guessing the term', () => {
  const profile = completeProfile()
  profile.housingBasics.lease = 'Semester'
  const review = getProfileReview(profile)
  assert.equal(review.suggestions.some(item => item.message.includes('does not specify a term')), true)
})
