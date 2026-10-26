import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import {
  FieldGroup,
  Field,
  FieldLabel,
  FieldDescription,
} from './Field'
import { Input } from './Input'

describe('Field atoms (new-york-v4 labelled control)', () => {
  it('renders FieldGroup with slot attribute and vertical spacing gap-6', () => {
    render(
      <FieldGroup data-testid="field-group" className="custom-group">
        <div>Child field</div>
      </FieldGroup>
    )

    const group = screen.getByTestId('field-group')
    expect(group).toHaveAttribute('data-slot', 'field-group')
    expect(group).toHaveClass('flex', 'w-full', 'flex-col', 'gap-6', 'custom-group')
  })

  it('renders Field with role="group", data-slot="field", and vertical orientation by default', () => {
    render(
      <Field data-testid="default-field">
        <FieldLabel htmlFor="test-input">Test Label</FieldLabel>
        <Input id="test-input" />
      </Field>
    )

    const field = screen.getByTestId('default-field')
    expect(field).toHaveAttribute('role', 'group')
    expect(field).toHaveAttribute('data-slot', 'field')
    expect(field).toHaveAttribute('data-orientation', 'vertical')
    expect(field).toHaveClass('group/field', 'flex', 'w-full', 'gap-2', 'flex-col')
  })

  it('renders Field with horizontal orientation when specified', () => {
    render(
      <Field data-testid="horizontal-field" orientation="horizontal">
        <FieldLabel htmlFor="h-input">Inline Label</FieldLabel>
        <Input id="h-input" />
      </Field>
    )

    const field = screen.getByTestId('horizontal-field')
    expect(field).toHaveAttribute('data-orientation', 'horizontal')
    expect(field).toHaveClass('flex-row', 'items-center')
  })

  it('renders FieldLabel with slot and disabled group styling', () => {
    render(
      <Field data-disabled="true">
        <FieldLabel htmlFor="field-label-test">Email Address</FieldLabel>
        <Input id="field-label-test" disabled />
      </Field>
    )

    const label = screen.getByText('Email Address')
    expect(label).toHaveAttribute('data-slot', 'field-label')
    expect(label).toHaveClass('leading-snug')
    expect(label).toHaveAttribute('for', 'field-label-test')
  })

  it('renders FieldDescription with data-slot="field-description" and muted helper styling', () => {
    render(
      <Field>
        <FieldLabel htmlFor="pw">Password</FieldLabel>
        <Input id="pw" aria-describedby="pw-hint" />
        <FieldDescription id="pw-hint">Must be at least 8 characters.</FieldDescription>
      </Field>
    )

    const description = screen.getByText('Must be at least 8 characters.')
    expect(description).toHaveAttribute('data-slot', 'field-description')
    expect(description).toHaveAttribute('id', 'pw-hint')
    expect(description).toHaveClass('text-sm', 'font-normal', 'text-muted-foreground')
  })
})
