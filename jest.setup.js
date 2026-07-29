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
