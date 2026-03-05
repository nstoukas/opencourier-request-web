/**
 * Inline error banner with optional technical detail expansion (dev mode).
 */
import React, { useState } from 'react'
import { Alert, AlertDescription } from '../../../admin-web-components'
import { AlertTriangleIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '../../../ui-shared-utils'

interface ErrorBannerProps {
  title?: string
  message: string
  detail?: string
  className?: string
}

export function ErrorBanner({ title = 'An error occurred', message, detail, className }: ErrorBannerProps) {
  const [expanded, setExpanded] = useState(false)
  const isDev = process.env.NODE_ENV === 'development'

  return (
    <Alert variant="destructive" className={cn('', className)}>
      <AlertTriangleIcon className="h-4 w-4" />
      <AlertDescription>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5">{message}</p>

        {isDev && detail && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs underline opacity-70 hover:opacity-100"
            >
              {expanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
              Technical details
            </button>
            {expanded && (
              <pre className="mt-1 text-xs whitespace-pre-wrap break-all opacity-80">{detail}</pre>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  )
}
