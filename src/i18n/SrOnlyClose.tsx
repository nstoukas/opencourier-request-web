import { useTranslation } from 'react-i18next'

/** "Close" for screen readers, in the reader's language: the words of an icon only close button. */
export function SrOnlyClose() {
  const { t } = useTranslation()
  return <span className="sr-only">{t('common.close')}</span>
}
