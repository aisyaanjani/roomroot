/// <reference types="node" />
import assert from 'node:assert/strict'
import test from 'node:test'
import { createHousingProfile } from '../../housing-profile/questions.ts'
import { adaptHousingProfile, createMatchingRequest } from '../adapter.ts'

test('adapts the exported HousingProfileData contract without changing it', () => {
  const profile = createHousingProfile().profile
  profile.housingBasics = {
    ...profile.housingBasics,
    city: 'Boston', state: 'MA', minRent: 900, maxRent: 1500,
    moveInDate: '2027-01-01', lease: '6 months',
  }
  profile.propertyPreferences.housingTypes = ['Apartment']
  profile.lifestyle.sleep = 'Early bird'
  profile.lifestyle.noise = 'Quiet'
  profile.roommatePreferences.dealbreakers = ['Late-night noise']

  const adapted = adaptHousingProfile(profile)
  assert.equal(adapted.location, 'Boston, MA')
  assert.equal(adapted.budgetMin, 900)
  assert.equal(adapted.budgetMax, 1500)
  assert.equal(adapted.leaseDurationMonths, 6)
  assert.equal(adapted.sleepSchedule, 'Early bird')
  assert.equal(adapted.noisePreference, 'Quiet')
  assert.deepEqual(adapted.dealbreakers, ['Late-night noise'])
});

test('creates the seeker and host API payload from two questionnaire profiles', () => {
  const seeker = createHousingProfile().profile
  const host = createHousingProfile().profile
  seeker.housingBasics.city = 'Boston'
  host.housingBasics.city = 'Cambridge'
  host.housingBasics.lease = '12 months'
  const request = createMatchingRequest(seeker, host)
  assert.equal(request.seeker.location, 'Boston')
  assert.equal(request.host.location, 'Cambridge')
  assert.equal(request.host.minimumLeaseMonths, 12)
  assert.equal(request.host.maximumLeaseMonths, 12)
});
