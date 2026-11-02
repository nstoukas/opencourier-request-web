import { orderCodeOf } from './orderCode'

describe('orderCodeOf (spec 0021, AC-10)', () => {
  it('returns the last 6 characters of a delivery id', () => {
    // Standard delivery ids: last 6 characters are shown so restaurant and rider match bags
    expect(orderCodeOf('cly123456789')).toBe('456789')
    expect(orderCodeOf('del-xyz-789')).toBe('yz-789')
    expect(orderCodeOf('delivery_ABC123XYZ')).toBe('123XYZ')
  })

  it('returns the full string when delivery id is 6 characters or shorter', () => {
    expect(orderCodeOf('123456')).toBe('123456')
    expect(orderCodeOf('abc')).toBe('abc')
    expect(orderCodeOf('1')).toBe('1')
  })

  it('returns an empty string when delivery id is empty, null, or undefined', () => {
    expect(orderCodeOf('')).toBe('')
    expect(orderCodeOf(null)).toBe('')
    expect(orderCodeOf(undefined)).toBe('')
  })
})
