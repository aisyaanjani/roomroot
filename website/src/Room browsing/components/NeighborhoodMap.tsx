
import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./NeighborhoodMap.css";

import { sampleListings } from "../data/sampleListings";
import type { HousingListing } from "../types/listingTypes";

const CITY_COORDINATES: Record<string, [number, number]> = {
  Blacksburg: [37.2296, -80.4139],
  Christiansburg: [37.1299, -80.4089],
  Roanoke: [37.2709, -79.9414],
};

const LOCATION_OFFSETS: [number, number][] = [
  [0, 0],
  [0.004, 0.003],
  [-0.004, 0.003],
  [0.003, -0.004],
  [-0.003, -0.004],
  [0.006, 0],
];

const PROPERTY_COLORS: Record<string, string> = {
  rent: "#2e8b57",
  buy: "#2980b9",
  sublease: "#e67e22",
};

const PROPERTY_LABELS: Record<string, string> = {
  rent: "For Rent",
  buy: "For Sale",
  sublease: "Sublease",
};

const AMENITY_COLORS: Record<string, string> = {
  grocery: "#8e44ad",
  restaurant: "#d35400",
  park: "#27ae60",
  transit: "#16a085",
  school: "#c0392b",
  hospital: "#34495e",
};

const AMENITY_LABELS: Record<string, string> = {
  grocery: "Grocery Store",
  restaurant: "Restaurant",
  park: "Park",
  transit: "Public Transportation",
  school: "School",
  hospital: "Hospital",
};

type AmenityCategory =
  | "grocery"
  | "restaurant"
  | "park"
  | "transit"
  | "school"
  | "hospital";

interface NearbyPlace {
  id: string;
  name: string;
  category: AmenityCategory;
  latitude: number;
  longitude: number;
}

interface OverpassElement {
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: {
    name?: string;
    shop?: string;
    amenity?: string;
    leisure?: string;
    highway?: string;
    public_transport?: string;
    railway?: string;
  };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

const MAP_BOUNDS = "37.10,-80.46,37.31,-79.92";

function createMarkerIcon(color: string) {
  return L.divIcon({
    className: "roomroot-map-marker",
    html: `
      <div style="
        background-color: ${color};
        width: 20px;
        height: 20px;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      "></div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -12],
  });
}

function getPropertyCoordinates(
  listing: HousingListing,
  indexWithinCity: number
): [number, number] {
  const center =
    CITY_COORDINATES[listing.city] ||
    CITY_COORDINATES.Blacksburg;

  const offset =
    LOCATION_OFFSETS[
      indexWithinCity % LOCATION_OFFSETS.length
    ];

  return [
    center[0] + offset[0],
    center[1] + offset[1],
  ];
}

function getAmenityCategory(
  tags: OverpassElement["tags"]
): AmenityCategory | null {
  if (!tags) return null;

  if (
    tags.shop === "supermarket" ||
    tags.shop === "convenience" ||
    tags.shop === "greengrocer"
  ) {
    return "grocery";
  }

  if (
    tags.amenity === "restaurant" ||
    tags.amenity === "cafe" ||
    tags.amenity === "fast_food"
  ) {
    return "restaurant";
  }

  if (tags.leisure === "park") {
    return "park";
  }

  if (
    tags.highway === "bus_stop" ||
    tags.public_transport === "platform" ||
    tags.railway === "station"
  ) {
    return "transit";
  }

  if (
    tags.amenity === "school" ||
    tags.amenity === "college" ||
    tags.amenity === "university"
  ) {
    return "school";
  }

  if (
    tags.amenity === "hospital" ||
    tags.amenity === "clinic"
  ) {
    return "hospital";
  }

  return null;
}

async function fetchNearbyPlaces(): Promise<NearbyPlace[]> {
  const query = `
    [out:json][timeout:60];
    (
      node["shop"~"supermarket|convenience|greengrocer"](${MAP_BOUNDS});
      way["shop"~"supermarket|convenience|greengrocer"](${MAP_BOUNDS});

      node["amenity"~"restaurant|cafe|fast_food"](${MAP_BOUNDS});
      way["amenity"~"restaurant|cafe|fast_food"](${MAP_BOUNDS});

      node["leisure"="park"](${MAP_BOUNDS});
      way["leisure"="park"](${MAP_BOUNDS});

      node["highway"="bus_stop"](${MAP_BOUNDS});
      node["public_transport"="platform"](${MAP_BOUNDS});
      node["railway"="station"](${MAP_BOUNDS});

      node["amenity"~"school|college|university|hospital|clinic"](${MAP_BOUNDS});
      way["amenity"~"school|college|university|hospital|clinic"](${MAP_BOUNDS});
    );
    out center;
  `;

  const response = await fetch(
    "https://overpass-api.de/api/interpreter",
    {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: query,
    }
  );

  if (!response.ok) {
    throw new Error("Nearby places could not be loaded.");
  }

  const data: OverpassResponse = await response.json();

  return data.elements
    .map((element) => {
      const category = getAmenityCategory(element.tags);

      const latitude = element.lat ?? element.center?.lat;
      const longitude = element.lon ?? element.center?.lon;

      if (
        !category ||
        latitude === undefined ||
        longitude === undefined
      ) {
        return null;
      }

      return {
        id: String(element.id),
        name:
          element.tags?.name ||
          AMENITY_LABELS[category],
        category,
        latitude,
        longitude,
      };
    })
    .filter(
      (place): place is NearbyPlace =>
        place !== null
    );
}

function MapResizeHandler() {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [map]);

  return null;
}

function MapBounds() {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds([
      [37.10, -80.46],
      [37.31, -79.92],
    ]);

    const timer = window.setTimeout(() => {
      map.fitBounds(bounds, {
        padding: [25, 25],
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [map]);

  return null;
}

function formatPrice(listing: HousingListing): string {
  const price = listing.price.toLocaleString("en-US");

  if (listing.transactionType === "buy") {
    return `$${price}`;
  }

  return `$${price}/month`;
}

export default function NeighborhoodMap() {
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [amenityError, setAmenityError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadNearbyPlaces() {
      try {
        setLoading(true);
        setAmenityError("");

        const results = await fetchNearbyPlaces();

        if (!cancelled) {
          setNearbyPlaces(results);
        }
      } catch (error) {
        console.error("Nearby amenity loading error:", error);

        if (!cancelled) {
          setAmenityError(
            "Nearby amenities are temporarily unavailable."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadNearbyPlaces();

    return () => {
      cancelled = true;
    };
  }, []);

  const cityCounts: Record<string, number> = {};

  const propertiesWithCoordinates = sampleListings.map(
    (listing) => {
      const city = listing.city;
      const indexWithinCity = cityCounts[city] || 0;

      cityCounts[city] = indexWithinCity + 1;

      return {
        listing,
        coordinates: getPropertyCoordinates(
          listing,
          indexWithinCity
        ),
      };
    }
  );

  return (
    <section className="neighborhood-map-section">
      <div className="neighborhood-map-heading">
        <div>
          <h2>Explore the Neighborhood</h2>
          <p>
            Explore ROOMROOT properties and nearby places
            across Blacksburg, Christiansburg, and Roanoke.
          </p>
        </div>
      </div>

      <div className="neighborhood-map-legend">
        <strong className="map-legend-heading">
          ROOMROOT Properties
        </strong>

        {Object.entries(PROPERTY_COLORS).map(
          ([type, color]) => (
            <div className="map-legend-item" key={type}>
              <span
                className="map-legend-dot"
                style={{ backgroundColor: color }}
              />
              {PROPERTY_LABELS[type]}
            </div>
          )
        )}

        <strong className="map-legend-heading">
          Nearby Amenities
        </strong>

        {Object.entries(AMENITY_COLORS).map(
          ([category, color]) => (
            <div className="map-legend-item" key={category}>
              <span
                className="map-legend-dot"
                style={{ backgroundColor: color }}
              />
              {AMENITY_LABELS[category]}
            </div>
          )
        )}
      </div>

      {loading && (
        <p className="map-status">
          Loading nearby amenities...
        </p>
      )}

      {amenityError && (
        <p className="map-status map-error">
          {amenityError}
        </p>
      )}

      {!loading && !amenityError && (
        <p className="map-status">
          Showing {propertiesWithCoordinates.length} properties and{" "}
          {nearbyPlaces.length} nearby amenities.
        </p>
      )}

      <div className="neighborhood-map-container">
        <MapContainer
          center={[37.20, -80.20]}
          zoom={9}
          scrollWheelZoom={true}
          className="neighborhood-leaflet-map"
        >
          <MapBounds />
          <MapResizeHandler />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* ROOMROOT Property Markers */}
          {propertiesWithCoordinates.map(
            ({ listing, coordinates }) => (
              <Marker
                key={`property-${listing.id}`}
                position={coordinates}
                icon={createMarkerIcon(
                  PROPERTY_COLORS[listing.transactionType] ||
                    "#555555"
                )}
              >
                <Popup>
                  <div className="property-map-popup">
                    <strong>{listing.title}</strong>

                    <p>
                      <strong>
                        {PROPERTY_LABELS[listing.transactionType]}
                      </strong>
                    </p>

                    <p>
                      <strong>{formatPrice(listing)}</strong>
                    </p>

                    <p>
                      {listing.bedrooms} bedrooms ·{" "}
                      {listing.bathrooms} bathrooms
                    </p>

                    <p>
                      {listing.city}, {listing.state}
                    </p>
                  </div>
                </Popup>
              </Marker>
            )
          )}

          {/* Nearby Amenity Markers */}
          {nearbyPlaces.map((place) => (
            <Marker
              key={`amenity-${place.category}-${place.id}`}
              position={[place.latitude, place.longitude]}
              icon={createMarkerIcon(
                AMENITY_COLORS[place.category]
              )}
            >
              <Popup>
                <div className="property-map-popup">
                  <strong>{place.name}</strong>

                  <p>
                    {AMENITY_LABELS[place.category]}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </section>
  );
}
