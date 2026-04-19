import { Library } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
  /** Compact single-line style for tight toolbars */
  compact?: boolean
}

/**
 * Explains that a knowledge base must be selected (signed-in, non-guest users).
 */
export default function WorkspaceRequiredCallout({ className, compact }: Props) {
  const { t } = useTranslation()
  if (compact) {
    return (
      <div
        role="status"
        className={cn(
          'flex items-start gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-100',
          className
        )}
      >
        <Library className="mt-0.5 size-4 shrink-0 opacity-90" aria-hidden />
        <div>
          <p className="font-medium leading-tight">{t('workspace.blockedTitle')}</p>
          <p className="text-muted-foreground mt-1 text-xs leading-snug dark:text-amber-200/90">
            {t('workspace.blockedDescription')}
          </p>
        </div>
      </div>
    )
  }
  return (
    <Alert
      className={cn(
        'border-amber-500/40 bg-amber-500/5 text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100',
        className
      )}
    >
      <Library className="size-4 text-amber-800 dark:text-amber-200" aria-hidden />
      <AlertTitle>{t('workspace.blockedTitle')}</AlertTitle>
      <AlertDescription className="text-amber-900/90 dark:text-amber-100/90">
        {t('workspace.blockedDescription')}
      </AlertDescription>
    </Alert>
  )
}
