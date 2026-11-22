// The portal's Greek texts (spec 0054, AC-2, AC-10), drafted by Claude in the build and still to
// be checked by a Greek speaking member before go live (docs/translations/greek-review.md).
// Wording rules: plain everyday Greek, the polite plural to the restaurant, "διανομέας" for the
// rider, "κατάστημα" for the restaurant, "συνεταιρισμός" for the co-op, no Greeklish.
// `Translations` is the shape of the English file: TypeScript checks this object has exactly
// the same keys, so neither language can miss one.
import type { Translations } from './en'

export const el: Translations = {
  common: {
    appName: 'OpenCourier',
    optional: '(προαιρετικό)',
    tryAgain: 'Δοκιμάστε ξανά',
    cancel: 'Άκυρο',
    close: 'Κλείσιμο',
    save: 'Αποθήκευση',
    saving: 'Αποθήκευση…',
    loading: 'Φόρτωση…',
    minutes_one: '{{count}} λεπτό',
    minutes_other: '{{count}} λεπτά',
  },
  language: {
    label: 'Γλώσσα',
  },
  frame: {
    navNewDelivery: 'Νέα διανομή',
    navMyOrders: 'Οι παραγγελίες μου',
    navCustomers: 'Πελάτες',
    navLabel: 'Κύριο μενού',
    signOut: 'Αποσύνδεση',
    sessionEnded: 'Η σύνδεσή σας έληξε. Συνδεθείτε ξανά.',
    signOutFailed: 'Η αποσύνδεση δεν έγινε. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.',
    sessionCheckFailed: 'Δεν ελέγχθηκε η σύνδεσή σας. Ελέγξτε τη σύνδεσή σας στο διαδίκτυο και δοκιμάστε ξανά.',
    checkingSignIn: 'Έλεγχος σύνδεσης',
    skipToContent: 'Μετάβαση στο περιεχόμενο',
  },
  signIn: {
    title: 'Σύνδεση · OpenCourier',
    heading: 'Πύλη καταστημάτων',
    intro: 'Συνδεθείτε με το email και τον κωδικό που έδωσε ο συνεταιρισμός στο κατάστημά σας.',
    email: 'Email',
    password: 'Κωδικός',
    passwordHint: 'Τον ξεχάσατε; Ζητήστε από τον συνεταιρισμό να ορίσει νέο.',
    failedTitle: 'Η σύνδεση δεν έγινε',
    signingIn: 'Σύνδεση…',
    submit: 'Σύνδεση',
    missingFields: 'Συμπληρώστε το email και τον κωδικό σας και πατήστε Σύνδεση.',
    wrongCredentials: 'Το email και ο κωδικός δεν ταιριάζουν. Ελέγξτε για λάθη και δοκιμάστε ξανά.',
    tooManyTries: 'Πολλές προσπάθειες στη σειρά. Περιμένετε ένα λεπτό και δοκιμάστε ξανά.',
    serverDown: 'Ο διακομιστής του συνεταιρισμού δεν απάντησε. Ελέγξτε τη σύνδεσή σας στο διαδίκτυο και δοκιμάστε ξανά σε ένα λεπτό.',
  },
}
