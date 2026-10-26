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
