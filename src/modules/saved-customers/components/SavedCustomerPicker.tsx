import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Spinner,
} from '../../../admin-web-components'
import { useSavedCustomerSearch } from '../hooks/useSavedCustomerSearch'
import type { SavedCustomer } from '../types'
import { customerStreet } from '../utils/fields'

// The picker shows at most this many matches (spec 0005, AC-3).
export const PICKER_PAGE_SIZE = 8

export interface LinkedCustomer {
  id: string
  name: string
}

interface SavedCustomerPickerProps {
  // The saved customer this order is linked to, or null for a typed customer.
  linked: LinkedCustomer | null
  onPick: (customer: SavedCustomer) => void
  // The Change button that replaces the picker while a customer is linked (the order form's picked
  // customer card, spec 0006). Focus moves there after a pick.
  changeRef: React.RefObject<HTMLButtonElement>
}

/**
 * The "Saved customer" field at the top of the order form. Typing 2 characters or more searches the
 * restaurant's saved customers; picking one fills the drop off fields (the form does that in onPick).
 * While a customer is linked the picker draws nothing but its status line: the form's picked customer
 * card shows the customer and owns Change (spec 0006, AC-11).
 */
export function SavedCustomerPicker({ linked, onPick, changeRef }: SavedCustomerPickerProps) {
  const [query, setQuery] = useState('')
  // Escape closes the list until the restaurant types again.
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)
  const search = useSavedCustomerSearch(linked ? '' : query, PICKER_PAGE_SIZE)
  // The highlighted row (cmdk's value). cmdk highlights a first row by itself only when it filters the
  // rows; ours arrive from the backend later, so the first result is highlighted here, and Enter picks it.
  const [highlighted, setHighlighted] = useState('')
  const firstId = search.status === 'ready' ? search.items[0]?.id ?? '' : ''
  useEffect(() => {
    setHighlighted(firstId)
  }, [firstId])

  // Picking unmounts the search input, and Change unmounts the Change button, both holding focus. So
  // focus moves to what replaced them, and a status line that is always on the page tells a screen
  // reader what happened (a live region is only read when its text changes, not when it appears).
  const inputRef = useRef<HTMLInputElement>(null)
  const wasLinked = useRef(linked !== null)
  const [announcement, setAnnouncement] = useState('')
  useEffect(() => {
    if (linked) {
      setAnnouncement(t('picker.picked', { name: linked.name }))
      changeRef.current?.focus()
    } else if (wasLinked.current) {
      setAnnouncement(t('picker.cleared'))
      inputRef.current?.focus()
    }
    wasLinked.current = linked !== null
    // `t` changes only with the language; the announcement is about a pick, not a language switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked])

  const showList = !dismissed && search.status === 'ready' && search.items.length > 0
  // The search's own state, shown under the input and read out (it is never inside the listbox, whose
  // only children may be options).
  const searchMessage = dismissed
    ? ''
    : search.status === 'loading'
      ? t('picker.searching')
      : search.status === 'error'
        ? t('picker.unavailable')
        : search.status === 'ready' && search.items.length === 0
          ? t('picker.noMatch')
          : ''

  return (
    <div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {linked ? null : (
        <div className="space-y-1.5">
          {/* The visible label. The input's accessible name comes from Command's `label` below: cmdk ties
              its input to a hidden label of its own and overrides any id or aria-labelledby we pass. */}
          <p aria-hidden="true" className="text-sm font-medium">
            {t('picker.label')} <span className="font-normal text-muted-foreground">{t('common.optional')}</span>
          </p>
          {/* shouldFilter={false}: the backend already searched, so cmdk must not filter the rows again. */}
          <Command
            // Focus leaving the picker (a click or Tab elsewhere in the form) closes the list. Clicking a
            // row keeps focus inside (cmdk's root takes it), so a pick still goes through.
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDismissed(true)
            }}
            label={t('picker.label')}
            shouldFilter={false}
            value={highlighted}
            onValueChange={setHighlighted}
            className="rounded-md border"
            // cmdk handles the arrow keys and Enter itself (and prevents Enter, so the order form around it
            // is never submitted); calling preventDefault here would switch its handling off. Escape closes.
            onKeyDown={(event) => {
              if (event.key === 'Escape') setDismissed(true)
            }}
          >
            <CommandInput
              ref={inputRef}
              value={query}
              onValueChange={(value) => {
                setQuery(value)
                setDismissed(false)
              }}
              placeholder={t('picker.placeholder')}
              // 48 px and 16 px text, so a phone neither misses the tap nor zooms in (spec 0006, AC-3).
              className="h-12 text-base"
            />
            {showList && search.status === 'ready' ? (
              <CommandList>
                <CommandGroup>
                  {search.items.map((customer) => (
                    <CommandItem
                      key={customer.id}
                      value={customer.id}
                      onSelect={() => {
                        setQuery('')
                        onPick(customer)
                      }}
                      className="flex min-h-12 flex-wrap gap-x-1.5 py-2 text-base"
                    >
                      <span className="font-medium">{customer.name}</span>
                      <span className="text-muted-foreground">· {customer.phone}</span>
                      <span className="min-w-0 truncate text-muted-foreground">· {customerStreet(customer)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            ) : null}
          </Command>
          <p role="status" className="flex min-h-5 items-center gap-2 text-sm text-muted-foreground">
            {search.status === 'loading' && !dismissed ? <Spinner label={t('picker.searchingLabel')} /> : null}
            {searchMessage}
          </p>
        </div>
      )}
    </div>
  )
}
