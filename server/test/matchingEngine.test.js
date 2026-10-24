import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateDeterministicMatch, validateAiAnalysis, validateProfiles } from '../matchingEngine.js';

const compatibleSeeker = {
  monthlyBudget: 1000,
  leaseDurationMonths: 12,
  sleepSchedule: 'early',
  quietHours: '10pm-7am',
  smokingPreferences: 'no smoking'
};

const compatibleHost = {
  monthlyRent: 850,
  minimumLeaseMonths: 6,
  sleepSchedule: 'early',
  quietHours: '10pm-7am',
  smokingPreferences: 'no smoking'
};

test('scores a compatible match using only deterministic comparisons', () => {
  const result = calculateDeterministicMatch(compatibleSeeker, compatibleHost);
  assert.equal(result.eligible, true);
  assert.equal(result.compatibilityScore, 100);
  assert.deepEqual(result.hardConstraints, []);
});

test('scores conflicting preferences deterministically', () => {
  const result = calculateDeterministicMatch(
    { ...compatibleSeeker, sleepSchedule: 'late', quietHours: 'none' },
    compatibleHost
  );
  assert.equal(result.eligible, true);
  assert.equal(result.compatibilityScore, 60);
});

test('marks a match ineligible when rent exceeds the budget', () => {
  const result = calculateDeterministicMatch(
    { ...compatibleSeeker, monthlyBudget: 700 },
    compatibleHost
  );
  assert.equal(result.eligible, false);
  assert.match(result.hardConstraints[0], /exceeds/);
});

test('returns a null score when fewer than three fields are comparable', () => {
  const result = calculateDeterministicMatch({ monthlyBudget: 1000 }, { monthlyRent: 900 });
  assert.equal(result.compatibilityScore, null);
});

test('rejects missing and invalid profiles', () => {
  assert.match(validateProfiles({ host: {} }), /seeker/);
  assert.match(validateProfiles({ seeker: [], host: {} }), /seeker/);
  assert.match(validateProfiles({ seeker: {}, host: {} }), /cannot be empty/);
});

test('validates and strips unexpected AI response values', () => {
  const result = validateAiAnalysis({
    summary: 'A cautious summary.',
    strengths: ['Shared quiet hours.', 42],
    conflicts: [],
    questions: ['Discuss guests?'],
    missingInformation: ['Pet policy.'],
    compatibilityScore: 100
  });
  assert.deepEqual(result.strengths, ['Shared quiet hours.']);
  assert.equal('compatibilityScore' in result, false);
});

test('importance weights change the score without becoming dealbreakers', () => {
  const result = calculateDeterministicMatch(
    {
      monthlyBudget: 1200,
      sleepSchedule: 'Early bird',
      noisePreference: 'Quiet',
      importance: {
        'Sleep schedule compatibility': 1,
        'Noise compatibility': 5
      }
    },
    {
      monthlyRent: 1000,
      sleepSchedule: 'Night owl',
      noisePreference: 'Quiet',
      importance: {
        'Sleep schedule compatibility': 1,
        'Noise compatibility': 5
      }
    }
  );
  assert.equal(result.compatibilityScore, 86);
  assert.equal(result.eligible, true);
});

test('confirmed dealbreakers are evaluated separately from the score', () => {
  const result = calculateDeterministicMatch(
    {
      monthlyBudget: 1200,
      sleepSchedule: 'Flexible',
      petPreferences: 'Prefer no pets',
      dealbreakers: ['Pets in the home']
    },
    {
      monthlyRent: 1000,
      sleepSchedule: 'Flexible',
      petPreferences: 'Have pets'
    }
  );
  assert.equal(result.eligible, false);
  assert.equal(result.dealbreakerConflicts.length, 1);
  assert.match(result.dealbreakerConflicts[0], /having pets/);
});

test('ambiguous and missing answers require discussion without automatic rejection', () => {
  const result = calculateDeterministicMatch(
    {
      monthlyBudget: 1200,
      sleepSchedule: 'Early bird',
      dealbreakers: ['Smoking indoors', 'Unannounced guests']
    },
    {
      monthlyRent: 1000,
      smokingPreferences: 'Smoker',
      noisePreference: 'Moderate'
    }
  );
  assert.equal(result.eligible, true);
  assert.ok(result.discussionItems.some(item => item.includes('smoking location')));
  assert.ok(result.discussionItems.some(item => item.includes('notice expectations')));
  assert.ok(result.missingInformation.some(item => item.includes('Noise preference')));
});
