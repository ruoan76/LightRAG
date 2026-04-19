import { useAuthStore } from '@/stores/state'
import { useSettingsStore } from '@/stores/settings'

/**
 * True when the user is signed in (non-guest) but has not selected a knowledge base.
 * Guest mode does not block actions that rely on the server default workspace.
 */
export function useWorkspaceActionsBlocked(): boolean {
  // useAuthStore is not wrapped with createSelectors (unlike useSettingsStore), so use a plain selector
  const isGuestMode = useAuthStore(s => s.isGuestMode)
  const currentWorkspace = useSettingsStore.use.currentWorkspace()
  return !isGuestMode && !currentWorkspace
}

/**
 * Same condition as {@link useWorkspaceActionsBlocked} for use inside async handlers / effects
 * where hooks cannot be called (reads latest auth + workspace from stores).
 */
export function workspaceActionsBlockedFromStores(): boolean {
  return (
    !useAuthStore.getState().isGuestMode && !useSettingsStore.getState().currentWorkspace
  )
}
