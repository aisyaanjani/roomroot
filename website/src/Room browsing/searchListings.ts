import type { HousingListing } from './types/listingTypes'

/** The same local, free-text match used for typed searches and selected suggestions. */
export function listingMatchesSearch(listing: HousingListing, searchTerm: string) {
  const search = searchTerm.trim().toLowerCase()
  return listing.title.toLowerCase().includes(search) ||
    listing.location.toLowerCase().includes(search) ||
    listing.address.toLowerCase().includes(search) ||
    listing.city.toLowerCase().includes(search) ||
    listing.state.toLowerCase().includes(search) ||
    listing.zipCode.includes(search)
}
