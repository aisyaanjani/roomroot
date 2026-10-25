
import { useEffect, useRef, useState } from "react";

import SearchBar from "./components/SearchBar";
import FilterSidebar from "./components/FilterSidebar";
import PropertyCard from "./components/PropertyCard";
import PropertyDetails from "./components/PropertyDetails";
import NeighborhoodMap from "./components/NeighborhoodMap";

import { sampleListings } from "./data/sampleListings";
import type { HousingListing } from "./types/listingTypes";
import { listingMatchesSearch } from "./searchListings";

import "./rmbrowsing.css";

interface FilterValues {
  transactionType: string;
  propertyType: string;
  minPrice: string;
  maxPrice: string;
  bedrooms: string;
  hasKitchen: boolean;
  centralAir: boolean;
  heating: boolean;
  washerDryer: boolean;
  inUnitLaundry: boolean;
  parking: boolean;
  furnished: boolean;
  petsAllowed: boolean;
}

const defaultFilters: FilterValues = {
  transactionType: "",
  propertyType: "",
  minPrice: "",
  maxPrice: "",
  bedrooms: "",
  hasKitchen: false,
  centralAir: false,
  heating: false,
  washerDryer: false,
  inUnitLaundry: false,
  parking: false,
  furnished: false,
  petsAllowed: false,
};

function RoomBrowsing() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<FilterValues>(defaultFilters);
  const [selectedListing, setSelectedListing] =
    useState<HousingListing | null>(null);

  const [sortOption, setSortOption] = useState("recommended");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);

  // Property comparison state
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [isComparePanelOpen, setIsComparePanelOpen] = useState(false);
  const [showComparisonTable, setShowComparisonTable] = useState(false);
  const [keepComparisonTrigger, setKeepComparisonTrigger] = useState(false);
  const comparisonDialogRef = useRef<HTMLElement>(null);
  const comparisonTriggerRef = useRef<HTMLButtonElement>(null);

  // Neighborhood comparison state
  const [showNeighborhoodComparison, setShowNeighborhoodComparison] =
    useState(false);

  const toggleFavorite = (listingId: string) => {
    setFavoriteIds((currentFavorites) =>
      currentFavorites.includes(listingId)
        ? currentFavorites.filter((id) => id !== listingId)
        : [...currentFavorites, listingId]
    );
  };

  const toggleCompare = (listingId: string) => {
    setCompareIds((currentIds) => {
      if (currentIds.includes(listingId)) {
        return currentIds.filter((id) => id !== listingId);
      }

      if (currentIds.length >= 3) {
        return currentIds;
      }

      return [...currentIds, listingId];
    });

    setShowComparisonTable(false);
    setShowNeighborhoodComparison(false);
  };

  const comparisonListings = sampleListings.filter((listing) =>
    compareIds.includes(listing.id)
  );

  const closeComparePanel = () => {
    setIsComparePanelOpen(false);
    setShowNeighborhoodComparison(false);
  };

  // Keep keyboard focus within the modal and restore it to the opener on close.
  useEffect(() => {
    if (!isComparePanelOpen) {
      comparisonTriggerRef.current?.focus();
      return;
    }

    const dialog = comparisonDialogRef.current;
    if (!dialog) return;

    const getFocusableElements = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.getClientRects().length > 0);

    getFocusableElements()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeComparePanel();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = getFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const focusIsOutsideDialog = !dialog.contains(document.activeElement);

      if (
        event.shiftKey &&
        (document.activeElement === firstElement || focusIsOutsideDialog)
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === lastElement || focusIsOutsideDialog)
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isComparePanelOpen]);

  // Apply search and filters.
  const filteredListings = sampleListings.filter(
    (listing: HousingListing) => {
      const matchesSearch = listingMatchesSearch(listing, searchTerm);

      const matchesTransaction =
        !filters.transactionType ||
        listing.transactionType === filters.transactionType;

      const matchesProperty =
        !filters.propertyType ||
        listing.propertyType === filters.propertyType;

      const matchesMinPrice =
        !filters.minPrice ||
        listing.price >= Number(filters.minPrice);

      const matchesMaxPrice =
        !filters.maxPrice ||
        listing.price <= Number(filters.maxPrice);

      const matchesBedrooms =
        !filters.bedrooms ||
        listing.bedrooms >= Number(filters.bedrooms);

      const matchesKitchen =
        !filters.hasKitchen || listing.hasKitchen === true;

      const matchesCentralAir =
        !filters.centralAir || listing.centralAir === true;

      const matchesHeating =
        !filters.heating || listing.heating === true;

      const matchesWasherDryer =
        !filters.washerDryer || listing.washerDryer === true;

      const matchesInUnitLaundry =
        !filters.inUnitLaundry || listing.inUnitLaundry === true;

      const matchesParking =
        !filters.parking || listing.parking === true;

      const matchesFurnished =
        !filters.furnished || listing.furnished === true;

      const matchesPets =
        !filters.petsAllowed || listing.petsAllowed === true;

      return (
        matchesSearch &&
        matchesTransaction &&
        matchesProperty &&
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesBedrooms &&
        matchesKitchen &&
        matchesCentralAir &&
        matchesHeating &&
        matchesWasherDryer &&
        matchesInUnitLaundry &&
        matchesParking &&
        matchesFurnished &&
        matchesPets
      );
    }
  );

  // Sort listings.
  const sortedListings = [...filteredListings].sort((a, b) => {
    switch (sortOption) {
      case "price-low":
        return a.price - b.price;
      case "price-high":
        return b.price - a.price;
      case "bedrooms-low":
        return a.bedrooms - b.bedrooms;
      case "bedrooms-high":
        return b.bedrooms - a.bedrooms;
      default:
        return 0;
    }
  });

  const displayedListings = showFavorites
    ? sortedListings.filter((listing) =>
        favoriteIds.includes(listing.id)
      )
    : sortedListings;

  const clearAllFilters = () => {
    setSearchTerm("");
    setFilters(defaultFilters);
    setSortOption("recommended");
  };

  if (selectedListing) {
    return (
      <main className="room-browsing">
        <PropertyDetails
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
        />
      </main>
    );
  }

  return (
    <main className="room-browsing">
      <header className="browsing-header">
        <h1>Find Your Place with ROOMROOT</h1>
        <p>
          Discover a space that fits your lifestyle, budget,
          and housing needs.
        </p>
      </header>

      <SearchBar onSearch={setSearchTerm} />

      <div className="browsing-layout">
        <FilterSidebar
          transactionType={filters.transactionType}
          propertyType={filters.propertyType}
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          bedrooms={filters.bedrooms}
          hasKitchen={filters.hasKitchen}
          centralAir={filters.centralAir}
          heating={filters.heating}
          washerDryer={filters.washerDryer}
          inUnitLaundry={filters.inUnitLaundry}
          parking={filters.parking}
          furnished={filters.furnished}
          petsAllowed={filters.petsAllowed}
          onFilterChange={setFilters}
        />

        <section className="browsing-results">
          <div className="browsing-results-header">
            <div>
              <h2>
                {showFavorites
                  ? "My Favorite Listings"
                  : "Available Housing"}
              </h2>
              <p>
                {displayedListings.length}{" "}
                {displayedListings.length === 1
                  ? "listing"
                  : "listings"}{" "}
                found
              </p>
            </div>

            <div className="results-action-buttons">
              <button
                type="button"
                onClick={clearAllFilters}
                className="clear-filters-button"
              >
                Clear All Filters
              </button>

              <button
                type="button"
                className="favorites-filter-button"
                onClick={() => setShowFavorites(!showFavorites)}
              >
                {showFavorites
                  ? "Show All Listings"
                  : "My Favorites"}
              </button>
            </div>
          </div>

          <div className="sorting-controls">
            <label htmlFor="sort-listings">Sort by:</label>
            <select
              id="sort-listings"
              value={sortOption}
              onChange={(event) => setSortOption(event.target.value)}
            >
              <option value="recommended">Recommended</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="bedrooms-low">Bedrooms: Fewest to Most</option>
              <option value="bedrooms-high">Bedrooms: Most to Fewest</option>
            </select>
          </div>

          {displayedListings.length > 0 ? (
            <div className="property-listings">
              {displayedListings.map((listing: HousingListing) => (
                <div
                  className="property-comparison-wrapper"
                  key={listing.id}
                >
                  <PropertyCard
                    listing={listing}
                    onViewDetails={setSelectedListing}
                    isFavorite={favoriteIds.includes(listing.id)}
                    onToggleFavorite={toggleFavorite}
                  />

                  <button
                    type="button"
                    className={`compare-property-button ${
                      compareIds.includes(listing.id) ? "selected" : ""
                    }`}
                    onClick={() => toggleCompare(listing.id)}
                    disabled={
                      compareIds.length >= 3 &&
                      !compareIds.includes(listing.id)
                    }
                  >
                    {compareIds.includes(listing.id)
                      ? "Remove from Comparison"
                      : compareIds.length >= 3
                        ? "Comparison Full"
                        : "Add to Compare"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-listings">
              <h3>
                {showFavorites
                  ? "No favorite listings yet"
                  : "No listings found"}
              </h3>
              <p>
                {showFavorites
                  ? "Click the heart on a property to save it to your favorites."
                  : "Try changing your search or adjusting your filters to find more housing options."}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (showFavorites) {
                    setShowFavorites(false);
                  } else {
                    clearAllFilters();
                  }
                }}
              >
                {showFavorites ? "Show All Listings" : "Reset Search"}
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Floating comparison button */}
      {(compareIds.length > 0 ||
        isComparePanelOpen ||
        keepComparisonTrigger) && (
        <button
          ref={comparisonTriggerRef}
          type="button"
          className="comparison-floating-button"
          onClick={(event) => {
            comparisonTriggerRef.current = event.currentTarget;
            setKeepComparisonTrigger(true);
            setIsComparePanelOpen(true);
          }}
          onBlur={() => {
            if (!isComparePanelOpen && compareIds.length === 0) {
              setKeepComparisonTrigger(false);
            }
          }}
        >
          Compare Properties ({compareIds.length}/3)
        </button>
      )}

      {/* Slide-out comparison panel */}
      {isComparePanelOpen && (
        <div
          className="comparison-overlay"
          onClick={closeComparePanel}
        >
          <aside
            ref={comparisonDialogRef}
            className="comparison-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="comparison-panel-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="comparison-drawer-header">
              <div>
                <h2 id="comparison-panel-title">
                  {showNeighborhoodComparison
                    ? "Compare Neighborhoods"
                    : "Compare Properties"}
                </h2>
                <p>{compareIds.length} of 3 properties selected</p>
              </div>

              <button
                type="button"
                className="comparison-close-button"
                onClick={closeComparePanel}
                aria-label="Close comparison panel"
              >
                ×
              </button>
            </div>

            <div className="comparison-drawer-content">
              {comparisonListings.length > 0 ? (
                <>
                  {/* Selected properties */}
                  <div className="comparison-selected-list">
                    {comparisonListings.map((listing) => (
                      <div
                        className="comparison-selected-item"
                        key={listing.id}
                      >
                        <div>
                          <strong>{listing.title}</strong>
                          <p>
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 0,
                            }).format(listing.price)}
                            {listing.transactionType !== "buy"
                              ? "/month"
                              : ""}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleCompare(listing.id)}
                          aria-label={`Remove ${listing.title} from comparison`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="clear-comparison-button"
                    onClick={() => {
                      setCompareIds([]);
                      setShowComparisonTable(false);
                      setShowNeighborhoodComparison(false);
                    }}
                  >
                    Clear all properties
                  </button>

                  {/* Switch between property and neighborhood comparison */}
                  <div className="comparison-mode-buttons">
                    <button
                      type="button"
                      className={`comparison-mode-button ${
                        !showNeighborhoodComparison ? "active" : ""
                      }`}
                      onClick={() => setShowNeighborhoodComparison(false)}
                    >
                      Compare Properties
                    </button>

                    <button
                      type="button"
                      className={`comparison-mode-button ${
                        showNeighborhoodComparison ? "active" : ""
                      }`}
                      disabled={compareIds.length < 2}
                      onClick={() => setShowNeighborhoodComparison(true)}
                    >
                      Compare Neighborhoods
                    </button>
                  </div>

                  {!showNeighborhoodComparison && (
                    <>
                      <button
                        type="button"
                        className="view-comparison-button"
                        disabled={compareIds.length < 2}
                        onClick={() =>
                          setShowComparisonTable(!showComparisonTable)
                        }
                      >
                        {showComparisonTable
                          ? "Hide Comparison"
                          : "Compare Now"}
                      </button>

                      {compareIds.length < 2 && (
                        <p className="comparison-help-text">
                          Select at least 2 properties to compare them.
                        </p>
                      )}

                      {showComparisonTable &&
                        comparisonListings.length >= 2 && (
                          <div className="comparison-table-wrapper">
                            <table className="comparison-table">
                              <thead>
                                <tr>
                                  <th>Property Details</th>
                                  {comparisonListings.map((listing) => (
                                    <th key={listing.id}>
                                      {listing.title}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {[
                                  {
                                    label: "Price",
                                    value: (l: HousingListing) =>
                                      new Intl.NumberFormat("en-US", {
                                        style: "currency",
                                        currency: "USD",
                                        maximumFractionDigits: 0,
                                      }).format(l.price) +
                                      (l.transactionType !== "buy"
                                        ? "/month"
                                        : ""),
                                  },
                                  {
                                    label: "Location",
                                    value: (l: HousingListing) =>
                                      `${l.city}, ${l.state}`,
                                  },
                                  {
                                    label: "Property Type",
                                    value: (l: HousingListing) =>
                                      l.propertyType.replace("-", " "),
                                  },
                                  {
                                    label: "Bedrooms",
                                    value: (l: HousingListing) =>
                                      String(l.bedrooms),
                                  },
                                  {
                                    label: "Bathrooms",
                                    value: (l: HousingListing) =>
                                      String(l.bathrooms),
                                  },
                                  {
                                    label: "Square Feet",
                                    value: (l: HousingListing) =>
                                      l.squareFeet
                                        ? l.squareFeet.toLocaleString()
                                        : "Not provided",
                                  },
                                  {
                                    label: "Furnished",
                                    value: (l: HousingListing) =>
                                      l.furnished ? "Yes" : "No",
                                  },
                                  {
                                    label: "Pets Allowed",
                                    value: (l: HousingListing) =>
                                      l.petsAllowed ? "Yes" : "No",
                                  },
                                  {
                                    label: "Parking",
                                    value: (l: HousingListing) =>
                                      l.parking ? "Yes" : "No",
                                  },
                                  {
                                    label: "Kitchen",
                                    value: (l: HousingListing) =>
                                      l.hasKitchen ? "Yes" : "No",
                                  },
                                  {
                                    label: "Central Air",
                                    value: (l: HousingListing) =>
                                      l.centralAir ? "Yes" : "No",
                                  },
                                  {
                                    label: "Heating",
                                    value: (l: HousingListing) =>
                                      l.heating ? "Yes" : "No",
                                  },
                                  {
                                    label: "Washer & Dryer",
                                    value: (l: HousingListing) =>
                                      l.washerDryer ? "Yes" : "No",
                                  },
                                  {
                                    label: "In-Unit Laundry",
                                    value: (l: HousingListing) =>
                                      l.inUnitLaundry ? "Yes" : "No",
                                  },
                                ].map((row) => (
                                  <tr key={row.label}>
                                    <td>{row.label}</td>
                                    {comparisonListings.map((listing) => (
                                      <td key={listing.id}>
                                        {row.value(listing)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                    </>
                  )}

                  {/* Neighborhood comparison */}
                  {showNeighborhoodComparison && (
                    <section className="neighborhood-comparison">
                      <div className="neighborhood-comparison-intro">
                        <h3>Neighborhood Overview</h3>
                        <p>
                          Explore estimated walkability, nearby amenities,
                          public transportation, and official crime
                          information for the areas around your selected
                          properties.
                        </p>
                      </div>

                      <div className="comparison-table-wrapper">
                        <table className="comparison-table neighborhood-table">
                          <thead>
                            <tr>
                              <th>Neighborhood Information</th>
                              {comparisonListings.map((listing) => (
                                <th key={listing.id}>
                                  {listing.city}, {listing.state}
                                </th>
                              ))}
                            </tr>
                          </thead>

                          <tbody>
                            <tr>
                              <td>Property Address</td>
                              {comparisonListings.map((listing) => (
                                <td key={listing.id}>
                                  {listing.address}
                                </td>
                              ))}
                            </tr>

                            <tr>
                              <td>ZIP Code</td>
                              {comparisonListings.map((listing) => (
                                <td key={listing.id}>
                                  {listing.zipCode}
                                </td>
                              ))}
                            </tr>

                            <tr>
                              <td>Walkability Information</td>
                              {comparisonListings.map((listing) => {
                                const score =
                                  listing.accessibilityScores.overall;

                                const rating =
                                  score >= 85
                                    ? "Excellent"
                                    : score >= 70
                                      ? "Good"
                                      : score >= 50
                                        ? "Fair"
                                        : "Limited";

                                return (
                                  <td key={listing.id}>
                                    <strong>{score}/100</strong>
                                    <br />
                                    {rating}
                                    <br />
                                    <small>Estimated score</small>
                                  </td>
                                );
                              })}
                            </tr>

                            <tr>
                              <td>Public Transportation</td>
                              {comparisonListings.map((listing) => (
                                <td key={listing.id}>
                                  {listing.city.toLowerCase() ===
                                  "blacksburg" ? (
                                    <a
                                      href="https://www.ridebt.org/schedules"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Blacksburg Transit schedules
                                    </a>
                                  ) : listing.city.toLowerCase() ===
                                    "roanoke" ? (
                                    <a
                                      href="https://www.valleymetro.com/"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Valley Metro routes
                                    </a>
                                  ) : (
                                    "Transit information unavailable"
                                  )}
                                </td>
                              ))}
                            </tr>

                            <tr>
                              <td>Nearby Grocery Stores</td>
                              {comparisonListings.map((listing) => (
                                <td key={listing.id}>
                                  View grocery store markers on the map below
                                </td>
                              ))}
                            </tr>

                            <tr>
                              <td>Parks and Recreation</td>
                              {comparisonListings.map((listing) => (
                                <td key={listing.id}>
                                  View park markers on the map below
                                </td>
                              ))}
                            </tr>

                            <tr>
                              <td>Crime Statistics</td>
                              {comparisonListings.map((listing) => (
                                <td key={listing.id}>
                                  {listing.city.toLowerCase() ===
                                  "blacksburg" ? (
                                    <a
                                      href="https://www.blacksburg.gov/departments/departments-l-z/police/crime-mapping"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Official Blacksburg crime map
                                    </a>
                                  ) : listing.city.toLowerCase() ===
                                    "roanoke" ? (
                                    <a
                                      href="https://www.roanokeva.gov/334/Crime-Mapping"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Official Roanoke crime map
                                    </a>
                                  ) : (
                                    "Official crime information unavailable"
                                  )}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Interactive neighborhood map */}
                      <NeighborhoodMap />

                      <p className="neighborhood-data-note">
                        Walkability scores are estimates based on the sample
                        listing data. Nearby amenities are displayed using
                        available map information. Transit and crime links
                        direct users to local resources. Because sample
                        property addresses are fictional, map locations
                        represent approximate areas rather than exact
                        properties.
                      </p>
                    </section>
                  )}
                </>
              ) : (
                <p className="comparison-help-text">
                  No properties selected. Close this panel and add
                  properties using the Add to Compare buttons.
                </p>
              )}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

export default RoomBrowsing;
