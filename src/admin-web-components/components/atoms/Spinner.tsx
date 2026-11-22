import * as React from 'react'
import { CircleNotch } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

import { cn } from '../../../ui-shared-utils'

// `React.ComponentProps<typeof CircleNotch>` means "whatever props the Phosphor icon takes",
// so callers can still pass className, size or weight.
type SpinnerProps = React.ComponentProps<typeof CircleNotch> & { label?: string }

/**
 * The loading mark: Phosphor's CircleNotch, spinning. Put it inside the disabled button that
 * started the work and keep the button's label. Lists and cards load with Skeleton instead.
 */
function Spinner({ className, label, ...props }: SpinnerProps) {
  const { t } = useTranslation()
  return (
    <CircleNotch
      role="status"
      // With no label of its own, "Loading" in the reader's language.
      aria-label={label ?? t('common.loadingLabel')}
      // Icons are hidden from screen readers by default (IconContext in _app.tsx). The spinner
      // is the one icon that says something ("Loading"), so it opts back in.
      aria-hidden={false}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
