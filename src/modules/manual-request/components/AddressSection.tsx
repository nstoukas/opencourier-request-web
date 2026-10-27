/**
 * The drop off address, in two places: the order form (spec 0006: one search box, with a typed fallback
 * behind "Can't find it? Type it") and, `compact`, the saved customer dialog (spec 0005: search plus
 * the street, floor and doorbell, city and ZIP fields). Picking a search result fills the address
 * fields and the map point.
 */
import React, { useEffect, useId, useState } from 'react'
import { Control, FieldValues, Path, useController, useFormContext, useFormState } from 'react-hook-form'
import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  Spinner,
} from '../../../admin-web-components'
import { MagnifyingGlass, MapPin, X } from '@phosphor-icons/react'
import { cn } from '../../../ui-shared-utils'
import { GEOCODE_TIMEOUT_MS, hasValidCoordinates } from '../utils/geocode'
import { GeoPoint, nearbyViewbox } from '../utils/orderForm'

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
  // `?` = optional. Compact (the saved customer dialog, spec 0005): the typed fields always show, with
  // floor and doorbell, city and ZIP. Without it, the order form's search box and typed fallback.
  compact?: boolean
  // What the search box starts with, e.g. a saved customer's address when editing it.
  initialQuery?: string
  // The restaurant's pickup point: search results near it come first (spec 0006, AC-10).
  near?: GeoPoint
  // The Town the typed fallback starts with when the form has none yet: the restaurant's own town.
  defaultTown?: string
}

export function AddressSection<T extends FieldValues>({
  control,
  prefix,
  label,
  compact = false,
  initialQuery = '',
  near,
  defaultTown = '',
}: AddressSectionProps<T>) {
  const { setValue, getValues, getFieldState } = useFormContext<T>()
  const field = (name: string) => `${prefix}Address.${name}` as Path<T>
  const coord = (name: string) => `${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}` as Path<T>
  const searchId = useId()
  const streetErrorId = `${searchId}-street-error`

  // ── Geocoding search state ──────────────────────────────────────────────
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<NominatimResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)

  // ── The order form's typed fallback ─────────────────────────────────────
  const [typing, setTyping] = useState(false)
  // The street, controlled here rather than by a FormField, so its ref (what an error focuses) can sit
  // on the search box while the typed fields are closed, and on the typed Street field once open.
  const street = useController({ control, name: field('streetAddress.0') })
  const streetState = useFormState({ control, name: field('streetAddress.0') })
  const streetError = getFieldState(field('streetAddress.0'), streetState).error
  const cityState = useFormState({ control, name: field('city') })
  const cityError = getFieldState(field('city'), cityState).error

  const openTyping = () => {
    setTyping(true)
    const town = getValues(field('city'))
    if (!String(town ?? '').trim() && defaultTown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setValue(field('city'), defaultTown as any, { shouldDirty: true, shouldValidate: true })
    }
  }

  // Get price with no street: the sentence shows under the search box and the typed fields open (AC-10).
  // A missing town opens them too, since Town is only shown there.
  useEffect(() => {
    if (!compact && (streetError || cityError)) openTyping()
    // openTyping only reads the form, so it does not need to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, streetError, cityError])

  const handleSearch = async () => {
    const q = query.trim()
    if (!q) return
    setIsSearching(true)
    setSearchError(null)
    setResults([])
    try {
      const viewbox = near && hasValidCoordinates(near.latitude, near.longitude) ? `&viewbox=${nearbyViewbox(near)}` : ''
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6${viewbox}`
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'opencourier-request-web/1.0 (manual delivery form)',
        },
        // A public service that may stall: give up after 8 s, like the lookup at Get price.
        signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
      })
      // A refusal (Nominatim answers 429 or 5xx with a JSON object, not a list) goes to the catch below,
      // so the restaurant sees "Search failed" instead of nothing at all.
      if (!res.ok) throw new Error(`Search failed (HTTP ${res.status})`)
      const data: NominatimResult[] = await res.json()
      if (data.length === 0) setSearchError('No results found. Try a more specific address.')
      setResults(data)
      setShowResults(true)
    } catch (error) {
      setSearchError(
        (error as Error | undefined)?.name === 'TimeoutError'
          ? 'Search did not answer. Try again, or type the address.'
          : 'Search failed. Check your connection and try again.',
      )
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelect = (r: NominatimResult) => {
    const a = r.address
    const road = (a.road ?? '').trim()
    const hn = (a.house_number ?? '').trim()
    // Greek order: the street name, then the number ("Iasonos 12").
    const streetLine = [road, hn].filter(Boolean).join(' ').trim()
    const city =
      a.city?.trim() ||
      a.town?.trim() ||
      a.village?.trim() ||
      a.suburb?.trim() ||
      a.neighbourhood?.trim() ||
      a.city_district?.trim() ||
      ''
    const postalCode = a.postcode ?? ''
    const countryCode = (a.country_code ?? '').toUpperCase()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const set = (path: Path<T>, value: any) => setValue(path, value, { shouldValidate: true, shouldDirty: true })

    set(field('streetAddress.0'), streetLine)
    set(field('houseNumber'), '')
    set(field('city'), city)
    // The order form keeps no state (spec 0006); the dialog keeps what it kept before.
    set(field('state'), compact ? a.state ?? '' : '')
    set(field('zipCode'), postalCode)
    if (countryCode) set(field('countryCode'), countryCode)
    set(field('formattedAddress'), r.display_name.trim())
    set(coord('Latitude'), parseFloat(r.lat))
    set(coord('Longitude'), parseFloat(r.lon))

    setQuery(r.display_name)
    setShowResults(false)
    setResults([])
  }

  // In the order form the search box is the address, so Clear empties what the order would be sent to
  // (street, full text, postcode and map point; Town stays) and Get price then asks for one. Clearing only
  // the box would hide a kept address, after Change say, that Get price still prices. The dialog shows
  // its typed fields all the time, so there Clear only empties the box, as before.
  const handleClear = () => {
    setQuery('')
    setResults([])
    setShowResults(false)
    if (compact) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const set = (path: Path<T>, value: any) => setValue(path, value, { shouldDirty: true })
    set(field('streetAddress.0'), '')
    set(field('formattedAddress'), '')
    set(field('zipCode'), '')
    set(coord('Latitude'), 0)
    set(coord('Longitude'), 0)
  }

  // 48 px and 16 px text in the order form (spec 0006, AC-3); the dialog keeps its own sizes.
  const control48 = compact ? '' : 'h-12 text-base'
  const searchShowsStreetError = !compact && streetError

  return (
    <div className="space-y-3">
      {compact ? (
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{label}</h3>
      ) : (
        <label htmlFor={searchId} className="block text-sm font-medium leading-none">
          {label}
        </label>
      )}

      {/* ── Geocoding search ─────────────────────────────────────────────── */}
      <div>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id={searchId}
              // While the typed fields are closed, an error on the street focuses this box.
              ref={compact || typing ? undefined : street.field.ref}
              type="text"
              placeholder={compact ? 'Search address to auto-fill' : 'e.g. Iasonos 12'}
              value={query}
              className={cn('pl-8', compact ? 'pr-8' : 'pr-12', control48)}
              aria-invalid={searchShowsStreetError ? true : undefined}
              aria-describedby={searchShowsStreetError ? streetErrorId : undefined}
              onChange={(e) => {
                setQuery(e.target.value)
                if (results.length > 0) setShowResults(true)
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                // The button shows only an icon, so this is the name a screen reader says.
                aria-label="Clear search"
                className={cn(
                  'absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center text-muted-foreground hover:text-foreground',
                  compact ? 'right-2' : 'size-12',
                )}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium bg-background hover:bg-accent disabled:opacity-50 transition-colors',
              compact ? '' : 'h-12 px-4 text-base',
            )}
          >
            {isSearching
              ? <Spinner label="Searching" />
              : <MagnifyingGlass className="h-4 w-4" />}
            Search
          </button>
        </div>

        {/* Results, in the page flow (they push content down rather than float, so nothing is clipped
            on a phone or in a scrolling dialog). */}
        {showResults && results.length > 0 && (
          <ul className="relative mt-1 w-full rounded-md border bg-popover max-h-72 overflow-auto text-sm">
            {results.map((r) => (
              <li key={r.place_id}>
                <button
                  type="button"
                  className={cn(
                    'w-full text-left px-3 py-2 hover:bg-accent transition-colors break-words',
                    compact ? '' : 'min-h-12 text-base',
                  )}
                  onClick={() => handleSelect(r)}
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {searchError && (
          <p className="text-sm text-destructive mt-1">{searchError}</p>
        )}
        {searchShowsStreetError && (
          <p id={streetErrorId} className="mt-1 text-sm font-medium text-destructive">
            {String(streetError.message)}
          </p>
        )}
      </div>

      {compact ? (
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
          <FormField
            control={control}
            name={field('streetAddress.0')}
            render={({ field: f }) => (
              <FormItem className="sm:col-span-6">
                <FormLabel>Street address or PO Box</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Iasonos 12" {...f} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={field('houseNumber')}
            render={({ field: f }) => (
              <FormItem className="sm:col-span-6">
                <FormLabel>
                  Floor and doorbell <span className="text-muted-foreground font-normal">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="3rd floor, Papadopoulou" {...f} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={field('city')}
            render={({ field: f }) => (
              <FormItem className="sm:col-span-4">
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Volos" {...f} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={field('zipCode')}
            render={({ field: f }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>ZIP / Postal code</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 38221" {...f} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      ) : typing ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={`${searchId}-street`}>Street and number</Label>
            <Input
              id={`${searchId}-street`}
              ref={street.field.ref}
              name={street.field.name}
              value={street.field.value ?? ''}
              onChange={street.field.onChange}
              onBlur={street.field.onBlur}
              placeholder="e.g. Iasonos 12"
              autoComplete="off"
              aria-invalid={streetError ? true : undefined}
              aria-describedby={streetError ? streetErrorId : undefined}
              className={control48}
            />
          </div>
          <FormField
            control={control}
            name={field('city')}
            render={({ field: f }) => (
              <FormItem>
                <FormLabel>Town</FormLabel>
                <FormControl>
                  <Input autoComplete="off" className={control48} {...f} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      ) : (
        <Button type="button" variant="link" className="h-12 px-0 text-base underline" onClick={openTyping}>
          Can&apos;t find it? Type it
        </Button>
      )}
    </div>
  )
}
