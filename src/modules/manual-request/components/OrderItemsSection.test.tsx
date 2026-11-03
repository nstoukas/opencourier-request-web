import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { Form } from '../../../admin-web-components'
import { OrderItemsSection } from './OrderItemsSection'
import type { CreateDeliveryFormValues } from './CreateDeliveryForm'
import type { OrderItemLine } from '../utils/orderItems'

// Spec 0028 (row 103), AC-2: the order form's optional Items section, rendered in a bare form so each
// test reads the lines straight out of react-hook-form.
let formRef: UseFormReturn<CreateDeliveryFormValues> | null = null

function Harness({ items = [] }: { items?: OrderItemLine[] }) {
  const form = useForm<CreateDeliveryFormValues>({
    defaultValues: { items } as unknown as CreateDeliveryFormValues,
  })
  formRef = form
  return (
    <Form {...form}>
      <OrderItemsSection form={form} />
    </Form>
  )
}

const lines = () => formRef!.getValues('items') as OrderItemLine[]

const openSection = () => fireEvent.click(screen.getByRole('button', { name: 'Add items (optional)' }))

describe('OrderItemsSection (spec 0028 AC-2)', () => {
  beforeEach(() => {
    formRef = null
  })

  describe('collapsed by default', () => {
    it('shows only "Add items (optional)" and no item field', () => {
      render(<Harness />)

      expect(screen.getByRole('button', { name: 'Add items (optional)' })).toBeInTheDocument()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Drink' })).not.toBeInTheDocument()
      expect(screen.queryByText('Items')).not.toBeInTheDocument()
      expect(lines()).toEqual([])
    })

    it('the "Add items (optional)" control is 48 px high (h-12)', () => {
      render(<Harness />)
      expect(screen.getByRole('button', { name: 'Add items (optional)' })).toHaveClass('h-12')
    })

    it('opens with exactly one empty line (quantity 1, unmarked)', () => {
      render(<Harness />)
      openSection()

      expect(screen.queryByRole('button', { name: 'Add items (optional)' })).not.toBeInTheDocument()
      expect(screen.getAllByRole('textbox', { name: /Item \d+ name/ })).toHaveLength(1)
      expect(screen.getByRole('textbox', { name: 'Item 1 name' })).toHaveValue('')
      expect(lines()).toEqual([{ name: '', quantity: 1, kind: null }])
      expect(screen.getByRole('button', { name: 'Drink' })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('button', { name: 'Side' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('starts open when the form already has lines', () => {
      render(<Harness items={[{ name: 'Cola', quantity: 2, kind: 'DRINK' }]} />)

      expect(screen.getByRole('textbox', { name: 'Item 1 name' })).toHaveValue('Cola')
      expect(screen.queryByRole('button', { name: 'Add items (optional)' })).not.toBeInTheDocument()
    })
  })

  describe('Drink and Side toggles', () => {
    it('are two aria-pressed buttons in a group, not radios', () => {
      render(<Harness />)
      openSection()

      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
      const drink = screen.getByRole('button', { name: 'Drink' })
      const side = screen.getByRole('button', { name: 'Side' })
      expect(drink).toHaveAttribute('aria-pressed')
      expect(side).toHaveAttribute('aria-pressed')
      expect(drink).toHaveClass('h-12')
      expect(side).toHaveClass('h-12')
    })

    it('a tap marks the line', () => {
      render(<Harness />)
      openSection()

      fireEvent.click(screen.getByRole('button', { name: 'Drink' }))

      expect(screen.getByRole('button', { name: 'Drink' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Side' })).toHaveAttribute('aria-pressed', 'false')
      expect(lines()[0].kind).toBe('DRINK')
    })

    it('a tap on the marked Drink clears it', () => {
      render(<Harness />)
      openSection()

      fireEvent.click(screen.getByRole('button', { name: 'Drink' }))
      fireEvent.click(screen.getByRole('button', { name: 'Drink' }))

      expect(screen.getByRole('button', { name: 'Drink' })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('button', { name: 'Side' })).toHaveAttribute('aria-pressed', 'false')
      expect(lines()[0].kind).toBeNull()
    })

    it('a tap on the marked Side clears it', () => {
      render(<Harness />)
      openSection()

      fireEvent.click(screen.getByRole('button', { name: 'Side' }))
      expect(lines()[0].kind).toBe('SIDE')
      fireEvent.click(screen.getByRole('button', { name: 'Side' }))

      expect(screen.getByRole('button', { name: 'Side' })).toHaveAttribute('aria-pressed', 'false')
      expect(lines()[0].kind).toBeNull()
    })

    it('a tap on the other pill switches the mark', () => {
      render(<Harness />)
      openSection()

      fireEvent.click(screen.getByRole('button', { name: 'Drink' }))
      fireEvent.click(screen.getByRole('button', { name: 'Side' }))

      expect(screen.getByRole('button', { name: 'Side' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Drink' })).toHaveAttribute('aria-pressed', 'false')
      expect(lines()[0].kind).toBe('SIDE')

      fireEvent.click(screen.getByRole('button', { name: 'Drink' }))
      expect(lines()[0].kind).toBe('DRINK')
    })

    it('marks only its own line', () => {
      render(<Harness />)
      openSection()
      fireEvent.click(screen.getByRole('button', { name: 'Add another item' }))

      const second = screen.getByTestId('item-line-1')
      fireEvent.click(within(second).getByRole('button', { name: 'Side' }))

      expect(lines().map((line) => line.kind)).toEqual([null, 'SIDE'])
      const first = screen.getByTestId('item-line-0')
      expect(within(first).getByRole('button', { name: 'Side' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('the group is labelled "Kind of {name}", or "Kind of item N" before a name is typed', () => {
      render(<Harness items={[{ name: '  Cola  ', quantity: 1, kind: null }, { name: '', quantity: 1, kind: null }]} />)

      expect(screen.getByRole('group', { name: 'Kind of Cola' })).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Kind of item 2' })).toBeInTheDocument()
    })

    it('the group label follows a name typed into the line', () => {
      render(<Harness />)
      openSection()

      fireEvent.change(screen.getByRole('textbox', { name: 'Item 1 name' }), { target: { value: 'Fries' } })

      expect(screen.getByRole('group', { name: 'Kind of Fries' })).toBeInTheDocument()
    })
  })

  describe('the quantity stepper', () => {
    it('starts at 1 with "One less" disabled', () => {
      render(<Harness />)
      openSection()

      const group = screen.getByRole('group', { name: 'Quantity of item 1' })
      expect(within(group).getByText('1')).toBeInTheDocument()
      expect(within(group).getByRole('button', { name: 'One less' })).toBeDisabled()
      expect(within(group).getByRole('button', { name: 'One more' })).toBeEnabled()
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    })

    it('goes up and down by one', () => {
      render(<Harness />)
      openSection()
      const group = screen.getByRole('group', { name: 'Quantity of item 1' })

      fireEvent.click(within(group).getByRole('button', { name: 'One more' }))
      fireEvent.click(within(group).getByRole('button', { name: 'One more' }))
      expect(lines()[0].quantity).toBe(3)
      expect(within(group).getByText('3')).toBeInTheDocument()

      fireEvent.click(within(group).getByRole('button', { name: 'One less' }))
      expect(lines()[0].quantity).toBe(2)
    })

    it('stops at 20, with "One more" disabled there', () => {
      render(<Harness />)
      openSection()
      const group = screen.getByRole('group', { name: 'Quantity of item 1' })
      const more = within(group).getByRole('button', { name: 'One more' })

      for (let i = 0; i < 25; i++) fireEvent.click(more)

      expect(lines()[0].quantity).toBe(20)
      expect(more).toBeDisabled()
      expect(within(group).getByRole('button', { name: 'One less' })).toBeEnabled()
    })

    it('never goes below 1', () => {
      render(<Harness items={[{ name: 'Cola', quantity: 2, kind: null }]} />)
      const group = screen.getByRole('group', { name: 'Quantity of item 1' })
      const less = within(group).getByRole('button', { name: 'One less' })

      fireEvent.click(less)
      fireEvent.click(less)
      fireEvent.click(less)

      expect(lines()[0].quantity).toBe(1)
      expect(less).toBeDisabled()
    })
  })

  describe('adding and removing lines', () => {
    it('adds lines up to 20, then "Add another item" is gone', () => {
      render(<Harness />)
      openSection()

      for (let i = 1; i < 20; i++) {
        fireEvent.click(screen.getByRole('button', { name: 'Add another item' }))
      }

      expect(lines()).toHaveLength(20)
      expect(screen.getAllByRole('textbox', { name: /Item \d+ name/ })).toHaveLength(20)
      expect(screen.queryByRole('button', { name: 'Add another item' })).not.toBeInTheDocument()
    })

    it('shows "Add another item" at 19 lines', () => {
      render(
        <Harness items={Array.from({ length: 19 }, (_, i) => ({ name: `Item ${i}`, quantity: 1, kind: null }))} />,
      )
      expect(screen.getByRole('button', { name: 'Add another item' })).toBeInTheDocument()
    })

    it("a line's × removes that line and keeps the others in order", () => {
      render(
        <Harness
          items={[
            { name: 'Souvlaki', quantity: 2, kind: null },
            { name: 'Cola', quantity: 1, kind: 'DRINK' },
            { name: 'Fries', quantity: 1, kind: 'SIDE' },
          ]}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Remove item 2' }))

      expect(lines()).toEqual([
        { name: 'Souvlaki', quantity: 2, kind: null },
        { name: 'Fries', quantity: 1, kind: 'SIDE' },
      ])
      expect(screen.getByRole('textbox', { name: 'Item 2 name' })).toHaveValue('Fries')
      expect(screen.getByRole('button', { name: 'Add another item' })).toBeInTheDocument()
    })

    it('removing the 20th line brings "Add another item" back', () => {
      render(
        <Harness items={Array.from({ length: 20 }, (_, i) => ({ name: `Item ${i}`, quantity: 1, kind: null }))} />,
      )
      expect(screen.queryByRole('button', { name: 'Add another item' })).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Remove item 20' }))

      expect(lines()).toHaveLength(19)
      expect(screen.getByRole('button', { name: 'Add another item' })).toBeInTheDocument()
    })

    it('typing a name writes it to the line', () => {
      render(<Harness />)
      openSection()

      fireEvent.change(screen.getByRole('textbox', { name: 'Item 1 name' }), { target: { value: 'Cola' } })

      expect(lines()[0].name).toBe('Cola')
    })
  })
})
