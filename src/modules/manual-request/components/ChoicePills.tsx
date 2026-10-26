import React, { useId, useImperativeHandle, useRef } from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { cn } from '../../../ui-shared-utils'

export interface ChoicePillOption {
  value: string
  label: string
}

// What a parent can do through the ref: focus the group (the chosen pill, or the first one). The
// order form hands react-hook-form's field.ref here, so an error can focus the pills (spec 0006, AC-13).
export interface ChoicePillsHandle {
  focus: () => void
}

// `extends Omit<...>`: takes every prop of Radix's radio group root (aria-describedby, aria-invalid,
// id from FormControl), except the value props, which this component types itself.
interface ChoicePillsProps
  extends Omit<React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>, 'value' | 'onValueChange' | 'defaultValue'> {
  label: string
  options: ChoicePillOption[]
  // '' when nothing is chosen yet
  value: string
  onValueChange: (value: string) => void
}

/**
 * A single choice drawn as a row of 48 px pills (spec 0006: Ready in, Size). It is a radio group, so
 * arrow keys move between pills and a screen reader says "radio button, 2 of 5". The chosen pill is
 * `primary`, the others `outline`; the row wraps to a second line on a narrow phone.
 */
export const ChoicePills = React.forwardRef<ChoicePillsHandle, ChoicePillsProps>(function ChoicePills(
  { label, options, value, onValueChange, className, ...rootProps },
  ref,
) {
  const labelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  // useImperativeHandle: what the parent's ref receives is this small object, not the DOM element.
  useImperativeHandle(ref, () => ({
    focus: () => {
      const pills = rootRef.current?.querySelectorAll<HTMLButtonElement>('button[role="radio"]')
      const chosen = rootRef.current?.querySelector<HTMLButtonElement>('button[data-state="checked"]')
      ;(chosen ?? pills?.[0])?.focus()
    },
  }))

  return (
    <div className="space-y-2">
      <p id={labelId} className="text-sm font-medium leading-none">
        {label}
      </p>
      <RadioGroupPrimitive.Root
        ref={rootRef}
        aria-labelledby={labelId}
        value={value}
        onValueChange={onValueChange}
        className={cn('flex flex-wrap gap-2', className)}
        {...rootProps}
      >
        {options.map((option) => (
          <RadioGroupPrimitive.Item
            key={option.value}
            value={option.value}
            className={cn(
              'inline-flex h-12 min-w-[3rem] items-center justify-center rounded-md border border-input bg-background px-4 text-base font-medium ring-offset-background transition-colors',
              'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:hover:bg-primary/90',
            )}
          >
            {option.label}
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
    </div>
  )
})
