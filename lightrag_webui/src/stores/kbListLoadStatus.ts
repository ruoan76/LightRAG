import { create } from 'zustand'

export type KbListLoadStatus = 'idle' | 'loading' | 'ok' | 'error'

type KbListLoadState = {
  status: KbListLoadStatus
  errorMessage: string | null
  setKbListLoad: (patch: Partial<Pick<KbListLoadState, 'status' | 'errorMessage'>>) => void
}

/**
 * Runtime-only: whether /admin/me/kbs has finished loading (used for workspace UI, not persisted).
 */
export const useKbListLoadStore = create<KbListLoadState>((set) => ({
  status: 'idle',
  errorMessage: null,
  setKbListLoad: (patch) => set((s) => ({ ...s, ...patch }))
}))
