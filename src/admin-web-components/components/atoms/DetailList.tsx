import * as React from 'react'

import { cn } from '../../../ui-shared-utils'

// One fact to show: the label a person reads, its value, and whether the value is an ID or
// code that reads better in a fixed-width font.
export interface DetailListItem {
  label: string
  value: React.ReactNode
  /** Set on IDs, keys and coordinates. */
  mono?: boolean
}

export interface DetailListProps {
  items: DetailListItem[]
  className?: string
}

// null, undefined and '' all mean "nothing to show", which reads as an em dash.
function isEmpty(value: React.ReactNode) {
  return value == null || value === ''
}

/**
 * Label and value pairs for the facts of one delivery (opencourier-design-system,
 * components/DetailList). Labels muted, values in ink, two columns with 11rem labels from
 * 480px wide and stacked below that. An empty value shows an em dash, never "N/A".
 */
function DetailList({ items, className }: DetailListProps) {
  return (
    <dl
      className={cn(
        // `min-[480px]:` is Tailwind 3's arbitrary breakpoint: these classes apply from 480px up.
        'grid gap-y-2 text-sm min-[480px]:grid-cols-[11rem_minmax(0,1fr)] min-[480px]:gap-x-4',
        className
      )}
    >
      {items.map(({ label, value, mono }) => (
        // A Fragment groups the <dt> and <dd> without adding a wrapper element, which a
        // <dl> grid needs so each pair lands in its own two cells.
        <React.Fragment key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd
            className={cn(
              'min-w-0 break-words text-foreground',
              mono && 'font-mono',
              isEmpty(value) && 'text-muted-foreground'
            )}
          >
            {isEmpty(value) ? '—' : value}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

export { DetailList }
