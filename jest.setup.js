// Adds DOM matchers such as toBeInTheDocument() to expect().
require('@testing-library/jest-dom')

// Polyfill AbortSignal.timeout in JSDOM environment if missing
if (typeof AbortSignal.timeout !== 'function') {
  AbortSignal.timeout = function (ms) {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), ms)
    return controller.signal
  }
}

// JSDOM has no ResizeObserver; Radix's Checkbox (the saved customer tick) and cmdk's list measure
// themselves with one. A do nothing stand in is enough under Jest, where nothing is laid out.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// JSDOM has no scrollIntoView either; cmdk calls it on the selected row.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {}
}

// The Greek interface (row 47, spec 0054): components read their words through react-i18next.
// In the app, _app hands each page its own instance; under Jest no _app renders, so one shared
// instance in English is registered here (initReactI18next makes it the one useTranslation finds
// without a provider). English, because the existing tests assert the English words (spec 0054,
// cross check 12: tests that assert English text pin the language to `en`). A test about Greek
// makes its own instance with createI18n('el') and wraps the component in an I18nextProvider.
const { initReactI18next } = require('react-i18next')
const { createI18n } = require('./src/i18n/createI18n')
const testI18n = createI18n('en')
initReactI18next.init(testI18n)
