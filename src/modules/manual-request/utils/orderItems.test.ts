import { ManualRequestPackageSize } from '../types'
import {
  ITEM_LINES_MAX,
  ITEM_NAME_MAX,
  ITEM_NAME_REQUIRED,
  ITEM_NAME_TOO_LONG,
  ITEM_QUANTITY_MAX,
  emptyItemLine,
  orderItemsPayload,
} from './orderItems'

// Spec 0028 (row 103), AC-3: what the order form's item lines send.
describe('orderItemsPayload (spec 0028 AC-3)', () => {
  it('is undefined with no lines, so the API sends today\'s single "Package" item', () => {
    expect(orderItemsPayload([], ManualRequestPackageSize.MEDIUM)).toBeUndefined()
  })

  it('sends the lines in order, each { name, quantity, kind? }, with the size on the first line only', () => {
    const payload = orderItemsPayload(
      [
        { name: 'Souvlaki', quantity: 2, kind: null },
        { name: 'Cola', quantity: 3, kind: 'DRINK' },
        { name: 'Fries', quantity: 1, kind: 'SIDE' },
      ],
      ManualRequestPackageSize.LARGE,
    )

    expect(payload).toEqual([
      { name: 'Souvlaki', quantity: 2, size: ManualRequestPackageSize.LARGE },
      { name: 'Cola', quantity: 3, kind: 'DRINK' },
      { name: 'Fries', quantity: 1, kind: 'SIDE' },
    ])
  })

  it('puts the size on the first line even when it is marked', () => {
    const payload = orderItemsPayload(
      [
        { name: 'Cola', quantity: 1, kind: 'DRINK' },
        { name: 'Pita', quantity: 1, kind: null },
      ],
      ManualRequestPackageSize.SMALL,
    )

    expect(payload).toEqual([
      { name: 'Cola', quantity: 1, kind: 'DRINK', size: ManualRequestPackageSize.SMALL },
      { name: 'Pita', quantity: 1 },
    ])
    expect(payload![1]).not.toHaveProperty('size')
  })

  it('carries no size key on any line after the first', () => {
    const payload = orderItemsPayload(
      Array.from({ length: 5 }, (_, i) => ({ name: `Item ${i}`, quantity: 1, kind: null })),
      ManualRequestPackageSize.MEDIUM,
    )!

    expect(payload[0].size).toBe(ManualRequestPackageSize.MEDIUM)
    for (const line of payload.slice(1)) {
      expect(line).not.toHaveProperty('size')
    }
  })

  it('trims each name', () => {
    const payload = orderItemsPayload(
      [
        { name: '  Cola  ', quantity: 1, kind: 'DRINK' },
        { name: '\tFries\n', quantity: 1, kind: null },
      ],
      ManualRequestPackageSize.SMALL,
    )!

    expect(payload.map((line) => line.name)).toEqual(['Cola', 'Fries'])
  })

  it('sends kind only when a line is marked (no kind key, never null, on an unmarked line)', () => {
    const payload = orderItemsPayload(
      [
        { name: 'Pita', quantity: 1, kind: null },
        { name: 'Gyros', quantity: 1 },
      ],
      ManualRequestPackageSize.SMALL,
    )!

    for (const line of payload) {
      expect(line).not.toHaveProperty('kind')
    }
    // What reaches the wire.
    expect(JSON.parse(JSON.stringify(payload))).toEqual([
      { name: 'Pita', quantity: 1, size: 'SMALL' },
      { name: 'Gyros', quantity: 1 },
    ])
  })

  it('keeps each quantity as set', () => {
    const payload = orderItemsPayload(
      [
        { name: 'Cola', quantity: 20, kind: 'DRINK' },
        { name: 'Fries', quantity: 7, kind: 'SIDE' },
      ],
      ManualRequestPackageSize.SMALL,
    )!

    expect(payload.map((line) => line.quantity)).toEqual([20, 7])
  })
})

describe('item line rules (spec 0028 AC-2)', () => {
  it('a new line is empty, quantity 1, unmarked', () => {
    expect(emptyItemLine()).toEqual({ name: '', quantity: 1, kind: null })
  })

  it('names up to 60 characters, quantities and lines up to 20', () => {
    expect(ITEM_NAME_MAX).toBe(60)
    expect(ITEM_QUANTITY_MAX).toBe(20)
    expect(ITEM_LINES_MAX).toBe(20)
  })

  it('uses the spec\'s sentences', () => {
    expect(ITEM_NAME_REQUIRED).toBe('Name the item, or remove the line.')
    expect(ITEM_NAME_TOO_LONG).toBe('Keep the item name to 60 characters.')
  })
})
