// Spec 0017 (AC-5). A call through the partner proxy that answers 401 means the restaurant's session may
// have ended mid visit. The fetch helper is a plain function with no React around it, so it tells the
// portal frame through this tiny listener list; the frame subscribes once and checks the session again.

type Listener = () => void

const listeners = new Set<Listener>()

// Returns the function that unsubscribes (for a React effect's cleanup).
export function onPartnerUnauthorized(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyPartnerUnauthorized(): void {
  listeners.forEach((listener) => listener())
}
