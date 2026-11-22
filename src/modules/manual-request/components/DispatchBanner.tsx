import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '../../../admin-web-components'
import { useDispatchStateQuery, type DispatchStopView } from '../../../api/manualRequestApi'
import { codedSentenceText } from '../../../i18n/serverText'

// Spec 0014, AC-6: while dispatch is stopped for heat or a storm, the restaurant reads it before
// filling the form, and when a stop starts within 12 hours it reads that too. The sentences come
// from the backend by code (`server.notice`), worded here in the reader's language and Athens time; a
// code this copy does not know shows the backend's English (spec 0054, row 124).
export function DispatchBanner() {
  const { t, i18n } = useTranslation()
  const { data } = useDispatchStateQuery()
  if (!data) return null
  const sentence = (stop: DispatchStopView) =>
    codedSentenceText(i18n, 'notice', stop.messageCode, stop.messageParams, stop.message)

  if (data.current) {
    return (
      <Alert variant="destructive" role="status">
        <AlertTitle>{t('dispatch.stoppedTitle')}</AlertTitle>
        <AlertDescription>{sentence(data.current)}</AlertDescription>
      </Alert>
    )
  }
  if (data.next) {
    return (
      <Alert role="status">
        <AlertTitle>{t('dispatch.stopsSoonTitle')}</AlertTitle>
        <AlertDescription>{sentence(data.next)}</AlertDescription>
      </Alert>
    )
  }
  return null
}
