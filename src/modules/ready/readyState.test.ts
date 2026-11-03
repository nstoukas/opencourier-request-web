// Spec 0023 (AC-8): which view of the ready time an order gets, from its status and times alone.
import { READY_ACTION_STATUSES, READY_DELAY_OPTIONS, readyView } from './readyState'

describe('readyState (spec 0023, AC-8)', () => {
  const READY_AT = '2026-11-03T12:32:00.000Z'
  const FOOD_READY_AT = '2026-11-03T12:30:00.000Z'

  it('READY_ACTION_STATUSES is exactly the pre pickup set of the spec', () => {
    expect([...READY_ACTION_STATUSES].sort()).toEqual(
      ['ACCEPTED', 'ASSIGNING_COURIER', 'COURIER_ARRIVED_AT_PICKUP_LOCATION', 'CREATED', 'DISPATCHED'].sort(),
    )
  })

  it('the delay buttons are +5, +10 and +15 only', () => {
    expect([...READY_DELAY_OPTIONS]).toEqual([5, 10, 15])
  })

  it.each([...READY_ACTION_STATUSES])('%s with a ready time and no food ready: actions', (status) => {
    expect(readyView({ status, readyAt: READY_AT, foodReadyAt: null })).toBe('actions')
  })

  it.each([...READY_ACTION_STATUSES])('%s with food ready set: ready, no buttons', (status) => {
    expect(readyView({ status, readyAt: READY_AT, foodReadyAt: FOOD_READY_AT })).toBe('ready')
  })

  it.each([...READY_ACTION_STATUSES])(
    '%s with no ready time and no food ready (an order from before ready times): none',
    (status) => {
      expect(readyView({ status, readyAt: null, foodReadyAt: null })).toBe('none')
    },
  )

  it.each(['PICKED_UP', 'ON_THE_WAY', 'COURIER_ARRIVED_AT_DROPOFF_LOCATION', 'DROPPED_OFF', 'CANCELED', 'FAILED'])(
    '%s (picked up or ended) with no food ready: none',
    (status) => {
      expect(readyView({ status, readyAt: READY_AT, foodReadyAt: null })).toBe('none')
      expect(readyView({ status, readyAt: null, foodReadyAt: null })).toBe('none')
    },
  )
})
