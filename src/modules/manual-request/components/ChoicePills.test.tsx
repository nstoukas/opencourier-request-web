import React, { useRef } from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChoicePills, ChoicePillsHandle } from './ChoicePills'

describe('ChoicePills (spec 0006, AC-6, AC-7, AC-13)', () => {
  const options = [
    { value: '0', label: 'Now' },
    { value: '10', label: '10 min' },
    { value: '15', label: '15 min' },
  ]

  it('renders radio group with options and label', () => {
    render(<ChoicePills label="Ready in" options={options} value="" onValueChange={jest.fn()} />)

    expect(screen.getByText('Ready in')).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(radios[0]).toHaveTextContent('Now')
    expect(radios[1]).toHaveTextContent('10 min')
    expect(radios[2]).toHaveTextContent('15 min')
  })

  it('marks selected pill as checked', () => {
    render(<ChoicePills label="Ready in" options={options} value="10" onValueChange={jest.fn()} />)

    const checked = screen.getByRole('radio', { name: '10 min' })
    expect(checked).toHaveAttribute('data-state', 'checked')
    expect(checked).toHaveAttribute('aria-checked', 'true')

    const unchecked = screen.getByRole('radio', { name: 'Now' })
    expect(unchecked).toHaveAttribute('data-state', 'unchecked')
    expect(unchecked).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onValueChange when an option is clicked', () => {
    const onValueChange = jest.fn()
    render(<ChoicePills label="Ready in" options={options} value="" onValueChange={onValueChange} />)

    fireEvent.click(screen.getByRole('radio', { name: '15 min' }))
    expect(onValueChange).toHaveBeenCalledWith('15')
  })

  it('imperative handle focus() focuses the chosen pill, or the first pill if none chosen (AC-13)', () => {
    function TestComponent({ value }: { value: string }) {
      const pillsRef = useRef<ChoicePillsHandle>(null)
      return (
        <div>
          <ChoicePills ref={pillsRef} label="Ready in" options={options} value={value} onValueChange={jest.fn()} />
          <button type="button" onClick={() => pillsRef.current?.focus()}>
            Focus Pills
          </button>
        </div>
      )
    }

    // 1. None chosen: focuses the first pill
    const { rerender } = render(<TestComponent value="" />)
    fireEvent.click(screen.getByRole('button', { name: 'Focus Pills' }))
    expect(screen.getByRole('radio', { name: 'Now' })).toHaveFocus()

    // 2. Value selected: focuses the chosen pill
    rerender(<TestComponent value="10" />)
    fireEvent.click(screen.getByRole('button', { name: 'Focus Pills' }))
    expect(screen.getByRole('radio', { name: '10 min' })).toHaveFocus()
  })
})
