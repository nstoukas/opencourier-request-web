// A restaurant's saved customer as the backend sends it (spec 0005). Dates arrive as ISO text.
export interface SavedCustomer {
  id: string
  name: string
  // E.164, e.g. "+306912345678"
  phone: string
  notes: string | null
  addressLine1: string
  addressLine2: string | null
  city: string
  zipCode: string | null
  latitude: number
  longitude: number
  formattedAddress: string | null
  lastUsedAt: string
  createdAt: string
  updatedAt: string
}

export interface SavedCustomerList {
  items: SavedCustomer[]
  // How many match the search (all of them without one)
  total: number
}

// What the restaurant can set. Empty optional texts are sent as null.
export interface SavedCustomerFields {
  name: string
  phone: string
  notes: string | null
  addressLine1: string
  addressLine2: string | null
  city: string
  zipCode: string | null
  latitude: number
  longitude: number
  formattedAddress: string | null
}

// The error a saved customer call throws: the backend's plain message, its status, and on a phone
// clash (409) the other customer's id.
export type SavedCustomerError = Error & {
  statusCode?: number
  conflictingCustomerId?: string
}
