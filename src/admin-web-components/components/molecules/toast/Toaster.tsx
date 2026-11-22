'use client'

import { useTranslation } from 'react-i18next'
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from './Toast'
import { useToast } from './useToast'

export function Toaster() {
  const { t } = useTranslation()
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      {/* Radix names the toast area for screen readers and puts the shortcut where {hotkey} is. */}
      <ToastViewport label={t('common.notifications')} />
    </ToastProvider>
  )
}
