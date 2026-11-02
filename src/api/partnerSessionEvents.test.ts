import { onPartnerUnauthorized, notifyPartnerUnauthorized } from './partnerSessionEvents'

describe('partnerSessionEvents (spec 0017, AC-5)', () => {
  it('calls registered listener when notifyPartnerUnauthorized is invoked', () => {
    const listener = jest.fn()
    const unsubscribe = onPartnerUnauthorized(listener)

    expect(listener).not.toHaveBeenCalled()
    notifyPartnerUnauthorized()
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
  })

  it('unsubscribes listener so subsequent notifications are not received', () => {
    const listener = jest.fn()
    const unsubscribe = onPartnerUnauthorized(listener)

    notifyPartnerUnauthorized()
    expect(listener).toHaveBeenCalledTimes(1)

    // Unsubscribe
    unsubscribe()

    notifyPartnerUnauthorized()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('supports multiple listeners and unsubscribes independently', () => {
    const listenerA = jest.fn()
    const listenerB = jest.fn()

    const unsubA = onPartnerUnauthorized(listenerA)
    const unsubB = onPartnerUnauthorized(listenerB)

    notifyPartnerUnauthorized()
    expect(listenerA).toHaveBeenCalledTimes(1)
    expect(listenerB).toHaveBeenCalledTimes(1)

    unsubA()

    notifyPartnerUnauthorized()
    expect(listenerA).toHaveBeenCalledTimes(1)
    expect(listenerB).toHaveBeenCalledTimes(2)

    unsubB()
  })
})
