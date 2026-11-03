import React, { useState } from 'react'
import { useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form'
import { Minus, Plus, X } from '@phosphor-icons/react'
import { Button, FormControl, FormField, FormItem, FormMessage, Input } from '../../../admin-web-components'
import { cn } from '../../../ui-shared-utils'
import { LimitCounter } from './LimitCounter'
import { ITEM_LINES_MAX, ITEM_NAME_MAX, ITEM_QUANTITY_MAX, OrderItemKind, emptyItemLine } from '../utils/orderItems'
import type { CreateDeliveryFormValues } from './CreateDeliveryForm'

const KINDS: { value: OrderItemKind; label: string }[] = [
  { value: 'DRINK', label: 'Drink' },
  { value: 'SIDE', label: 'Side' },
]

// Spec 0028 (row 103): the order's items, optional and collapsed, so the fast path (spec 0006) gains no
// field and no focus stop. Each line: a name, a quantity stepper, and Drink and Side as two toggles (a tap
// marks, a tap on the marked one clears, a tap on the other switches). They are buttons with
// aria-pressed, not a radio group: a radio cannot be cleared by tapping it again.
export function OrderItemsSection({ form }: { form: UseFormReturn<CreateDeliveryFormValues> }) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })
  const [open, setOpen] = useState(fields.length > 0)

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full justify-start text-base"
        onClick={() => {
          setOpen(true)
          if (fields.length === 0) append(emptyItemLine())
        }}
      >
        <Plus aria-hidden="true" className="mr-2 h-5 w-5" />
        Add items (optional)
      </Button>
    )
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Items</legend>
      {fields.map((line, index) => (
        <div key={line.id} className="space-y-2 rounded-md border p-3" data-testid={`item-line-${index}`}>
          <div className="flex items-start gap-2">
            <FormField
              control={form.control}
              name={`items.${index}.name`}
              render={({ field }) => (
                <FormItem className="min-w-0 flex-1">
                  <FormControl>
                    <Input
                      aria-label={`Item ${index + 1} name`}
                      placeholder="e.g. Cola"
                      autoComplete="off"
                      className="h-12 text-base"
                      {...field}
                    />
                  </FormControl>
                  <LimitCounter length={field.value?.length ?? 0} limit={ITEM_NAME_MAX} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="ghost"
              className="h-12 w-12 shrink-0 p-0"
              aria-label={`Remove item ${index + 1}`}
              onClick={() => remove(index)}
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FormField
              control={form.control}
              name={`items.${index}.quantity`}
              render={({ field }) => (
                <div className="flex items-center gap-1" role="group" aria-label={`Quantity of item ${index + 1}`}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-12 p-0"
                    aria-label="One less"
                    disabled={field.value <= 1}
                    onClick={() => field.onChange(Math.max(1, field.value - 1))}
                  >
                    <Minus aria-hidden="true" className="h-5 w-5" />
                  </Button>
                  <span className="w-8 text-center text-base tabular-nums" aria-live="polite">
                    {field.value}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-12 p-0"
                    aria-label="One more"
                    disabled={field.value >= ITEM_QUANTITY_MAX}
                    onClick={() => field.onChange(Math.min(ITEM_QUANTITY_MAX, field.value + 1))}
                  >
                    <Plus aria-hidden="true" className="h-5 w-5" />
                  </Button>
                </div>
              )}
            />
            <FormField
              control={form.control}
              name={`items.${index}.kind`}
              render={({ field }) => (
                <KindGroup form={form} index={index}>
                  {KINDS.map((kind) => {
                    const pressed = field.value === kind.value
                    return (
                      <button
                        key={kind.value}
                        type="button"
                        aria-pressed={pressed}
                        onClick={() => field.onChange(pressed ? null : kind.value)}
                        className={cn(
                          'h-12 rounded-md border px-4 text-base font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          pressed ? 'border-primary bg-primary text-primary-foreground' : 'bg-background',
                        )}
                      >
                        {kind.label}
                      </button>
                    )
                  })}
                </KindGroup>
              )}
            />
          </div>
        </div>
      ))}
      {fields.length < ITEM_LINES_MAX ? (
        <Button type="button" variant="outline" className="h-12 w-full text-base" onClick={() => append(emptyItemLine())}>
          <Plus aria-hidden="true" className="mr-2 h-5 w-5" />
          Add another item
        </Button>
      ) : null}
    </fieldset>
  )
}

// The Drink and Side group, labelled with the line's name as it is typed (useWatch redraws it on each
// keystroke of that name), so a screen reader hears "Kind of Cola" (row 103 review).
function KindGroup({
  form,
  index,
  children,
}: {
  form: UseFormReturn<CreateDeliveryFormValues>
  index: number
  children: React.ReactNode
}) {
  const name = useWatch({ control: form.control, name: `items.${index}.name` })
  return (
    <div className="flex gap-2" role="group" aria-label={`Kind of ${name?.trim() || `item ${index + 1}`}`}>
      {children}
    </div>
  )
}
