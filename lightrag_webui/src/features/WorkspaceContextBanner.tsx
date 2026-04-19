import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings'
import { useWorkspaceActionsBlocked } from '@/hooks/useWorkspaceActionsBlocked'
import { useKbListLoadStore } from '@/stores/kbListLoadStatus'
import Button from '@/components/ui/Button'

export default function WorkspaceContextBanner({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation()
  const currentWorkspace = useSettingsStore.use.currentWorkspace()
  const workspaceActionsBlocked = useWorkspaceActionsBlocked()
  const kbStatus = useKbListLoadStore((s) => s.status)
  const kbErrorMessage = useKbListLoadStore((s) => s.errorMessage)

  if (kbStatus === 'loading') {
    return (
      <div className="border-b border-border/40 bg-muted/20 px-4 py-1.5 text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
        <span>{t('workspace.loadingKbList')}</span>
      </div>
    )
  }

  if (kbStatus === 'idle') {
    return null
  }

  if (kbStatus === 'error') {
    return (
      <div
        className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm flex flex-wrap items-center justify-between gap-2"
        role="alert"
      >
        <span>
          {t('workspace.listLoadFailed', { error: kbErrorMessage || 'Error' })}
        </span>
        {onRetry && (
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            {t('workspace.retry', 'Retry')}
          </Button>
        )}
      </div>
    )
  }

  if (kbStatus === 'ok' && workspaceActionsBlocked) {
    return (
      <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-100">
        {t('workspace.noKbAssigned')}
      </div>
    )
  }

  if (kbStatus === 'ok' && currentWorkspace) {
    return (
      <div className="border-b border-border/60 bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground flex items-center gap-2">
        <span className="font-medium text-foreground">{t('workspace.currentKb', { name: currentWorkspace })}</span>
        <span className="hidden sm:inline">{t('workspace.scopeHint')}</span>
      </div>
    )
  }

  return null
}
