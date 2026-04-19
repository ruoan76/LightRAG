import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { useAuthStore } from '@/stores/state'
import { useSettingsStore } from '@/stores/settings'
import { useKbListLoadStore } from '@/stores/kbListLoadStatus'
import {
  useWorkspaceActionsBlocked,
  workspaceActionsBlockedFromStores
} from '@/hooks/useWorkspaceActionsBlocked'

/** For tests and non-React call sites; mirrors {@link useWorkspaceSelectKbPrompt}. */
export function workspaceSelectKbPromptFromStores(): boolean {
  return (
    !useAuthStore.getState().isGuestMode &&
    !useSettingsStore.getState().currentWorkspace &&
    useKbListLoadStore.getState().status === 'ok'
  )
}

/** For tests and non-React call sites; mirrors {@link useKbListStillResolving}. */
export function kbListStillResolvingFromStores(): boolean {
  if (useAuthStore.getState().isGuestMode) return false
  if (useSettingsStore.getState().currentWorkspace) return false
  const kbStatus = useKbListLoadStore.getState().status
  return kbStatus === 'idle' || kbStatus === 'loading'
}

/**
 * True when the user should see the “select a knowledge base” messaging (list has loaded and none is selected).
 * Not true while the KB list is still loading — use {@link useKbListStillResolving} for that.
 */
export function useWorkspaceSelectKbPrompt(): boolean {
  const isGuestMode = useAuthStore((s) => s.isGuestMode)
  const currentWorkspace = useSettingsStore.use.currentWorkspace()
  const kbStatus = useKbListLoadStore((s) => s.status)
  return !isGuestMode && !currentWorkspace && kbStatus === 'ok'
}

/**
 * Signed-in user with no workspace yet while /admin/me/kbs has not finished (initial idle or loading).
 */
export function useKbListStillResolving(): boolean {
  const isGuestMode = useAuthStore((s) => s.isGuestMode)
  const currentWorkspace = useSettingsStore.use.currentWorkspace()
  const kbStatus = useKbListLoadStore((s) => s.status)
  if (isGuestMode || currentWorkspace) return false
  return kbStatus === 'idle' || kbStatus === 'loading'
}

/**
 * When workspace actions are blocked (signed-in, no KB), returns the appropriate toast/tooltip/title
 * string: KB list still loading vs “select a KB first”. Returns null when not blocked.
 */
export function useWorkspaceBlockedHint(): string | null {
  const { t } = useTranslation()
  const blocked = useWorkspaceActionsBlocked()
  const resolving = useKbListStillResolving()
  if (!blocked) return null
  return resolving ? t('workspace.loadingKbList') : t('workspace.selectKbFirst')
}

/** Same message as {@link useWorkspaceBlockedHint} for handlers / non-React code using `i18n.t`. */
export function workspaceBlockedHintFromStores(): string | null {
  if (!workspaceActionsBlockedFromStores()) return null
  return kbListStillResolvingFromStores()
    ? i18n.t('workspace.loadingKbList')
    : i18n.t('workspace.selectKbFirst')
}
