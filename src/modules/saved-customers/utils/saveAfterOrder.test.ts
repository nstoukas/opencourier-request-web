import { saveCustomerAfterOrder } from './saveAfterOrder'
import {
  saveCustomerFromOrder,
  updateSavedCustomer,
  markSavedCustomerUsed,
} from '../../../api/savedCustomersApi'
import type { SavedCustomerFields } from '../types'

jest.mock('../../../api/savedCustomersApi', () => ({
  saveCustomerFromOrder: jest.fn(),
  updateSavedCustomer: jest.fn(),
  markSavedCustomerUsed: jest.fn(),
}))

describe('saveCustomerAfterOrder (order flow step 2)', () => {
  const mockFields: SavedCustomerFields = {
    name: 'Giannis Antetokounmpo',
    phone: '+306911223344',
    notes: 'Call on arrival',
    addressLine1: 'Dimitriadis 10',
    addressLine2: 'Floor 1',
    city: 'Volos',
    zipCode: '38221',
    latitude: 39.36,
    longitude: 22.95,
    formattedAddress: 'Dimitriadis 10, Volos',
  }

  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('typed customer + tick on saves from order and returns "saved"', async () => {
    ;(saveCustomerFromOrder as jest.Mock).mockResolvedValue({ id: 'new-cust', ...mockFields })

    const outcome = await saveCustomerAfterOrder({
      fields: mockFields,
      linkedCustomerId: null,
      saveTicked: true,
    })

    expect(outcome).toBe('saved')
    expect(saveCustomerFromOrder).toHaveBeenCalledTimes(1)
    expect(saveCustomerFromOrder).toHaveBeenCalledWith(mockFields)
    expect(updateSavedCustomer).not.toHaveBeenCalled()
    expect(markSavedCustomerUsed).not.toHaveBeenCalled()
  })

  it('picked customer + tick on PATCHes by id with markUsed and returns "saved"', async () => {
    ;(updateSavedCustomer as jest.Mock).mockResolvedValue({ id: 'picked-cust', ...mockFields })

    const outcome = await saveCustomerAfterOrder({
      fields: mockFields,
      linkedCustomerId: 'picked-cust',
      saveTicked: true,
    })

    expect(outcome).toBe('saved')
    expect(updateSavedCustomer).toHaveBeenCalledTimes(1)
    expect(updateSavedCustomer).toHaveBeenCalledWith('picked-cust', mockFields, { markUsed: true })
    expect(saveCustomerFromOrder).not.toHaveBeenCalled()
    expect(markSavedCustomerUsed).not.toHaveBeenCalled()
  })

  it('picked customer + tick on falls back to saving as new on 404', async () => {
    const error404 = Object.assign(new Error('Customer not found'), { statusCode: 404 })
    ;(updateSavedCustomer as jest.Mock).mockRejectedValue(error404)
    ;(saveCustomerFromOrder as jest.Mock).mockResolvedValue({ id: 'recreated-cust', ...mockFields })

    const outcome = await saveCustomerAfterOrder({
      fields: mockFields,
      linkedCustomerId: 'deleted-meanwhile-cust',
      saveTicked: true,
    })

    expect(outcome).toBe('saved')
    expect(updateSavedCustomer).toHaveBeenCalledWith('deleted-meanwhile-cust', mockFields, { markUsed: true })
    expect(saveCustomerFromOrder).toHaveBeenCalledWith(mockFields)
  })

  it('picked customer + tick off only marks customer used and returns "none"', async () => {
    ;(markSavedCustomerUsed as jest.Mock).mockResolvedValue(undefined)

    const outcome = await saveCustomerAfterOrder({
      fields: mockFields,
      linkedCustomerId: 'picked-cust-123',
      saveTicked: false,
    })

    expect(outcome).toBe('none')
    expect(markSavedCustomerUsed).toHaveBeenCalledWith('picked-cust-123')
    expect(saveCustomerFromOrder).not.toHaveBeenCalled()
    expect(updateSavedCustomer).not.toHaveBeenCalled()
  })

  it('picked customer + tick off shows nothing ("none") even if markUsed fails', async () => {
    ;(markSavedCustomerUsed as jest.Mock).mockRejectedValue(new Error('Backend down'))

    const outcome = await saveCustomerAfterOrder({
      fields: mockFields,
      linkedCustomerId: 'picked-cust-123',
      saveTicked: false,
    })

    expect(outcome).toBe('none')
    expect(markSavedCustomerUsed).toHaveBeenCalledWith('picked-cust-123')
  })

  it('typed customer + tick off does nothing and returns "none"', async () => {
    const outcome = await saveCustomerAfterOrder({
      fields: mockFields,
      linkedCustomerId: null,
      saveTicked: false,
    })

    expect(outcome).toBe('none')
    expect(saveCustomerFromOrder).not.toHaveBeenCalled()
    expect(updateSavedCustomer).not.toHaveBeenCalled()
    expect(markSavedCustomerUsed).not.toHaveBeenCalled()
  })

  it('returns "clash" on a 409 error', async () => {
    const error409 = Object.assign(new Error('Clash'), { statusCode: 409 })
    ;(saveCustomerFromOrder as jest.Mock).mockRejectedValue(error409)

    const outcome = await saveCustomerAfterOrder({
      fields: mockFields,
      linkedCustomerId: null,
      saveTicked: true,
    })

    expect(outcome).toBe('clash')
  })

  it('returns "invalid" on a 422 error', async () => {
    const error422 = Object.assign(new Error('Invalid phone'), { statusCode: 422 })
    ;(saveCustomerFromOrder as jest.Mock).mockRejectedValue(error422)

    const outcome = await saveCustomerAfterOrder({
      fields: mockFields,
      linkedCustomerId: null,
      saveTicked: true,
    })

    expect(outcome).toBe('invalid')
  })

  it('returns "failed" on any other error status or network error and never throws', async () => {
    // 500 error
    const error500 = Object.assign(new Error('Internal server error'), { statusCode: 500 })
    ;(saveCustomerFromOrder as jest.Mock).mockRejectedValue(error500)

    let outcome = await saveCustomerAfterOrder({
      fields: mockFields,
      linkedCustomerId: null,
      saveTicked: true,
    })
    expect(outcome).toBe('failed')

    // Network error without statusCode
    ;(saveCustomerFromOrder as jest.Mock).mockRejectedValue(new Error('Failed to fetch'))
    outcome = await saveCustomerAfterOrder({
      fields: mockFields,
      linkedCustomerId: null,
      saveTicked: true,
    })
    expect(outcome).toBe('failed')

    // Thrown non-error primitive
    ;(saveCustomerFromOrder as jest.Mock).mockRejectedValue('something weird')
    outcome = await saveCustomerAfterOrder({
      fields: mockFields,
      linkedCustomerId: null,
      saveTicked: true,
    })
    expect(outcome).toBe('failed')
  })
})
