import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../../ui-shared-utils'
import { Label } from './Label'

/**
 * shadcn's Field (new-york-v4), trimmed to the parts request-web uses so far: a labelled
 * control with an optional muted hint under it. The design system's structure is
 * FieldGroup > Field > FieldLabel + control + FieldDescription. FieldSet, FieldLegend and
 * FieldError come with the order form rebuild (row 27), when something first needs them.
 */

// A vertical stack of Fields, 24px apart.
function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="field-group" className={cn('flex w-full flex-col gap-6', className)} {...props} />
}

// `group/field` names this element as a Tailwind group, so a child can style itself from the
// Field's state (for example `group-data-[disabled=true]/field:opacity-50` on the label).
const fieldVariants = cva('group/field flex w-full gap-2', {
  variants: {
    orientation: {
      vertical: 'flex-col',
      horizontal: 'flex-row items-center',
    },
  },
  defaultVariants: {
    orientation: 'vertical',
  },
})

// `React.ComponentProps<'div'>` means "every prop a plain <div> accepts", so a Field takes
// className, id, data attributes and so on without listing them.
function Field({
  className,
  orientation,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation ?? 'vertical'}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn('leading-snug group-data-[disabled=true]/field:opacity-50', className)}
      {...props}
    />
  )
}

// A hint under the control. Point the control's aria-describedby at its id so a screen
// reader reads the hint with the field.
function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-description"
      className={cn('text-sm font-normal leading-normal text-muted-foreground', className)}
      {...props}
    />
  )
}

export { FieldGroup, Field, FieldLabel, FieldDescription }
