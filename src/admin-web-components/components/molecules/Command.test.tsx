import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { Command, CommandList, CommandItem } from './Command'

describe('CommandItem (Command.tsx)', () => {
  it('uses data-[disabled=true]: for pointer-events-none and opacity-50, never bare data-[disabled]:', () => {
    render(
      <Command>
        <CommandList>
          <CommandItem>Test Item</CommandItem>
        </CommandList>
      </Command>,
    )

    const item = screen.getByText('Test Item')

    // cmdk 1.x writes data-disabled="false" on enabled items (premise for data-[disabled=true]: styling)
    expect(item).toHaveAttribute('data-disabled', 'false')

    // Must match data-[disabled=true]: variant so cmdk 1.x data-disabled="false" does not block clicks
    expect(item.className).toContain('data-[disabled=true]:pointer-events-none')
    expect(item.className).toContain('data-[disabled=true]:opacity-50')

    // Must NOT contain bare data-[disabled]:
    expect(item.className).not.toContain('data-[disabled]:pointer-events-none')
    expect(item.className).not.toContain('data-[disabled]:opacity-50')
  })
})
