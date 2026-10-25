import assert from 'node:assert/strict'
import test from 'node:test'
import { filterBrowseLocations } from '../../features/housing-profile/locationData'
import { sampleListings } from '../data/sampleListings'
import { listingMatchesSearch } from '../searchListings'

test('local suggestions include cities, neighborhoods, and landmarks', () => {
  assert.equal(filterBrowseLocations('black').includes('Blacksburg'), true)
  assert.equal(filterBrowseLocations('heth').includes('Hethwood'), true)
  assert.equal(filterBrowseLocations('research').includes('Corporate Research Center'), true)
})

test('selected suggestions and ordinary free text use the existing listing filter', () => {
  const city = sampleListings.filter(listing => listingMatchesSearch(listing, 'Blacksburg'))
  assert.equal(city.length > 0, true)
  const listing = sampleListings[0]!
  assert.equal(listingMatchesSearch(listing, listing.title), true)
  assert.equal(listingMatchesSearch(listing, listing.address), true)
})

test('autocomplete is a pure local lookup and does not request the network', () => {
  let calls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = (() => { calls += 1; throw new Error('unexpected network request') }) as typeof fetch
  try { filterBrowseLocations('virginia') } finally { globalThis.fetch = originalFetch }
  assert.equal(calls, 0)
})
