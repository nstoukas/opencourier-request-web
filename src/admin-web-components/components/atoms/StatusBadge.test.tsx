import React from 'react'
import fs from 'fs'
import path from 'path'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge (/src/admin-web-components/components/atoms/StatusBadge.tsx)', () => {
  // Read schema.prisma to ensure our test is locked to backend EnumDeliveryStatus
  const schemaPath = path.resolve(__dirname, '../../../../../opencourier-backend/prisma/schema.prisma')
  const schemaContent = fs.readFileSync(schemaPath, 'utf8')
  const enumMatch = schemaContent.match(/enum EnumDeliveryStatus\s*\{([^}]+)\}/)
  const prismaStatuses = enumMatch
    ? enumMatch[1]
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('//'))
    : []

  it('covers all EnumDeliveryStatus values from prisma schema', () => {
    expect(prismaStatuses.length).toBeGreaterThan(0)
    // Confirm the known 11 statuses
    expect(prismaStatuses).toEqual([
      'CREATED',
      'ASSIGNING_COURIER',
      'ACCEPTED',
      'DISPATCHED',
      'COURIER_ARRIVED_AT_PICKUP_LOCATION',
      'PICKED_UP',
      'ON_THE_WAY',
      'COURIER_ARRIVED_AT_DROPOFF_LOCATION',
      'DROPPED_OFF',
      'CANCELED',
      'FAILED',
    ])
  })

  describe('Delivery status mappings and variants', () => {
    const expectedMappings: Record<string, { label: string; variantClass: string }> = {
      CREATED: { label: 'Created', variantClass: 'bg-secondary' },
      ASSIGNING_COURIER: { label: 'Assigning Courier', variantClass: 'bg-secondary' },
      ACCEPTED: { label: 'Accepted', variantClass: 'bg-secondary' },
      DISPATCHED: { label: 'Dispatched', variantClass: 'bg-secondary' },
      COURIER_ARRIVED_AT_PICKUP_LOCATION: { label: 'Courier at Pickup', variantClass: 'bg-secondary' },
      PICKED_UP: { label: 'Picked Up', variantClass: 'bg-secondary' },
      ON_THE_WAY: { label: 'On the Way', variantClass: 'bg-secondary' },
      COURIER_ARRIVED_AT_DROPOFF_LOCATION: { label: 'Courier at Dropoff', variantClass: 'bg-secondary' },
      DROPPED_OFF: { label: 'Dropped Off', variantClass: 'bg-primary' },
      CANCELED: { label: 'Canceled', variantClass: 'bg-destructive' },
      FAILED: { label: 'Failed', variantClass: 'bg-destructive' },
    }

    prismaStatuses.forEach((status) => {
      it(`maps ${status} to "${expectedMappings[status]?.label}" with expected Badge variant`, () => {
        const expected = expectedMappings[status]
        expect(expected).toBeDefined()

        const { container } = render(<StatusBadge status={status} />)
        const badge = container.querySelector('[data-status]')
        expect(badge).toBeInTheDocument()
        expect(badge).toHaveAttribute('data-status', status)
        expect(badge).toHaveTextContent(expected.label)
        expect(badge).toHaveClass(expected.variantClass)
      })
    })

    it('DROPPED_OFF maps to default variant (bg-primary)', () => {
      const { container } = render(<StatusBadge status="DROPPED_OFF" />)
      const badge = container.querySelector('[data-status="DROPPED_OFF"]')
      expect(badge).toHaveClass('bg-primary')
      expect(badge).toHaveTextContent('Dropped Off')
    })

    it('CANCELED and FAILED map to destructive variant (bg-destructive)', () => {
      const { container: c1 } = render(<StatusBadge status="CANCELED" />)
      expect(c1.querySelector('[data-status="CANCELED"]')).toHaveClass('bg-destructive')
      expect(c1.querySelector('[data-status="CANCELED"]')).toHaveTextContent('Canceled')

      const { container: c2 } = render(<StatusBadge status="FAILED" />)
      expect(c2.querySelector('[data-status="FAILED"]')).toHaveClass('bg-destructive')
      expect(c2.querySelector('[data-status="FAILED"]')).toHaveTextContent('Failed')
    })
  })

  describe('Courier status mappings and variants (kind="courier")', () => {
    it('maps ONLINE to "Online" on success variant with green dot', () => {
      const { container } = render(<StatusBadge kind="courier" status="ONLINE" />)
      const badge = container.querySelector('[data-status="ONLINE"]')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent('Online')
      expect(badge).toHaveClass('bg-success-soft')

      const dot = container.querySelector('span[aria-hidden="true"]')
      expect(dot).toBeInTheDocument()
      expect(dot).toHaveClass('bg-success')
    })

    it('maps LAST_CALL to "Last Call" on warning variant with yellow dot', () => {
      const { container } = render(<StatusBadge kind="courier" status="LAST_CALL" />)
      const badge = container.querySelector('[data-status="LAST_CALL"]')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent('Last Call')
      expect(badge).toHaveClass('bg-warning-soft')

      const dot = container.querySelector('span[aria-hidden="true"]')
      expect(dot).toBeInTheDocument()
      expect(dot).toHaveClass('bg-warning')
    })

    it('maps OFFLINE to "Offline" on outline variant with red dot', () => {
      const { container } = render(<StatusBadge kind="courier" status="OFFLINE" />)
      const badge = container.querySelector('[data-status="OFFLINE"]')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent('Offline')
      expect(badge).toHaveClass('text-foreground')

      const dot = container.querySelector('span[aria-hidden="true"]')
      expect(dot).toBeInTheDocument()
      expect(dot).toHaveClass('bg-destructive')
    })
  })

  describe('Unknown status fallback', () => {
    it('falls back to sentence case words on secondary variant for unknown delivery status', () => {
      const { container } = render(<StatusBadge status="CUSTOM_PROCESSING_STEP" />)
      const badge = container.querySelector('[data-status="CUSTOM_PROCESSING_STEP"]')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent('Custom processing step')
      expect(badge).toHaveClass('bg-secondary')
    })

    it('handles single-word unknown status correctly', () => {
      const { container } = render(<StatusBadge status="UNKNOWN" />)
      const badge = container.querySelector('[data-status="UNKNOWN"]')
      expect(badge).toHaveTextContent('Unknown')
      expect(badge).toHaveClass('bg-secondary')
    })
  })

  describe('Static table exports', () => {
    it('exports deliveryStatuses and courierStatuses matching README specification', () => {
      expect(StatusBadge.deliveryStatuses).toBeDefined()
      expect(StatusBadge.deliveryStatuses['DROPPED_OFF'].variant).toBe('default')
      expect(StatusBadge.deliveryStatuses['CANCELED'].variant).toBe('destructive')
      expect(StatusBadge.deliveryStatuses['FAILED'].variant).toBe('destructive')
      expect(StatusBadge.deliveryStatuses['ACCEPTED'].variant).toBe('secondary')

      expect(StatusBadge.courierStatuses).toBeDefined()
      expect(StatusBadge.courierStatuses['ONLINE'].variant).toBe('success')
      expect(StatusBadge.courierStatuses['LAST_CALL'].variant).toBe('warning')
      expect(StatusBadge.courierStatuses['OFFLINE'].variant).toBe('outline')
    })
  })
})
