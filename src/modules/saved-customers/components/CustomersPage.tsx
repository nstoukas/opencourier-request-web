import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AddressBook, MagnifyingGlass, Plus, WarningCircle } from '@phosphor-icons/react'
import {
  Alert,
  AlertDescription,
  Button,
  Input,
  Skeleton,
  Spinner,
  useToast,
} from '../../../admin-web-components'
import { PageHeader } from '../../portal/components/PortalFrame'
import { listSavedCustomers } from '../../../api/savedCustomersApi'
import { MIN_SEARCH_LENGTH, SEARCH_PAUSE_MS } from '../hooks/useSavedCustomerSearch'
import type { SavedCustomer } from '../types'
import { CustomerCard } from './CustomerCard'
import { CustomerDialog } from './CustomerDialog'
import { DeleteCustomerDialog } from './DeleteCustomerDialog'

// Customers per page of the list (spec 0005, request-web design).
export const CUSTOMERS_PAGE_SIZE = 20

type ListState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: SavedCustomer[]; total: number; page: number }

/**
 * The restaurant's saved customers (spec 0005, AC-2): search, add, edit and delete, most recently
 * used first, 20 at a time. Only this restaurant's customers ever come back from the backend.
 */
export function CustomersPage() {
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  // The search actually sent: the typed text after a 300 ms pause, or '' under 2 characters.
  const [search, setSearch] = useState('')
  const [list, setList] = useState<ListState>({ status: 'loading' })
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  // Which dialog is open: 'add', a customer to edit, or none.
  const [editing, setEditing] = useState<SavedCustomer | 'add' | null>(null)
  const [deleting, setDeleting] = useState<SavedCustomer | null>(null)
  // Bumped to load the first page again (after an Add, or Try again).
  const [reloadCount, setReloadCount] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<HTMLParagraphElement>(null)
  // Bumped by every first page load. A Show more answer that arrives after a newer search (or a
  // reload) belongs to another list and is dropped.
  const listVersion = useRef(0)

  useEffect(() => {
    const trimmed = query.trim()
    const timer = setTimeout(() => setSearch(trimmed.length >= MIN_SEARCH_LENGTH ? trimmed : ''), SEARCH_PAUSE_MS)
    return () => clearTimeout(timer)
  }, [query])

  // The first page for the current search. Only the latest load counts: a change aborts the one before.
  useEffect(() => {
    const controller = new AbortController()
    listVersion.current += 1
    setList({ status: 'loading' })
    listSavedCustomers({ q: search || undefined, page: 1, perPage: CUSTOMERS_PAGE_SIZE }, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setList({ status: 'ready', items: result.items, total: result.total, page: 1 })
      })
      .catch(() => {
        if (!controller.signal.aborted) setList({ status: 'error' })
      })
    return () => controller.abort()
  }, [search, reloadCount])

  const showMore = useCallback(async () => {
    if (list.status !== 'ready') return
    const version = listVersion.current
    setIsLoadingMore(true)
    try {
      const next = await listSavedCustomers({ q: search || undefined, page: list.page + 1, perPage: CUSTOMERS_PAGE_SIZE })
      if (version !== listVersion.current) return
      setList((current) => {
        if (current.status !== 'ready') return current
        // A customer used between two pages moves up the list; never show it twice.
        const shown = new Set(current.items.map((item) => item.id))
        const added = next.items.filter((item) => !shown.has(item.id))
        const items = [...current.items, ...added]
        // The last page: the Show more button goes away while it has focus, so focus moves to the count.
        if (items.length >= next.total) setTimeout(() => countRef.current?.focus(), 0)
        return { status: 'ready', items, total: next.total, page: current.page + 1 }
      })
    } catch {
      toast({ title: 'Could not load more customers', description: 'Try again in a moment.', variant: 'destructive' })
    } finally {
      setIsLoadingMore(false)
    }
  }, [list, search, toast])

  const removeFromList = (id: string) => {
    setList((current) =>
      current.status === 'ready'
        ? { ...current, items: current.items.filter((item) => item.id !== id), total: Math.max(0, current.total - 1) }
        : current,
    )
    // The focused button went with the card: move focus to the list, never lose it.
    listRef.current?.focus()
  }

  const handleSaved = (saved: SavedCustomer) => {
    if (editing === 'add') {
      // The new customer is the most recently used: load the first page again, with the same search.
      setReloadCount((count) => count + 1)
      toast({ title: 'Customer saved', description: saved.name })
    } else {
      // An edit is not a use, so the order stays; replace the card where it is.
      setList((current) =>
        current.status === 'ready'
          ? { ...current, items: current.items.map((item) => (item.id === saved.id ? saved : item)) }
          : current,
      )
      toast({ title: 'Changes saved', description: saved.name })
    }
    setEditing(null)
  }

  const isSearching = search !== ''

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Your regular customers, ready to pick on a new order. Only your restaurant sees them."
        actions={
          <Button type="button" onClick={() => setEditing('add')}>
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            Add
          </Button>
        }
      />

      <div className="relative">
        <MagnifyingGlass
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or phone"
          aria-label="Search saved customers by name or phone"
          className="pl-9"
        />
      </div>

      {/* tabIndex -1: focus can be moved here after a delete, without adding a tab stop. */}
      <div ref={listRef} tabIndex={-1} className="space-y-3 outline-none" aria-busy={list.status === 'loading'}>
        {list.status === 'loading' ? (
          <div className="space-y-3" aria-label="Loading customers">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : list.status === 'error' ? (
          <Alert variant="destructive">
            <WarningCircle className="size-4" aria-hidden="true" />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>Your saved customers could not be loaded.</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setReloadCount((count) => count + 1)}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : list.items.length === 0 ? (
          isSearching ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No saved customer matches.
            </p>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
              <AddressBook className="size-10 text-muted-foreground" aria-hidden="true" />
              <p className="max-w-sm text-sm text-muted-foreground">
                Customers you save from an order appear here. Tick &ldquo;Save this customer for next time&rdquo; on
                a new delivery, or add one now.
              </p>
              <Button type="button" variant="outline" onClick={() => setEditing('add')}>
                <Plus className="mr-1.5 size-4" aria-hidden="true" />
                Add a customer
              </Button>
            </div>
          )
        ) : (
          <ul className="space-y-3">
            {list.items.map((customer) => (
              <li key={customer.id}>
                <CustomerCard customer={customer} onEdit={setEditing} onDelete={setDeleting} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {list.status === 'ready' && list.items.length > 0 ? (
        <div className="flex flex-col items-center gap-2">
          {list.items.length < list.total ? (
            <Button type="button" variant="outline" onClick={showMore} disabled={isLoadingMore}>
              {isLoadingMore ? <Spinner className="mr-2" label="Loading more customers" /> : null}
              Show more
            </Button>
          ) : null}
          {/* aria-live: a screen reader hears the new count after Show more, without moving focus. */}
          <p ref={countRef} tabIndex={-1} className="text-sm text-muted-foreground outline-none" aria-live="polite">
            {list.items.length} of {list.total}
          </p>
        </div>
      ) : null}

      {editing !== null ? (
        <CustomerDialog
          customer={editing === 'add' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onGone={(id) => {
            setEditing(null)
            removeFromList(id)
            toast({ title: 'This customer was already deleted.' })
          }}
        />
      ) : null}

      {deleting !== null ? (
        <DeleteCustomerDialog
          customer={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(id) => {
            setDeleting(null)
            removeFromList(id)
            toast({ title: 'Customer deleted' })
          }}
        />
      ) : null}
    </div>
  )
}
