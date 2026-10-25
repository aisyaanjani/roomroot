/// <reference types="node" />
import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateLocalMatch } from '../deterministicMatching.ts'

test('calculates deterministic matching scores without provider-generated output', () => {
  const seeker = {
    budgetMin: 700,
    budgetMax: 1000,
    leaseDurationMonths: 12,
    location: 'Blacksburg, VA',
    moveInDate: '2027-01-10',
    housingTypes: ['Apartment'],
    sleepSchedule: 'Early bird',
    noisePreference: 'Quiet',
    cleanliness: 'Very organized',
    smokingPreferences: 'Prefer smoke-free home',
    importance: { 'Noise compatibility': 5 },
  }
  const host = {
    budgetMin: 650,
    budgetMax: 1150,
    minimumLeaseMonths: 12,
    maximumLeaseMonths: 12,
    location: 'Blacksburg, VA',
    moveInDate: '2027-01-10',
    housingTypes: ['Apartment', 'Shared house'],
    sleepSchedule: 'Night owl',
    noisePreference: 'Quiet',
    cleanliness: 'Very organized',
    smokingPreferences: 'Non-smoker',
    importance: { 'Noise compatibility': 5 },
  }
  const result = calculateLocalMatch(seeker, host)
  assert.equal(result.compatibilityScore, 92)
  assert.equal(result.eligible, true)
  assert.equal(result.aiGenerated, false)
  assert.equal(result.breakdown.find(item => item.field === 'smoking preferences')?.matches, true)
  assert.equal(result.breakdown.find(item => item.field === 'noise preference')?.weight, 5)
})

test('marks rent, lease, and confirmed dealbreaker conflicts separately from the score', () => {
  const result = calculateLocalMatch(
    {
      budgetMin: 1200,
      budgetMax: 1500,
      leaseDurationMonths: 6,
      housingTypes: ['Apartment'],
      dealbreakers: ['Pets in the home'],
    },
    {
      budgetMin: 800,
      budgetMax: 1000,
      minimumLeaseMonths: 12,
      maximumLeaseMonths: 12,
      housingTypes: ['House'],
      petPreferences: 'Have pets',
    },
  )
  assert.equal(result.compatibilityScore, 0)
  assert.equal(result.eligible, false)
  assert.ok(result.hardConstraints.some(item => item.includes('rent ranges do not overlap')))
  assert.ok(result.hardConstraints.some(item => item.includes('lease duration')))
  assert.equal(result.dealbreakerConflicts.length, 1)
  assert.equal(result.aiGenerated, false)
})

test('requires three shared comparisons before showing a compatibility percentage', () => {
  const result = calculateLocalMatch(
    { budgetMin: 500, budgetMax: 1000, leaseDurationMonths: 12 },
    { budgetMin: 600, budgetMax: 900, minimumLeaseMonths: 12 },
  )
  assert.equal(result.compatibilityScore, null)
})
