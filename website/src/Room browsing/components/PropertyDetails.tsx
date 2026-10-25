
import type { HousingListing } from "../types/listingTypes";

interface PropertyDetailsProps {
  listing: HousingListing;
  onClose: () => void;
}

function getAccessibilityLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  return "Limited";
}

function PropertyDetails({ listing, onClose }: PropertyDetailsProps) {
  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(listing.price);

  const priceLabel =
    listing.transactionType === "buy"
      ? formattedPrice
      : `${formattedPrice}/month`;

  const accessibility = listing.accessibilityScores;

  const accessibilityCategories = [
    { label: "Overall Accessibility", score: accessibility.overall },
    { label: "Grocery Access", score: accessibility.grocery },
    { label: "Restaurants", score: accessibility.restaurants },
    { label: "Parks", score: accessibility.parks },
    {
      label: "Public Transportation",
      score: accessibility.publicTransportation,
    },
    {
      label: "Schools & Hospitals",
      score: accessibility.schoolsAndHospitals,
    },
  ];

  const amenities = [
    { label: "Furnished", available: listing.furnished },
    { label: "Pets Allowed", available: listing.petsAllowed },
    { label: "Parking", available: listing.parking },
    { label: "Kitchen", available: listing.hasKitchen },
    { label: "Central Air", available: listing.centralAir },
    { label: "Heating", available: listing.heating },
    { label: "Washer & Dryer", available: listing.washerDryer },
    { label: "In-Unit Laundry", available: listing.inUnitLaundry },
  ];

  return (
    <div className="property-details-page">
      <button className="back-button" onClick={onClose}>
        Back to Listings
      </button>

      {/* TITLE AND PRICE */}

      <header className="details-heading">
        <div>
          <span className="details-listing-type">
            {listing.transactionType}
          </span>

          <h1>{listing.title}</h1>

          <p className="details-location">
            {listing.address}, {listing.city}, {listing.state}{" "}
            {listing.zipCode}
          </p>
        </div>

        <div className="details-price">
          <h2>{priceLabel}</h2>
          <p>
            {listing.transactionType === "buy"
              ? "Purchase price"
              : "Listed price"}
          </p>
        </div>
      </header>

      {/* PHOTO AND OVERVIEW */}

      <section className="details-main-layout">
        <div className="details-gallery">
          {listing.images.length > 0 ? (
            listing.images.map((image, index) => (
              <div
                className="details-gallery-image"
                key={`${listing.id}-image-${index}`}
              >
                <img
                  src={image}
                  alt={`${listing.title} photo ${index + 1}`}
                />
              </div>
            ))
          ) : (
            <div className="details-gallery-placeholder">
              <p>Property photos coming soon</p>
            </div>
          )}
        </div>

        <section className="details-section overview-section">
          <h2>Property Overview</h2>

          <div className="overview-grid">
            <div className="overview-item">
              <div>
                <strong>{listing.bedrooms}</strong>
                <p>Bedrooms</p>
              </div>
            </div>

            <div className="overview-item">
              <div>
                <strong>{listing.bathrooms}</strong>
                <p>Bathrooms</p>
              </div>
            </div>

            {listing.squareFeet && (
              <div className="overview-item">
                <div>
                  <strong>{listing.squareFeet.toLocaleString()}</strong>
                  <p>Square Feet</p>
                </div>
              </div>
            )}

            <div className="overview-item">
              <div>
                <strong>
                  {listing.propertyType.replace("-", " ")}
                </strong>
                <p>Property Type</p>
              </div>
            </div>
          </div>
        </section>
      </section>

      {/* NEIGHBORHOOD ACCESSIBILITY */}

      <section className="details-section accessibility-details">
        <h2>Neighborhood Accessibility</h2>

        <div className="accessibility-table-wrapper">
          <table className="accessibility-table">
            <thead>
              <tr>
                <th>Accessibility Category</th>
                <th>Score</th>
                <th>Rating</th>
              </tr>
            </thead>

            <tbody>
              {accessibilityCategories.map((category) => (
                <tr key={category.label}>
                  <td>{category.label}</td>
                  <td>{category.score}/100</td>
                  <td>{getAccessibilityLabel(category.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ABOUT THE PROPERTY */}

      <section className="details-section">
        <h2>About This Property</h2>
        <p className="details-description">{listing.description}</p>
      </section>

      {/* AMENITIES */}

      <section className="details-section">
        <h2>Amenities & Features</h2>

        <div className="amenities-grid">
          {amenities.map((amenity) => (
            <div className="amenity-item" key={amenity.label}>
              <p>{amenity.label}</p>

              <strong
                className={
                  amenity.available ? "available" : "unavailable"
                }
              >
                {amenity.available ? "Available" : "Not available"}
              </strong>
            </div>
          ))}
        </div>
      </section>

      {/* AVAILABILITY */}

      {(listing.availableDate || listing.leaseEndDate) && (
        <section className="details-section">
          <h2>Availability & Lease Information</h2>

          <div className="availability-information">
            {listing.availableDate && (
              <p>
                <strong>Available Date:</strong> {listing.availableDate}
              </p>
            )}

            {listing.leaseEndDate && (
              <p>
                <strong>Lease End Date:</strong> {listing.leaseEndDate}
              </p>
            )}
          </div>
        </section>
      )}

      <div className="details-footer">
        <p>Interested in this property?</p>
        <span>
          Contact information will be available when listing inquiries are
          implemented.
        </span>
      </div>
    </div>
  );
}

export default PropertyDetails;
