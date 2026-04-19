import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { useAuthStore } from '@/stores/state'
import { useSettingsStore } from '@/stores/settings'
import { workspaceActionsBlockedFromStores } from './useWorkspaceActionsBlocked'

describe('workspaceActionsBlockedFromStores', () => {
  let authSnapshot: ReturnType<typeof useAuthStore.getState>
  let settingsSnapshot: ReturnType<typeof useSettingsStore.getState>

  beforeEach(() => {
    authSnapshot = useAuthStore.getState()
    settingsSnapshot = useSettingsStore.getState()
  })

  afterEach(() => {
    useAuthStore.setState(authSnapshot)
    useSettingsStore.setState(settingsSnapshot)
  })

  test('guest is never blocked (default workspace on server)', () => {
    useAuthStore.setState({ isGuestMode: true, isAuthenticated: true })
    useSettingsStore.setState({ currentWorkspace: null })
    expect(workspaceActionsBlockedFromStores()).toBe(false)

    useSettingsStore.setState({ currentWorkspace: 'kb-a' })
    expect(workspaceActionsBlockedFromStores()).toBe(false)
  })

  test('signed-in non-guest with no KB selected is blocked', () => {
    useAuthStore.setState({ isGuestMode: false, isAuthenticated: true })
    useSettingsStore.setState({ currentWorkspace: null })
    expect(workspaceActionsBlockedFromStores()).toBe(true)
  })

  test('signed-in non-guest with KB selected is not blocked', () => {
    useAuthStore.setState({ isGuestMode: false, isAuthenticated: true })
    useSettingsStore.setState({ currentWorkspace: 'project-alpha' })
    expect(workspaceActionsBlockedFromStores()).toBe(false)
  })
})
