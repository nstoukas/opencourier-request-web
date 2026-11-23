import { cn } from '../../../ui-shared-utils'
import Image from 'next/image'
import * as React from 'react'
import { Icons } from './Icons'

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
)
Table.displayName = 'Table'

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn('', className)} {...props} />
)
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  )
)
TableBody.displayName = 'TableBody'

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tfoot ref={ref} className={cn('font-medium', className)} {...props} />
)
TableFooter.displayName = 'TableFooter'

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, children, ...props }, ref) => (
    <tr ref={ref} className={cn(`transition-colors relative`, className)} {...props}>
      {children}
    </tr>
  )
)

//
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn('h-12 text-left align-middle font-bold text-gray-950 [&:has([role=checkbox])]:pr-0', className)}
      {...props}
    />
  )
)
TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn('py-4 align-middle [&:has([role=checkbox])]:pr-0', className)} {...props} />
  )
)
TableCell.displayName = 'TableCell'

type TableLabeledImageCellProps = React.TdHTMLAttributes<HTMLTableCellElement> & {
  src?: string | null
  label: string
}
const TableLabeledImageCell = React.forwardRef<HTMLTableCellElement, TableLabeledImageCellProps>(
  ({ className, src, label }, ref) => {
    const [displayFallback, setDisplayFallback] = React.useState(false)
    return (
      <div className={cn('flex items-center gap-1', className)} ref={ref}>
        <div className="h-10 w-10 relative flex items-center justify-center">
          {displayFallback || !src ? (
            <Icons.image />
          ) : (
            <Image
              src={src}
              fill
              sizes="100vw"
              alt={`${label}`}
              onError={() => setDisplayFallback(true)}
              className="object-cover"
            />
          )}
        </div>
        <span>{label}</span>
      </div>
    )
  }
)
TableLabeledImageCell.displayName = 'TableLabeledImageCell'

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
  )
)
TableCaption.displayName = 'TableCaption'

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableLabeledImageCell,
  TableRow,
}
