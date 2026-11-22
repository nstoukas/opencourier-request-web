import { createI18n } from '../../i18n/createI18n'
import { COMPLAINT_TEXT, complaintCategoryLabel } from './complaintText'

const t = createI18n('en').t

// Spec 0052 (row 83, AC-1): category labels and text strings for complaints about a rider.
// Strings are keyed in one module so spec 0054 (Greek) can move them directly to translation files.
describe('complaintText (spec 0052, AC-1)', () => {
  describe('complaintCategoryLabel', () => {
    it('maps known categories to their human readable labels', () => {
      expect(complaintCategoryLabel('LATE')).toBe(COMPLAINT_TEXT.category.LATE)
      expect(t(complaintCategoryLabel('LATE'))).toBe('Late')
      expect(complaintCategoryLabel('RUDE')).toBe(COMPLAINT_TEXT.category.RUDE)
      expect(t(complaintCategoryLabel('RUDE'))).toBe('Rude')
      expect(complaintCategoryLabel('FOOD_DAMAGED')).toBe(COMPLAINT_TEXT.category.FOOD_DAMAGED)
      expect(t(complaintCategoryLabel('FOOD_DAMAGED'))).toBe('Food damaged')
      expect(complaintCategoryLabel('OTHER')).toBe(COMPLAINT_TEXT.category.OTHER)
      expect(t(complaintCategoryLabel('OTHER'))).toBe('Something else')
    })

    it('falls back to "Something else" for an unknown category from a newer server', () => {
      // AC-1: never show a raw code like UNKNOWN_CATEGORY to the user
      expect(complaintCategoryLabel('UNRECOGNIZED_CODE')).toBe(COMPLAINT_TEXT.category.OTHER)
      expect(t(complaintCategoryLabel('UNRECOGNIZED_CODE'))).toBe('Something else')
      expect(complaintCategoryLabel('')).toBe(COMPLAINT_TEXT.category.OTHER)
      expect(t(complaintCategoryLabel(''))).toBe('Something else')
    })
  })

  describe('COMPLAINT_TEXT structure', () => {
    it('defines all required UI text keys for the complaint section', () => {
      expect(COMPLAINT_TEXT.sectionTitle).toBe('complaints.sectionTitle')
      expect(t(COMPLAINT_TEXT.sectionTitle)).toBe('Complaint about the rider')
      expect(COMPLAINT_TEXT.open).toBe('complaints.open')
      expect(t(COMPLAINT_TEXT.open)).toBe('Complain about the rider')
      expect(COMPLAINT_TEXT.whatHappened).toBe('complaints.whatHappened')
      expect(t(COMPLAINT_TEXT.whatHappened)).toBe('What happened?')
      expect(COMPLAINT_TEXT.textLabel).toBe('complaints.textLabel')
      expect(t(COMPLAINT_TEXT.textLabel)).toBe('Your complaint')
      expect(COMPLAINT_TEXT.send).toBe('complaints.send')
      expect(t(COMPLAINT_TEXT.send)).toBe('Send complaint')
      expect(COMPLAINT_TEXT.cancel).toBe('common.cancel')
      expect(t(COMPLAINT_TEXT.cancel)).toBe('Cancel')
      expect(COMPLAINT_TEXT.sent).toBe('complaints.sent')
      expect(t(COMPLAINT_TEXT.sent)).toBe('Sent. The co-op has your complaint; the outcome shows here.')
      expect(COMPLAINT_TEXT.statusOpen).toBe('complaints.statusOpen')
      expect(t(COMPLAINT_TEXT.statusOpen)).toBe('With the co-op. A person decides after hearing the rider.')
      expect(COMPLAINT_TEXT.statusDecided).toBe('complaints.statusDecided')
      expect(t(COMPLAINT_TEXT.statusDecided)).toBe('Outcome')
      expect(COMPLAINT_TEXT.statusWithdrawn).toBe('complaints.statusWithdrawn')
      expect(t(COMPLAINT_TEXT.statusWithdrawn)).toBe('Withdrawn by the co-op')
    })
  })
})
