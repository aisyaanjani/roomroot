
export type TransactionType = "rent" | "buy" | "sublease";

export type PropertyType =
  | "apartment"
  | "house"
  | "condo"
  | "private-room"
  | "shared-room";

// Accessibility scores are illustrative demo estimates,
// not verified measurements.
export interface AccessibilityScores {
  grocery: number;
  restaurants: number;
  parks: number;
  publicTransportation: number;
  schoolsAndHospitals: number;
  overall: number;
}

export interface HousingListing {
  id: string;
  title: string;
  transactionType: TransactionType;
  propertyType: PropertyType;
  price: number;
  location: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;

  // Existing property features
  furnished: boolean;
  petsAllowed: boolean;
  parking: boolean;

  // Additional property specifications
  hasKitchen: boolean;
  centralAir: boolean;
  heating: boolean;
  washerDryer: boolean;
  inUnitLaundry: boolean;

  // Illustrative accessibility scores
  accessibilityScores: AccessibilityScores;

  description: string;
  images: string[];
  availableDate?: string;
  leaseEndDate?: string;
}
