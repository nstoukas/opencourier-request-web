import { useTranslation } from 'react-i18next'
import { cn } from '../ui-shared-utils'
import { LANGUAGES, LANGUAGE_NAMES, saveLanguageCookie, toLanguage, type Language } from './language'

/**
 * The language switch (spec 0054, AC-2): "ΕΛ" and "EN" side by side, the current one pressed.
 * A tap saves the choice in the `oc_lang` cookie (so the next page load renders in it on the
 * server) and switches this page at once, with no reload.
 * Before the backend part of row 47 there is no `User.language` yet, so the cookie is the only
 * place the choice is kept (decision 47.2).
 */
export function LanguageSwitch({ className }: { className?: string }) {
  // useTranslation gives the page's i18next instance; `i18n.language` is the language on show.
  const { t, i18n } = useTranslation()
  const current = toLanguage(i18n.language)

  const choose = (language: Language) => {
    if (language === current) return
    saveLanguageCookie(language)
    void i18n.changeLanguage(language)
    // Screen readers and the browser's own spell check read the page's language from <html lang>.
    document.documentElement.lang = language
  }

  return (
    <div role="group" aria-label={t('language.label')} className={cn('flex shrink-0 rounded-md border p-0.5', className)}>
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          lang={language}
          aria-pressed={language === current}
          // The full name for screen readers and the tooltip; the two letters on screen.
          aria-label={LANGUAGE_NAMES[language]}
          title={LANGUAGE_NAMES[language]}
          onClick={() => choose(language)}
          className={cn(
            'h-8 min-w-9 rounded px-2 text-xs font-semibold uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            language === current ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {language === 'el' ? 'ΕΛ' : 'EN'}
        </button>
      ))}
    </div>
  )
}
