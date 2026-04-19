import { useTranslation } from 'react-i18next'
import { Loader2, ZapIcon } from 'lucide-react'
import { SiteInfo, webuiPrefix } from '@/lib/constants'

type FullScreenLoaderProps = {
  /**
   * `withHeaderStub`: top bar matching main app layout while auth/version bootstrap runs.
   * `default`: centered full-viewport spinner (login wait, router init).
   */
  variant?: 'default' | 'withHeaderStub'
}

/**
 * Full-viewport loading state (auth bootstrap, login config check, etc.).
 */
export default function FullScreenLoader({ variant = 'default' }: FullScreenLoaderProps) {
  const { t } = useTranslation()

  const body = (
    <div className="text-center" role="status" aria-live="polite" aria-busy="true">
      <Loader2 className="mx-auto mb-3 size-9 animate-spin text-primary" aria-hidden />
      <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
    </div>
  )

  if (variant === 'withHeaderStub') {
    return (
      <div className="flex h-screen w-screen flex-col bg-background" aria-busy="true">
        <header className="border-border/40 bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 flex h-10 w-full border-b px-4 backdrop-blur">
          <div className="min-w-[200px] w-auto flex items-center">
            <a href={webuiPrefix} className="flex items-center gap-2">
              <ZapIcon className="size-4 text-emerald-400" aria-hidden="true" />
              <span className="font-bold md:inline-block">{SiteInfo.name}</span>
            </a>
          </div>
          <div className="flex h-10 flex-1 items-center justify-center" />
          <nav className="w-[200px] flex items-center justify-end" />
        </header>
        <div className="flex flex-1 items-center justify-center">{body}</div>
      </div>
    )
  }

  return (
    <div
      className="flex h-screen w-screen items-center justify-center bg-background"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {body}
    </div>
  )
}
