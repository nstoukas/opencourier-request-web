// Spec 0046 (row 10): multi leg orders, the pure rules the order form, the order page and the history share.
// Written from the spec's acceptance criteria and its "Cross check" section (which wins where they differ),
// by a Fable subagent standing in for agy (decision R.25).
import {
  BOX_COUNTS,
  MAX_BOXES,
  absentLegNumbers,
  groupHistory,
  legDeliveryInput,
  legLabel,
  legPriceLines,
  legsToCancel,
  orderReferenceForLegs,
  retryQuoteInput,
} from './legs'
import {
  ManualRequestDeliveryInput,
  ManualRequestPackageSize,
  ManualRequestQuoteDto,
  PartnerDeliveryDto,
} from '../types'

// el-GR money uses a no-break space before the euro sign; the tests read it as a plain space.
const plain = (text: string) => text.replace(/ /g, ' ')

const quote = (id: string, cents: number): ManualRequestQuoteDto => ({
  id,
  quoteRangeFrom: cents,
  quoteRangeTo: cents,
  currency: 'EUR',
  duration: 15,
  distance: 2,
  distanceUnit: 'km',
  expiresAt: '2026-11-21T12:30:00.000Z',
  dropoffEta: null,
  createdAt: '2026-11-21T12:00:00.000Z',
})

const delivery = (id: string, overrides: Partial<PartnerDeliveryDto> = {}): PartnerDeliveryDto => ({
  id,
  status: 'ASSIGNING_COURIER',
  orderReference: 'order-77',
  currencyCode: 'EUR',
  totalCost: 380,
  createdAt: '2026-11-21T12:00:00.000Z',
  pickupReadyAt: null,
  readyAt: '2026-11-21T12:20:00.000Z',
  foodReadyAt: null,
  pickupDeadlineAt: null,
  dropoffEta: null,
  dropoffReadyAt: null,
  dropoffDeadlineAt: null,
  legNumber: null,
  legCount: null,
  ...overrides,
})

describe('multi leg orders: the rules (spec 0046)', () => {
  describe('AC-2: "How many boxes?" goes from 1 to 4', () => {
    it('offers 1, 2, 3 and 4', () => {
      expect([...BOX_COUNTS]).toEqual([1, 2, 3, 4])
      expect(MAX_BOXES).toBe(4)
    })
  })

  it('legLabel reads "Leg 1 of 2"', () => {
    expect(legLabel(1, 2)).toBe('Leg 1 of 2')
    expect(legLabel(3, 4)).toBe('Leg 3 of 4')
  })

  describe('AC-2, cross check 7: the total before Confirm (legPriceLines)', () => {
    it('one box has no total line', () => {
      expect(legPriceLines([])).toEqual([])
      expect(legPriceLines([quote('q1', 380)])).toEqual([])
    })

    it('two legs at the same price read "2 deliveries × 3,80 € = 7,60 €"', () => {
      expect(legPriceLines([quote('q1', 380), quote('q2', 380)]).map(plain)).toEqual(['2 deliveries × 3,80 € = 7,60 €'])
    })

    it('four legs at the same price sum all four', () => {
      const lines = legPriceLines([quote('q1', 356), quote('q2', 356), quote('q3', 356), quote('q4', 356)])
      expect(lines.map(plain)).toEqual(['4 deliveries × 3,56 € = 14,24 €'])
    })

    it('prices that differ get one line per leg, then the total', () => {
      const lines = legPriceLines([quote('q1', 356), quote('q2', 392), quote('q3', 356)])
      expect(lines.map(plain)).toEqual(['Leg 1 of 3: 3,56 €', 'Leg 2 of 3: 3,92 €', 'Leg 3 of 3: 3,56 €', 'Total 11,04 €'])
    })
  })

  describe('cross check 1: the reference every leg shares (orderReferenceForLegs)', () => {
    it('is the first quote id when nothing was typed', () => {
      expect(orderReferenceForLegs('quote-1')).toBe('quote-1')
      expect(orderReferenceForLegs('quote-1', null)).toBe('quote-1')
      expect(orderReferenceForLegs('quote-1', '   ')).toBe('quote-1')
    })

    it('is the typed reference, "#", then the first quote id', () => {
      expect(orderReferenceForLegs('quote-1', 'Table 4')).toBe('Table 4#quote-1')
      expect(orderReferenceForLegs('quote-1', '  Table 4 ')).toBe('Table 4#quote-1')
    })
  })

  describe('AC-2, cross check 6: one leg\'s delivery body (legDeliveryInput)', () => {
    const base = {
      quoteId: 'quote-1',
      idempotencyKey: 'single-key',
      pickupName: 'Nosh',
      dropoffName: 'Vassilis',
      dropoffNotes: 'Floor: 4 · Doorbell: Spanoulis',
      dropoffSellerNotes: 'Ring twice',
      orderTotalValue: 2000,
      orderItems: [{ name: 'Souvlaki', quantity: 3 }],
      boxSize: ManualRequestPackageSize.LARGE,
    } as unknown as ManualRequestDeliveryInput
    const leg = (legNumber: number, quoteId: string, boxSize: ManualRequestPackageSize) =>
      legDeliveryInput(base, { legNumber, legCount: 2, quote: quote(quoteId, 380), boxSize, orderReference: 'quote-1' })

    it('each leg carries its own quote, its own size, the shared reference and its labels', () => {
      const one = leg(1, 'quote-1', ManualRequestPackageSize.LARGE)
      const two = leg(2, 'quote-2', ManualRequestPackageSize.SMALL)

      expect(one).toMatchObject({ quoteId: 'quote-1', boxSize: 'LARGE', orderReference: 'quote-1', legNumber: 1, legCount: 2 })
      expect(two).toMatchObject({ quoteId: 'quote-2', boxSize: 'SMALL', orderReference: 'quote-1', legNumber: 2, legCount: 2 })
    })

    it('the order total goes on leg 1 only; every other leg carries 0', () => {
      expect(leg(1, 'quote-1', ManualRequestPackageSize.LARGE).orderTotalValue).toBe(2000)
      expect(leg(2, 'quote-2', ManualRequestPackageSize.SMALL).orderTotalValue).toBe(0)
    })

    it('the items and the notes go on every leg', () => {
      for (const body of [leg(1, 'quote-1', ManualRequestPackageSize.LARGE), leg(2, 'quote-2', ManualRequestPackageSize.SMALL)]) {
        expect(body.orderItems).toEqual([{ name: 'Souvlaki', quantity: 3 }])
        expect(body.dropoffNotes).toBe('Floor: 4 · Doorbell: Spanoulis')
        expect(body.dropoffSellerNotes).toBe('Ring twice')
      }
    })

    it('each leg has its own idempotency key, even when two legs share a quote id', () => {
      const one = leg(1, 'quote-1', ManualRequestPackageSize.LARGE)
      const two = leg(2, 'quote-1', ManualRequestPackageSize.SMALL)

      expect(one.idempotencyKey).toBeTruthy()
      expect(two.idempotencyKey).toBeTruthy()
      expect(one.idempotencyKey).not.toBe(two.idempotencyKey)
      expect(one.idempotencyKey).not.toBe('single-key')
    })
  })

  describe('cross check 8: the legs "Cancel all" still cancels (legsToCancel)', () => {
    it.each(['DROPPED_OFF', 'DELIVERED', 'CANCELED', 'FAILED'])('skips a leg already %s', (status) => {
      const open = delivery('del-1', { legNumber: 1, legCount: 2 })
      const ended = delivery('del-2', { legNumber: 2, legCount: 2, status })

      expect(legsToCancel([open, ended])).toEqual([open])
    })

    it.each(['CREATED', 'ASSIGNING_COURIER', 'ACCEPTED', 'DISPATCHED', 'PICKED_UP', 'ON_THE_WAY'])(
      'still cancels a leg that is %s (not yet delivered, AC-5)',
      (status) => {
        const leg = delivery('del-1', { legNumber: 1, legCount: 2, status })
        expect(legsToCancel([leg])).toEqual([leg])
      },
    )
  })

  describe('AC-6: the history groups legs under one order (groupHistory)', () => {
    it('a single delivery stays as it is', () => {
      const single = delivery('del-single')
      expect(groupHistory([single])).toEqual([{ kind: 'single', delivery: single }])
    })

    it('two legs of one order become one item, legs by number, at the place of the first leg seen', () => {
      const before = delivery('del-before', { orderReference: 'other-1' })
      const legTwo = delivery('del-2', { legNumber: 2, legCount: 2 })
      const between = delivery('del-between', { orderReference: 'other-2' })
      const legOne = delivery('del-1', { legNumber: 1, legCount: 2 })

      const items = groupHistory([before, legTwo, between, legOne])

      expect(items).toHaveLength(3)
      expect(items[0]).toEqual({ kind: 'single', delivery: before })
      expect(items[1]).toEqual({ kind: 'order', key: 'order-77', legCount: 2, legs: [legOne, legTwo] })
      expect(items[2]).toEqual({ kind: 'single', delivery: between })
    })

    it('two orders keep their own legs', () => {
      const a1 = delivery('a1', { orderReference: 'order-a', legNumber: 1, legCount: 2 })
      const b1 = delivery('b1', { orderReference: 'order-b', legNumber: 1, legCount: 3 })
      const a2 = delivery('a2', { orderReference: 'order-a', legNumber: 2, legCount: 2 })

      const items = groupHistory([a1, b1, a2])

      expect(items).toEqual([
        { kind: 'order', key: 'order-a', legCount: 2, legs: [a1, a2] },
        { kind: 'order', key: 'order-b', legCount: 3, legs: [b1] },
      ])
    })

    it('a single delivery sharing a reference with nothing labelled is never grouped', () => {
      const one = delivery('del-1', { orderReference: 'same' })
      const two = delivery('del-2', { orderReference: 'same' })

      expect(groupHistory([one, two]).map((item) => item.kind)).toEqual(['single', 'single'])
    })

    it('a lone leg still shows as an order (so its missing sibling can be seen)', () => {
      const lone = delivery('del-1', { legNumber: 1, legCount: 2 })
      expect(groupHistory([lone])).toEqual([{ kind: 'order', key: 'order-77', legCount: 2, legs: [lone] }])
    })
  })

  describe('cross check 4: the legs never sent (absentLegNumbers)', () => {
    it('fewer siblings than legCount gives the missing numbers', () => {
      expect(absentLegNumbers(3, [delivery('del-1', { legNumber: 1, legCount: 3 })])).toEqual([2, 3])
      expect(absentLegNumbers(2, [delivery('del-2', { legNumber: 2, legCount: 2 })])).toEqual([1])
    })

    it('a complete order misses none', () => {
      expect(
        absentLegNumbers(2, [delivery('del-1', { legNumber: 1, legCount: 2 }), delivery('del-2', { legNumber: 2, legCount: 2 })]),
      ).toEqual([])
    })
  })

  describe('AC-3: a missing leg is priced again from a leg that was sent (retryQuoteInput)', () => {
    const sent = delivery('del-1', {
      legNumber: 1,
      legCount: 2,
      pickup: {
        id: 'loc-p',
        latitude: 39.3628,
        longitude: 22.9435,
        formattedAddress: 'Ermou 120, Volos',
        street: 'Ermou 120',
        city: 'Volos',
        state: 'Thessaly',
        zipCode: '38221',
        countryCode: 'GR',
        pickupName: 'Nosh',
        pickupPhoneNumber: '+302421012345',
        pickupBusinessName: 'Nosh',
        pickupNotes: null,
      },
      dropoff: {
        id: 'loc-d',
        latitude: 39.361,
        longitude: 22.942,
        formattedAddress: 'Iasonos 80, Volos',
        street: 'Iasonos 80',
        city: 'Volos',
        state: 'Thessaly',
        zipCode: '38221',
        countryCode: 'GR',
        dropoffName: 'Vassilis Spanoulis',
        dropoffPhoneNumber: '+306911223344',
        dropoffBusinessName: null,
        dropoffNotes: 'Floor: 4 · Doorbell: Spanoulis',
        dropoffSellerNotes: 'Ring twice',
        dropoffFloor: '4',
        dropoffDoorbell: 'Spanoulis',
      },
    })

    it('asks for the same two addresses and points', () => {
      const input = retryQuoteInput(sent)

      expect(input.pickupLatitude).toBe(39.3628)
      expect(input.pickupLongitude).toBe(22.9435)
      expect(input.dropoffLatitude).toBe(39.361)
      expect(input.dropoffLongitude).toBe(22.942)
      expect(input.pickupAddress).toMatchObject({ streetAddress: ['Ermou 120'], city: 'Volos', zipCode: '38221', countryCode: 'GR' })
      expect(input.dropoffAddress).toMatchObject({ streetAddress: ['Iasonos 80'], city: 'Volos', zipCode: '38221', countryCode: 'GR' })
    })

    it('keeps the customer, the notes, the floor and the doorbell (cross check 6: notes on every leg)', () => {
      const input = retryQuoteInput(sent)

      expect(input).toMatchObject({
        pickupName: 'Nosh',
        pickupBusinessName: 'Nosh',
        dropoffName: 'Vassilis Spanoulis',
        dropoffPhoneNumber: '+306911223344',
        dropoffNotes: 'Floor: 4 · Doorbell: Spanoulis',
        dropoffSellerNotes: 'Ring twice',
        dropoffFloor: '4',
        dropoffDoorbell: 'Spanoulis',
      })
    })

    it('carries no order total (cross check 6: the total is on leg 1 only)', () => {
      expect(retryQuoteInput(sent).orderTotalValue).toBe(0)
    })
  })
})
