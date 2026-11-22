// Spec 0052 (row 83): every sentence the complaint section shows, keyed in one place. Row 47 (spec 0054)
// moved the words into the language files (src/i18n/resources, under `complaints.`); this object now
// holds their translation keys, so the section reads `t(COMPLAINT_TEXT.send)`.
export const COMPLAINT_TEXT = {
  sectionTitle: 'complaints.sectionTitle',
  intro: 'complaints.intro',
  open: 'complaints.open',
  whatHappened: 'complaints.whatHappened',
  textLabel: 'complaints.textLabel',
  textPlaceholder: 'complaints.textPlaceholder',
  send: 'complaints.send',
  cancel: 'common.cancel',
  sent: 'complaints.sent',
  sendFailed: 'complaints.sendFailed',
  listFailed: 'complaints.listFailed',
  filedOn: 'complaints.filedOn',
  statusOpen: 'complaints.statusOpen',
  statusDecided: 'complaints.statusDecided',
  statusWithdrawn: 'complaints.statusWithdrawn',
  category: {
    LATE: 'complaints.categoryLate',
    RUDE: 'complaints.categoryRude',
    FOOD_DAMAGED: 'complaints.categoryFoodDamaged',
    OTHER: 'complaints.categoryOther',
  } as Record<string, string>,
} as const

// The translation key of a category's label. A category the page does not know (a newer server) reads
// "Something else", never a raw code.
export const complaintCategoryLabel = (category: string): string =>
  COMPLAINT_TEXT.category[category] ?? COMPLAINT_TEXT.category.OTHER
