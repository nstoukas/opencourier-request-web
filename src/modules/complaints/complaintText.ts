// Spec 0052 (row 83): every sentence the complaint section shows, in one place and keyed, so row 47
// (spec 0054, Greek) can move them into translation files as they are. request-web has no translation
// library yet; until then this is its English file for complaints.
export const COMPLAINT_TEXT = {
  sectionTitle: 'Complaint about the rider',
  intro:
    'Something went wrong with the rider on this order? Tell the co-op. The rider reads it and replies first, then a person at the co-op decides.',
  open: 'Complain about the rider',
  whatHappened: 'What happened?',
  textLabel: 'Your complaint',
  textPlaceholder: 'What happened, in your words',
  send: 'Send complaint',
  cancel: 'Cancel',
  sent: 'Sent. The co-op has your complaint; the outcome shows here.',
  sendFailed: 'The complaint could not be sent.',
  listFailed: 'Your complaints on this order could not be loaded.',
  filedOn: 'Sent',
  statusOpen: 'With the co-op. A person decides after hearing the rider.',
  statusDecided: 'Outcome',
  statusWithdrawn: 'Withdrawn by the co-op',
  category: {
    LATE: 'Late',
    RUDE: 'Rude',
    FOOD_DAMAGED: 'Food damaged',
    OTHER: 'Something else',
  } as Record<string, string>,
} as const

// A category the page does not know (a newer server) reads "Something else", never a raw code.
export const complaintCategoryLabel = (category: string): string =>
  COMPLAINT_TEXT.category[category] ?? COMPLAINT_TEXT.category.OTHER
