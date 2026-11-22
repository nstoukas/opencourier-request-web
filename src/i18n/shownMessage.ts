import type { TFunction } from 'i18next'

// A message kept in React state until the page shows it (row 47 review, finding 3).
//
// Keep the translation key, not the words. The words are looked up when the message is drawn, so a
// switch of language reaches a message already on screen, and code can compare keys, which stay the
// same in every language (comparing words breaks after a switch: "Confirm the pin" is not
// "Επιβεβαιώστε την πινέζα"). A sentence that is already words, the server's own until the backend
// sends codes (decision 47.3), is kept as text and shown as it is.

/**
 * Either a key (with the values its sentence fills in) or ready words. The `|` makes a union type:
 * a value has one shape or the other, and `showMessage` below asks which.
 */
export type ShownMessage = { key: string; values?: Record<string, unknown> } | { text: string }

/** A message from a translation key, translated when it is shown. */
export function keyMessage(key: string, values?: Record<string, unknown>): ShownMessage {
  return { key, values }
}

/** A message that is already words (a server's sentence); shown as it is. */
export function textMessage(text: string): ShownMessage {
  return { text }
}

/** The words to draw for a message, in the reader's current language. */
export function showMessage(message: ShownMessage, t: TFunction): string {
  // `'key' in message` asks whether the object has a `key` field; TypeScript then knows which shape it is.
  return 'key' in message ? t(message.key, message.values) : message.text
}

/** Whether a message is this translation key (true in every language). */
export function isMessageKey(message: ShownMessage | null, key: string): boolean {
  return message !== null && 'key' in message && message.key === key
}
