import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { DetailList } from './DetailList'

describe('DetailList (/src/admin-web-components/components/atoms/DetailList.tsx)', () => {
  it('renders label and value pairs', () => {
    render(
      <DetailList
        items={[
          { label: 'Customer', value: 'Nikou Kitchen' },
          { label: 'Phone', value: '+30 24210 12345' },
        ]}
      />
    )

    expect(screen.getByText('Customer')).toBeInTheDocument()
    expect(screen.getByText('Nikou Kitchen')).toBeInTheDocument()
    expect(screen.getByText('Phone')).toBeInTheDocument()
    expect(screen.getByText('+30 24210 12345')).toBeInTheDocument()
  })

  it('renders an em dash (—) for empty values (null, undefined, or empty string)', () => {
    const { container } = render(
      <DetailList
        items={[
          { label: 'Nullable', value: null },
          { label: 'Undefined', value: undefined },
          { label: 'EmptyString', value: '' },
        ]}
      />
    )

    const dds = container.querySelectorAll('dd')
    expect(dds).toHaveLength(3)
    dds.forEach((dd) => {
      expect(dd.textContent).toBe('—')
      expect(dd).toHaveClass('text-muted-foreground')
    })
  })

  it('applies font-mono class when mono is true, and omits it otherwise', () => {
    const { container } = render(
      <DetailList
        items={[
          { label: 'Courier ID', value: 'c-uuid-1234', mono: true },
          { label: 'Standard Text', value: 'Regular Value' },
        ]}
      />
    )

    const dds = container.querySelectorAll('dd')
    expect(dds[0]).toHaveClass('font-mono')
    expect(dds[0].textContent).toBe('c-uuid-1234')

    expect(dds[1]).not.toHaveClass('font-mono')
    expect(dds[1].textContent).toBe('Regular Value')
  })
})
