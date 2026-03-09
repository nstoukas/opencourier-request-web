import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type SetStateAction<T> = Partial<T> | ((state: T) => Partial<T>)

type StoreHook<T> = {
  (): T
  setState: (action: SetStateAction<T>) => void
  getState: () => T
}

export function create<T>(initializer: () => T): StoreHook<T> {
  let state = initializer()

  const getState = () => state

  const setState = (action: SetStateAction<T>) => {
    const patch = typeof action === 'function' ? action(state) : action
    state = { ...state, ...patch }
  }

  const useStore = (() => getState()) as StoreHook<T>

  useStore.setState = setState
  useStore.getState = getState

  return useStore
}

type UseCurrencyInputArgs = {
  value: number
  onValueChange: (value: number) => void
  max?: number
}

export function useCurrencyInput({ value, onValueChange, max = Number.MAX_SAFE_INTEGER }: UseCurrencyInputArgs) {
  const formattedValue = Number.isFinite(value)
    ? (value / 100).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : ''

  const handleKeyDown = (event: any) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      onValueChange(Math.max(0, Math.floor(value / 10)))
      return
    }

    if (!/^[0-9]$/.test(event.key)) {
      if (['Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      return
    }

    event.preventDefault()
    const digit = Number(event.key)
    const nextValue = Math.min(max, value * 10 + digit)
    onValueChange(nextValue)
  }

  return { formattedValue, handleKeyDown }
}
