/**
 * Zustand stores read localStorage at module load; Vitest defaults to `node` without DOM.
 */
import { beforeEach } from 'vitest'
import { useKbListLoadStore } from './src/stores/kbListLoadStatus'

const memory = new Map<string, string>()

beforeEach(() => {
  useKbListLoadStore.setState({ status: 'idle', errorMessage: null })
})

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      get length() {
        return memory.size
      },
      clear() {
        memory.clear()
      },
      getItem(key: string) {
        return memory.has(key) ? memory.get(key)! : null
      },
      key(index: number) {
        return [...memory.keys()][index] ?? null
      },
      removeItem(key: string) {
        memory.delete(key)
      },
      setItem(key: string, value: string) {
        memory.set(key, value)
      }
    },
    configurable: true
  })
}
