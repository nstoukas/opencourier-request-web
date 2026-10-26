import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { CustomerSaveNotice } from './CustomerSaveNotice'

describe('CustomerSaveNotice', () => {
  it('renders warning alert with clash sentence when code is "clash"', () => {
    const { container } = render(<CustomerSaveNotice code="clash" />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(
      'Order sent. The customer was not saved: another saved customer has this phone.',
    )
    expect(container.firstChild).not.toBeNull()
  })

  it('renders warning alert with invalid sentence when code is "invalid"', () => {
    render(<CustomerSaveNotice code="invalid" />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(
      'Order sent. The customer was not saved: the details were refused.',
    )
  })

  it('renders warning alert with failed sentence when code is "failed"', () => {
    render(<CustomerSaveNotice code="failed" />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(
      "Order sent. The customer was not saved: the co-op's server did not answer.",
    )
  })

  it('renders nothing for any other code value or when none is provided', () => {
    // Arbitrary strings
    const { container: c1 } = render(<CustomerSaveNotice code="saved" />)
    expect(c1).toBeEmptyDOMElement()

    const { container: c2 } = render(<CustomerSaveNotice code="none" />)
    expect(c2).toBeEmptyDOMElement()

    const { container: c3 } = render(<CustomerSaveNotice code="other" />)
    expect(c3).toBeEmptyDOMElement()

    const { container: c4 } = render(<CustomerSaveNotice code="" />)
    expect(c4).toBeEmptyDOMElement()

    // Non-string or null/undefined
    const { container: c5 } = render(<CustomerSaveNotice code={null} />)
    expect(c5).toBeEmptyDOMElement()

    const { container: c6 } = render(<CustomerSaveNotice code={undefined} />)
    expect(c6).toBeEmptyDOMElement()

    const { container: c7 } = render(<CustomerSaveNotice code={123} />)
    expect(c7).toBeEmptyDOMElement()

    const { container: c8 } = render(<CustomerSaveNotice code={['clash']} />)
    expect(c8).toBeEmptyDOMElement()
  })
})
