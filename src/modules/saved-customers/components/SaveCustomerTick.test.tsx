import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SaveCustomerTick } from './SaveCustomerTick'
import { retentionHelperText, useRetentionMonths } from '../hooks/useRetentionMonths'
import { fetchRetentionMonths } from '../../../api/savedCustomersApi'

jest.mock('../../../api/savedCustomersApi', () => ({
  fetchRetentionMonths: jest.fn(),
}))

describe('SaveCustomerTick and useRetentionMonths', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  describe('retentionHelperText helper', () => {
    it('returns fallback sentence when months is null', () => {
      expect(retentionHelperText(null)).toBe(
        'Only your restaurant sees it. It is deleted after a period unused that the co-op sets.',
      )
    })

    it('returns singular month sentence when months is 1', () => {
      expect(retentionHelperText(1)).toBe(
        'Only your restaurant sees it. It is deleted after 1 month unused.',
      )
    })

    it('returns plural months sentence when months is greater than 1', () => {
      expect(retentionHelperText(12)).toBe(
        'Only your restaurant sees it. It is deleted after 12 months unused.',
      )
      expect(retentionHelperText(24)).toBe(
        'Only your restaurant sees it. It is deleted after 24 months unused.',
      )
    })
  })

  describe('SaveCustomerTick component', () => {
    it('renders checkbox, label, and live N months helper text', async () => {
      ;(fetchRetentionMonths as jest.Mock).mockResolvedValue(12)
      const onCheckedChange = jest.fn()

      render(<SaveCustomerTick checked={false} onCheckedChange={onCheckedChange} />)

      const checkbox = screen.getByRole('checkbox', {
        name: /Save this customer for next time \(they agreed\)/i,
      })
      expect(checkbox).not.toBeChecked()

      // Awaits hook resolving retention months
      await waitFor(() => {
        expect(
          screen.getByText('Only your restaurant sees it. It is deleted after 12 months unused.'),
        ).toBeInTheDocument()
      })

      // Checkbox is linked via aria-describedby to helper text
      const helperId = checkbox.getAttribute('aria-describedby')
      expect(helperId).toBeTruthy()
      expect(document.getElementById(helperId!)).toHaveTextContent(
        'Only your restaurant sees it. It is deleted after 12 months unused.',
      )

      // Toggle checkbox
      fireEvent.click(checkbox)
      expect(onCheckedChange).toHaveBeenCalledWith(true)
    })

    it('renders fallback sentence when retention months is unknown or fetch fails', async () => {
      ;(fetchRetentionMonths as jest.Mock).mockResolvedValue(null)
      const onCheckedChange = jest.fn()

      render(<SaveCustomerTick checked={true} onCheckedChange={onCheckedChange} />)

      const checkbox = screen.getByRole('checkbox', {
        name: /Save this customer for next time \(they agreed\)/i,
      })
      expect(checkbox).toBeChecked()

      await waitFor(() => {
        expect(
          screen.getByText(
            'Only your restaurant sees it. It is deleted after a period unused that the co-op sets.',
          ),
        ).toBeInTheDocument()
      })

      fireEvent.click(checkbox)
      expect(onCheckedChange).toHaveBeenCalledWith(false)
    })
  })
})
