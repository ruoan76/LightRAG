import Button from '@/components/ui/Button'
import { SiteInfo, webuiPrefix } from '@/lib/constants'
import AppSettings from '@/components/AppSettings'
import { TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/state'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { navigationService } from '@/services/navigation'
import { ZapIcon, LogOutIcon, Loader2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getMyKnowledgeBases } from '@/api/lightrag'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import WorkspaceContextBanner from '@/features/WorkspaceContextBanner'
import { errorMessage } from '@/lib/utils'
import { useKbListLoadStore } from '@/stores/kbListLoadStatus'

interface NavigationTabProps {
  value: string
  currentTab: string
  children: React.ReactNode
}

function NavigationTab({ value, currentTab, children }: NavigationTabProps) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        'cursor-pointer px-2 py-1 transition-all',
        currentTab === value ? '!bg-emerald-400 !text-zinc-50' : 'hover:bg-background/60'
      )}
    >
      {children}
    </TabsTrigger>
  )
}

function TabsNavigation() {
  const currentTab = useSettingsStore.use.currentTab()
  const { t } = useTranslation()
  const { isGuestMode } = useAuthStore()

  return (
    <div className="flex h-8 self-center">
      <TabsList className="h-full gap-2">
        <NavigationTab value="documents" currentTab={currentTab}>
          {t('header.documents')}
        </NavigationTab>
        <NavigationTab value="knowledge-graph" currentTab={currentTab}>
          {t('header.knowledgeGraph')}
        </NavigationTab>
        <NavigationTab value="retrieval" currentTab={currentTab}>
          {t('header.retrieval')}
        </NavigationTab>
        <NavigationTab value="api" currentTab={currentTab}>
          {t('header.api')}
        </NavigationTab>
        {!isGuestMode && (
          <NavigationTab value="admin" currentTab={currentTab}>
            {t('header.admin', 'Admin')}
          </NavigationTab>
        )}
      </TabsList>
    </div>
  )
}

export default function SiteHeader() {
  const { t } = useTranslation()
  const { isGuestMode, coreVersion, apiVersion, username, webuiTitle, webuiDescription } = useAuthStore()
  const currentWorkspace = useSettingsStore.use.currentWorkspace()
  const setCurrentWorkspace = useSettingsStore.use.setCurrentWorkspace()
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const setKbListLoad = useKbListLoadStore((s) => s.setKbListLoad)
  const kbListStatus = useKbListLoadStore((s) => s.status)

  const canSelectWorkspace = !isGuestMode

  const loadKnowledgeBases = useCallback(async () => {
    if (!canSelectWorkspace) {
      setWorkspaces([])
      setKbListLoad({ status: 'idle', errorMessage: null })
      return
    }
    setKbListLoad({ status: 'loading', errorMessage: null })
    try {
      const data = await getMyKnowledgeBases()
      const ws = data.workspaces || []
      setWorkspaces(ws)
      setKbListLoad({ status: 'ok', errorMessage: null })

      const persisted = useSettingsStore.getState().currentWorkspace
      if (ws.length === 0) {
        if (persisted !== null) {
          setCurrentWorkspace(null)
        }
      } else {
        const next =
          persisted !== null && ws.includes(persisted) ? persisted : ws[0]
        if (next !== persisted) {
          setCurrentWorkspace(next)
        }
      }
    } catch (e) {
      setWorkspaces([])
      setKbListLoad({ status: 'error', errorMessage: errorMessage(e) })
    }
  }, [canSelectWorkspace, setCurrentWorkspace, setKbListLoad])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await loadKnowledgeBases()
      if (cancelled) return
    })()
    return () => {
      cancelled = true
    }
  }, [loadKnowledgeBases])

  const workspaceOptions = useMemo(() => workspaces.filter(Boolean), [workspaces])

  const versionDisplay = (coreVersion && apiVersion)
    ? `${coreVersion}/${apiVersion}`
    : null;

  // Check if frontend needs rebuild (apiVersion ends with warning symbol)
  const hasWarning = apiVersion?.endsWith('⚠️');
  const versionTooltip = hasWarning
    ? t('header.frontendNeedsRebuild')
    : versionDisplay ? `v${versionDisplay}` : '';

  const handleLogout = () => {
    navigationService.navigateToLogin();
  }

  return (
    <>
    <header className="border-border/40 bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 flex h-10 w-full border-b px-4 backdrop-blur">
      <div className="min-w-[200px] w-auto flex items-center">
        <a href={webuiPrefix} className="flex items-center gap-2">
          <ZapIcon className="size-4 text-emerald-400" aria-hidden="true" />
          <span className="font-bold md:inline-block">{SiteInfo.name}</span>
        </a>
        {webuiTitle && (
          <div className="flex items-center">
            <span className="mx-1 text-xs text-gray-500 dark:text-gray-400">|</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium text-sm cursor-default">
                    {webuiTitle}
                  </span>
                </TooltipTrigger>
                {webuiDescription && (
                  <TooltipContent side="bottom">
                    {webuiDescription}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      <div
        className="flex h-10 flex-1 items-center justify-center"
        aria-busy={canSelectWorkspace && kbListStatus === 'loading' ? true : undefined}
      >
        <TabsNavigation />
        {canSelectWorkspace && kbListStatus === 'loading' && (
          <div className="ml-3 flex max-w-[200px] items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            <span className="truncate">{t('workspace.loadingKbList')}</span>
          </div>
        )}
        {canSelectWorkspace && kbListStatus === 'ok' && workspaceOptions.length > 0 && (
          <div className="ml-3 flex items-center">
            <Select
              value={currentWorkspace ?? undefined}
              onValueChange={(v) => setCurrentWorkspace(v)}
            >
              <SelectTrigger className="h-8 w-[180px]" aria-label={t('header.workspace', 'Workspace')}>
                <SelectValue placeholder={t('header.workspace', 'Workspace')} />
              </SelectTrigger>
              <SelectContent>
                {workspaceOptions.map((ws) => (
                  <SelectItem key={ws} value={ws}>
                    {ws}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {canSelectWorkspace && kbListStatus === 'ok' && workspaceOptions.length === 0 && (
          <div className="ml-2 self-center rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            {t('header.noWorkspaceAccess', 'No knowledge base access. Contact your admin.')}
          </div>
        )}
        {isGuestMode && (
          <div className="ml-2 self-center px-2 py-1 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 rounded-md">
            {t('login.guestMode', 'Guest Mode')}
          </div>
        )}
      </div>

      <nav className="w-[200px] flex items-center justify-end">
        <div className="flex items-center gap-2">
          {versionDisplay && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mr-1 cursor-default">
                    v{versionDisplay}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {versionTooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <AppSettings />
          {!isGuestMode && (
            <Button
              variant="ghost"
              size="icon"
              side="bottom"
              tooltip={`${t('header.logout')} (${username})`}
              onClick={handleLogout}
            >
              <LogOutIcon className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </nav>
    </header>
    {canSelectWorkspace && (
      <WorkspaceContextBanner
        onRetry={kbListStatus === 'error' ? loadKnowledgeBases : undefined}
      />
    )}
    </>
  )
}
