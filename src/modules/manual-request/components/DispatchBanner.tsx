import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '../../../admin-web-components'
import { useDispatchStateQuery } from '../../../api/manualRequestApi'

// Spec 0014, AC-6: while dispatch is stopped for heat or a storm, the restaurant reads it before
// filling the form, and when a stop starts within 12 hours it reads that too. The sentences come
// from the backend, in Athens time (still English until the backend part of row 47 sends codes).
export function DispatchBanner() {
  const { t } = useTranslation()
  const { data } = useDispatchStateQuery()
  if (!data) return null

  if (data.current) {
    return (
      <Alert variant="destructive" role="status">
        <AlertTitle>{t('dispatch.stoppedTitle')}</AlertTitle>
        <AlertDescription>{data.current.message}</AlertDescription>
      </Alert>
    )
  }
  if (data.next) {
    return (
      <Alert role="status">
        <AlertTitle>{t('dispatch.stopsSoonTitle')}</AlertTitle>
        <AlertDescription>{data.next.message}</AlertDescription>
      </Alert>
    )
  }
  return null
}
