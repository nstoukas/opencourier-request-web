/**
 * Address section used in both pickup and dropoff parts of the form.
 * Includes geocoding search that auto-fills address fields and coordinates
 * when a result is selected.
 */
import React, { useRef, useState } from 'react'
import { Control, FieldValues, Path, useFormContext } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '../../../admin-web-components'
import { Loader2Icon, MapPinIcon, SearchIcon, XIcon } from 'lucide-react'

// ── Nominatim types ───────────────────────────────────────────────────────────

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address: {
    house_number?: string
    road?: string
    city?: string
    town?: string
    village?: string
    suburb?: string
    neighbourhood?: string
    city_district?: string
    state?: string
    postcode?: string
    country_code?: string
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

type AddressFieldPrefix = 'pickup' | 'dropoff'

interface AddressSectionProps<T extends FieldValues> {
  control: Control<T>
  prefix: AddressFieldPrefix
  label: string
}

export function AddressSection<T extends FieldValues>({
  control,
  prefix,
  label,
}: AddressSectionProps<T>) {
  const { setValue } = useFormContext<T>()
  const field = (name: string) => `${prefix}Address.${name}` as Path<T>
  const coord = (name: string) => `${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}` as Path<T>

  // ── Geocoding search state ──────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleSearch = async () => {
    const q = query.trim()
    if (!q) return
    setIsSearching(true)
    setSearchError(null)
    setResults([])
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6`
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'opencourier-request-web/1.0 (manual delivery form)',
        },
      })
      const data: NominatimResult[] = await res.json()
      if (data.length === 0) setSearchError('No results found. Try a more specific address.')
      setResults(data)
      setShowResults(true)
    } catch {
      setSearchError('Search failed. Check your connection and try again.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelect = (r: NominatimResult) => {
    const a = r.address
    const road = (a.road ?? '').trim()
    const hn = (a.house_number ?? '').trim()
    const city =
      a.city?.trim() ||
      a.town?.trim() ||
      a.village?.trim() ||
      a.suburb?.trim() ||
      a.neighbourhood?.trim() ||
      a.city_district?.trim() ||
      ''
    const region = a.state ?? ''
    const postalCode = a.postcode ?? ''
    const countryCode = (a.country_code ?? '').toUpperCase()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const set = (path: Path<T>, value: any) => setValue(path, value, { shouldValidate: true, shouldDirty: true })

    set(field('streetAddress.0'), road || hn)
    set(field('houseNumber'), road ? hn : '')
    set(field('city'), city)
    set(field('state'), region)
    set(field('zipCode'), postalCode)
    if (countryCode) set(field('countryCode'), countryCode)
    set(field('formattedAddress'), r.display_name.trim())
    set(coord('Latitude'), parseFloat(r.lat))
    set(coord('Longitude'), parseFloat(r.lon))

    setQuery(r.display_name)
    setShowResults(false)
    setResults([])
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{label}</h3>

      {/* ── Geocoding search ─────────────────────────────────────────────── */}
      <div ref={containerRef} className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPinIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search address to auto-fill"
              value={query}
              className="pl-8 pr-8"
              onChange={(e) => {
                setQuery(e.target.value)
                if (results.length > 0) setShowResults(true)
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setResults([]); setShowResults(false) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium bg-background hover:bg-accent disabled:opacity-50 transition-colors"
          >
            {isSearching
              ? <Loader2Icon className="h-4 w-4 animate-spin" />
              : <SearchIcon className="h-4 w-4" />}
            Search
          </button>
        </div>

        {/* Results dropdown */}
        {showResults && results.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-auto text-sm">
            {results.map((r) => (
              <li key={r.place_id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                  onClick={() => handleSelect(r)}
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {searchError && (
          <p className="text-xs text-destructive mt-1">{searchError}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Autofill uses OpenStreetMap geocoding. Google Maps autocomplete can be plugged in with a Places API key.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          control={control}
          name={field('streetAddress.0')}
          render={({ field: f }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Street Address</FormLabel>
              <FormControl>
                <Input placeholder="123 Main St" {...f} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={field('countryCode')}
          render={({ field: f }) => (
            <FormItem>
              <FormLabel>Country Code</FormLabel>
              <FormControl>
                <Input
                  placeholder="US"
                  maxLength={2}
                  value={(f.value ?? '').toUpperCase()}
                  onChange={(event) => f.onChange(event.target.value.toUpperCase())}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={field('city')}
          render={({ field: f }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl>
                <Input placeholder="San Francisco" {...f} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={field('state')}
          render={({ field: f }) => (
            <FormItem>
              <FormLabel>State / Province / Region</FormLabel>
              <FormControl>
                <Input placeholder="CA / ON / Bavaria" {...f} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={field('zipCode')}
          render={({ field: f }) => (
            <FormItem>
              <FormLabel>Postal Code</FormLabel>
              <FormControl>
                <Input placeholder="94102 / SW1A 1AA" {...f} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={field('houseNumber')}
          render={({ field: f }) => (
            <FormItem>
              <FormLabel>Street number</FormLabel>
              <FormControl>
                <Input placeholder="11 (from map search)" {...f} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Coordinates are captured automatically from the selected address and saved with the request.
      </p>
    </div>
  )
}
