import * as React from 'react'
import { CircleNotch } from '@phosphor-icons/react'

import { cn } from '../../../ui-shared-utils'

// `React.ComponentProps<typeof CircleNotch>` means "whatever props the Phosphor icon takes",
// so callers can still pass className, size or weight.
type SpinnerProps = React.ComponentProps<typeof CircleNotch> & { label?: string }

/**
 * The loading mark: Phosphor's CircleNotch, spinning. Put it inside the disabled button that
 * started the work and keep the button's label. Lists and cards load with Skeleton instead.
 */
function Spinner({ className, label = 'Loading', ...props }: SpinnerProps) {
  return (
    <CircleNotch
      role="status"
      aria-label={label}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
