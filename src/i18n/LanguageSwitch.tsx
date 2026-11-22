import { useTranslation } from 'react-i18next'
import { toast } from '../admin-web-components'
import { saveAccountLanguage } from '../api/manualRequestApi'
import { cn } from '../ui-shared-utils'
import { applyLanguage, markChosenBeforeSignIn } from './languageChoice'
import { LANGUAGES, LANGUAGE_NAMES, toLanguage, type Language } from './language'

/**
 * The language switch (spec 0054, AC-2): "ΕΛ" and "EN" side by side, the current one pressed.
 * A tap switches this page at once with no reload, saves the choice in the `oc_lang` cookie (so the
 * next page load renders in it on the server) and, when signed in, on the restaurant user's own account
 * (`User.language`, through `PUT partner/v1/auth/language`), so the next sign in on any computer and the
 * mails start in it. The same behaviour as adminweb's switch (decision 47.32).
 * `signedIn` is false on the sign in card: there the choice waits for the sign in, which saves it.
 */
export function LanguageSwitch({ className, signedIn = false }: { className?: string; signedIn?: boolean }) {
  // useTranslation gives the page's i18next instance; `i18n.language` is the language on show.
  const { t, i18n } = useTranslation()
  const current = toLanguage(i18n.language)

  const choose = (language: Language) => {
    if (language === current) return
    applyLanguage(i18n, language)
    if (!signedIn) {
      // On the sign in card: sign in will save this choice to the account.
      markChosenBeforeSignIn()
      return
    }
    // The page has already switched; a failed save only means the next sign in starts in the old one.
    saveAccountLanguage(language).catch(() => toast({ title: t('language.saveFailed'), variant: 'destructive' }))
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
