import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import i18n from '@/i18n'
import { useAuthStore } from '@/stores/state'
import { useSettingsStore } from '@/stores/settings'
import { useKbListLoadStore } from '@/stores/kbListLoadStatus'
import {
  kbListStillResolvingFromStores,
  workspaceBlockedHintFromStores,
  workspaceSelectKbPromptFromStores
} from './useWorkspaceKbUi'

describe('workspace KB list UI helpers', () => {
  let authSnapshot: ReturnType<typeof useAuthStore.getState>
  let settingsSnapshot: ReturnType<typeof useSettingsStore.getState>
  let kbSnapshot: ReturnType<typeof useKbListLoadStore.getState>

  beforeEach(() => {
    authSnapshot = useAuthStore.getState()
    settingsSnapshot = useSettingsStore.getState()
    kbSnapshot = useKbListLoadStore.getState()
  })

  afterEach(() => {
    useAuthStore.setState(authSnapshot)
    useSettingsStore.setState(settingsSnapshot)
    useKbListLoadStore.setState(kbSnapshot)
  })

  test('select-KB prompt only after list load OK with no workspace', () => {
    useAuthStore.setState({ isGuestMode: false, isAuthenticated: true })
    useSettingsStore.setState({ currentWorkspace: null })
    useKbListLoadStore.setState({ status: 'loading', errorMessage: null })
    expect(workspaceSelectKbPromptFromStores()).toBe(false)

    useKbListLoadStore.setState({ status: 'ok', errorMessage: null })
    expect(workspaceSelectKbPromptFromStores()).toBe(true)

    useSettingsStore.setState({ currentWorkspace: 'kb-a' })
    expect(workspaceSelectKbPromptFromStores()).toBe(false)
  })

  test('KB list resolving while signed in with no workspace (idle or loading)', () => {
    useAuthStore.setState({ isGuestMode: false, isAuthenticated: true })
    useSettingsStore.setState({ currentWorkspace: null })
    useKbListLoadStore.setState({ status: 'idle', errorMessage: null })
    expect(kbListStillResolvingFromStores()).toBe(true)

    useKbListLoadStore.setState({ status: 'loading', errorMessage: null })
    expect(kbListStillResolvingFromStores()).toBe(true)

    useKbListLoadStore.setState({ status: 'ok', errorMessage: null })
    expect(kbListStillResolvingFromStores()).toBe(false)
  })

  test('guest or workspace set: not resolving', () => {
    useAuthStore.setState({ isGuestMode: true, isAuthenticated: true })
    useSettingsStore.setState({ currentWorkspace: null })
    useKbListLoadStore.setState({ status: 'idle', errorMessage: null })
    expect(kbListStillResolvingFromStores()).toBe(false)

    useAuthStore.setState({ isGuestMode: false, isAuthenticated: true })
    useSettingsStore.setState({ currentWorkspace: 'x' })
    useKbListLoadStore.setState({ status: 'loading', errorMessage: null })
    expect(kbListStillResolvingFromStores()).toBe(false)
  })

  test('workspaceBlockedHintFromStores matches loading vs select-KB copy', () => {
    useAuthStore.setState({ isGuestMode: true, isAuthenticated: true })
    useSettingsStore.setState({ currentWorkspace: null })
    expect(workspaceBlockedHintFromStores()).toBeNull()

    useAuthStore.setState({ isGuestMode: false, isAuthenticated: true })
    useSettingsStore.setState({ currentWorkspace: null })
    useKbListLoadStore.setState({ status: 'loading', errorMessage: null })
    expect(workspaceBlockedHintFromStores()).toBe(i18n.t('workspace.loadingKbList'))

    useKbListLoadStore.setState({ status: 'ok', errorMessage: null })
    expect(workspaceBlockedHintFromStores()).toBe(i18n.t('workspace.selectKbFirst'))

    useSettingsStore.setState({ currentWorkspace: 'kb' })
    expect(workspaceBlockedHintFromStores()).toBeNull()
  })
})
