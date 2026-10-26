import React, { useEffect, useRef, useState } from 'react'
import { UserCircle } from '@phosphor-icons/react'
import {
  Button,
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
  // `Change`: the order goes back to a typed customer.
  onUnlink: () => void
}

/**
 * The "Saved customer" field at the top of the order form's Drop off card. Typing 2 characters or
 * more searches the restaurant's saved customers; picking one fills the drop off fields (the form
 * does that in onPick) and the field turns into "Saved customer: <name>" with a Change button.
 */
export function SavedCustomerPicker({ linked, onPick, onUnlink }: SavedCustomerPickerProps) {
  const [query, setQuery] = useState('')
  // Escape closes the list until the restaurant types again.
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
  const changeRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const wasLinked = useRef(linked !== null)
  const [announcement, setAnnouncement] = useState('')
  useEffect(() => {
    if (linked) {
      setAnnouncement(`Saved customer: ${linked.name}. The drop off fields are filled in.`)
      changeRef.current?.focus()
    } else if (wasLinked.current) {
      setAnnouncement('Saved customer cleared. The fields keep what they hold.')
      inputRef.current?.focus()
    }
    wasLinked.current = linked !== null
  }, [linked])

  const showList = !dismissed && search.status === 'ready' && search.items.length > 0
  // The search's own state, shown under the input and read out (it is never inside the listbox, whose
  // only children may be options).
  const searchMessage = dismissed
    ? ''
    : search.status === 'loading'
      ? 'Searching saved customers…'
      : search.status === 'error'
        ? 'Search is not available. Fill in the fields below.'
        : search.status === 'ready' && search.items.length === 0
          ? 'No saved customer matches. Fill in the fields below.'
          : ''

  return (
    <div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {linked ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <p className="flex min-w-0 items-center gap-2 text-sm">
            <UserCircle className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">
              Saved customer: <span className="font-medium">{linked.name}</span>
            </span>
          </p>
          <Button ref={changeRef} type="button" variant="outline" size="sm" onClick={onUnlink}>
            Change
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* The visible label. The input's accessible name comes from Command's `label` below: cmdk ties
              its input to a hidden label of its own and overrides any id or aria-labelledby we pass. */}
          <p aria-hidden="true" className="text-sm font-medium">
            Saved customer <span className="font-normal text-muted-foreground">(optional)</span>
          </p>
          {/* shouldFilter={false}: the backend already searched, so cmdk must not filter the rows again. */}
          <Command
            label="Saved customer"
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
              placeholder="Type a name or phone"
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
                      className="flex flex-wrap gap-x-1.5"
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
            {search.status === 'loading' && !dismissed ? <Spinner label="Searching saved customers" /> : null}
            {searchMessage}
          </p>
        </div>
      )}
    </div>
  )
}
