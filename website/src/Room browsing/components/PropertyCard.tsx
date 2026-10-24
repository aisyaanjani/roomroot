
import { useState } from "react";
import type { HousingListing } from "../types/listingTypes";

interface PropertyCardProps {
  listing: HousingListing;
  onViewDetails: (listing: HousingListing) => void;
  isFavorite: boolean;
  onToggleFavorite: (listingId: string) => void;
}

function PropertyCard({
  listing,
  onViewDetails,
  isFavorite,
  onToggleFavorite,
}: PropertyCardProps) {
  const [currentImage, setCurrentImage] = useState(0);

  const images = listing.images ?? [];
  const hasImages = images.length > 0;

  const showPreviousImage = () => {
    setCurrentImage((previous) =>
      previous === 0 ? images.length - 1 : previous - 1
    );
  };

  const showNextImage = () => {
    setCurrentImage((previous) =>
      previous === images.length - 1 ? 0 : previous + 1
    );
  };

  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(listing.price);

  const priceLabel =
    listing.transactionType === "buy"
      ? formattedPrice
      : `${formattedPrice}/month`;

  const transactionLabel =
    listing.transactionType.charAt(0).toUpperCase() +
    listing.transactionType.slice(1);

  return (
    <article className="property-card">
      <div className="property-card-image">
        {hasImages ? (
          <>
            <img
              key={images[currentImage]}
              src={images[currentImage]}
              alt={`${listing.title} - Photo ${currentImage + 1}`}
            />

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="image-navigation image-previous"
                  onClick={showPreviousImage}
                  aria-label="Previous photo"
                >
                  &#8249;
                </button>

                <button
                  type="button"
                  className="image-navigation image-next"
                  onClick={showNextImage}
                  aria-label="Next photo"
                >
                  &#8250;
                </button>

                <span className="image-counter">
                  {currentImage + 1} / {images.length}
                </span>
              </>
            )}
          </>
        ) : (
          <div className="property-image-placeholder">
            <p>Property photos coming soon</p>
          </div>
        )}

        <span className="property-transaction">
          {transactionLabel}
        </span>

        <button
          type="button"
          className={`favorite-button ${isFavorite ? "is-favorite" : ""}`}
          onClick={() => onToggleFavorite(listing.id)}
          aria-label={
            isFavorite ? "Remove from favorites" : "Add to favorites"
          }
          aria-pressed={isFavorite}
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          {isFavorite ? "♥" : "♡"}
        </button>
      </div>

      <div className="property-card-content">
        <div className="property-card-heading">
          <h3>{listing.title}</h3>
          <p className="property-price">{priceLabel}</p>
        </div>

        <p className="property-location">
          {listing.city}, {listing.state} {listing.zipCode}
        </p>

        <div className="property-details">
          <span>{listing.bedrooms} Beds</span>
          <span>{listing.bathrooms} Baths</span>
          {listing.squareFeet && (
            <span>{listing.squareFeet.toLocaleString()} sq ft</span>
          )}
        </div>

        <div className="property-amenities">
          {listing.furnished && <span>Furnished</span>}
          {listing.petsAllowed && <span>Pets Allowed</span>}
          {listing.parking && <span>Parking</span>}
        </div>

        <button
          type="button"
          className="view-property-button"
          onClick={() => onViewDetails(listing)}
        >
          View Property
        </button>
      </div>
    </article>
  );
}

export default PropertyCard;
