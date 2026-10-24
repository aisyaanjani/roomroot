
import { useState } from "react";

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

interface FilterSidebarProps extends FilterValues {
  onFilterChange: (filters: FilterValues) => void;
}

function FilterSidebar({
  transactionType,
  propertyType,
  minPrice,
  maxPrice,
  bedrooms,
  hasKitchen,
  centralAir,
  heating,
  washerDryer,
  inUnitLaundry,
  parking,
  furnished,
  petsAllowed,
  onFilterChange,
}: FilterSidebarProps) {
  const [showAdditionalFilters, setShowAdditionalFilters] =
    useState(false);

  const updateFilter = <K extends keyof FilterValues>(
    name: K,
    value: FilterValues[K]
  ) => {
    onFilterChange({
      transactionType,
      propertyType,
      minPrice,
      maxPrice,
      bedrooms,
      hasKitchen,
      centralAir,
      heating,
      washerDryer,
      inUnitLaundry,
      parking,
      furnished,
      petsAllowed,
      [name]: value,
    });
  };

  return (
    <aside className="filter-sidebar">
      <h2>Filters</h2>

      <div className="filter-group">
        <label htmlFor="transactionType">Listing Type</label>
        <select
          id="transactionType"
          value={transactionType}
          onChange={(event) =>
            updateFilter("transactionType", event.target.value)
          }
        >
          <option value="">All Listings</option>
          <option value="rent">Rent</option>
          <option value="buy">Buy</option>
          <option value="sublease">Sublease</option>
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="propertyType">Property Type</label>
        <select
          id="propertyType"
          value={propertyType}
          onChange={(event) =>
            updateFilter("propertyType", event.target.value)
          }
        >
          <option value="">All Property Types</option>
          <option value="apartment">Apartments</option>
          <option value="house">Houses</option>
          <option value="condo">Condos</option>
          <option value="private-room">Private Rooms</option>
          <option value="shared-room">Shared Rooms</option>
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="minPrice">Minimum Price</label>
        <input
          id="minPrice"
          type="number"
          min="0"
          placeholder="No minimum"
          value={minPrice}
          onChange={(event) =>
            updateFilter("minPrice", event.target.value)
          }
        />
      </div>

      <div className="filter-group">
        <label htmlFor="maxPrice">Maximum Price</label>
        <input
          id="maxPrice"
          type="number"
          min="0"
          placeholder="No maximum"
          value={maxPrice}
          onChange={(event) =>
            updateFilter("maxPrice", event.target.value)
          }
        />
      </div>

      <div className="filter-group">
        <label htmlFor="bedrooms">Bedrooms</label>
        <select
          id="bedrooms"
          value={bedrooms}
          onChange={(event) =>
            updateFilter("bedrooms", event.target.value)
          }
        >
          <option value="">Any</option>
          <option value="1">1+</option>
          <option value="2">2+</option>
          <option value="3">3+</option>
          <option value="4">4+</option>
        </select>
      </div>

      <div className="additional-filters">
        <button
          type="button"
          className="additional-filters-toggle"
          onClick={() =>
            setShowAdditionalFilters(!showAdditionalFilters)
          }
          aria-expanded={showAdditionalFilters}
        >
          <span>Amenities</span>
          <span>
            {showAdditionalFilters ? "Hide" : "Show"}
          </span>
        </button>

        {showAdditionalFilters && (
          <div className="additional-filters-content">
            <p className="additional-filters-description">
              Select the features you want in your property.
            </p>

            <label className="amenity-checkbox">
              <input
                type="checkbox"
                checked={hasKitchen}
                onChange={(event) =>
                  updateFilter("hasKitchen", event.target.checked)
                }
              />
              Kitchen
            </label>

            <label className="amenity-checkbox">
              <input
                type="checkbox"
                checked={centralAir}
                onChange={(event) =>
                  updateFilter("centralAir", event.target.checked)
                }
              />
              Central Air Conditioning
            </label>

            <label className="amenity-checkbox">
              <input
                type="checkbox"
                checked={heating}
                onChange={(event) =>
                  updateFilter("heating", event.target.checked)
                }
              />
              Heating
            </label>

            <label className="amenity-checkbox">
              <input
                type="checkbox"
                checked={washerDryer}
                onChange={(event) =>
                  updateFilter("washerDryer", event.target.checked)
                }
              />
              Washer and Dryer
            </label>

            <label className="amenity-checkbox">
              <input
                type="checkbox"
                checked={inUnitLaundry}
                onChange={(event) =>
                  updateFilter("inUnitLaundry", event.target.checked)
                }
              />
              In-Unit Laundry
            </label>

            <label className="amenity-checkbox">
              <input
                type="checkbox"
                checked={parking}
                onChange={(event) =>
                  updateFilter("parking", event.target.checked)
                }
              />
              Parking
            </label>

            <label className="amenity-checkbox">
              <input
                type="checkbox"
                checked={furnished}
                onChange={(event) =>
                  updateFilter("furnished", event.target.checked)
                }
              />
              Furnished
            </label>

            <label className="amenity-checkbox">
              <input
                type="checkbox"
                checked={petsAllowed}
                onChange={(event) =>
                  updateFilter("petsAllowed", event.target.checked)
                }
              />
              Pets Allowed
            </label>
          </div>
        )}
      </div>
    </aside>
  );
}

export default FilterSidebar;
