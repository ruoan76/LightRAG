import { useState, useEffect } from 'react'
import { useTabVisibility } from '@/contexts/useTabVisibility'
import { backendBaseUrl } from '@/lib/constants'
import { useTranslation } from 'react-i18next'

export default function ApiSite() {
  const { t } = useTranslation()
  const { isTabVisible } = useTabVisibility()
  const isApiTabVisible = isTabVisible('api')
  const [iframeLoaded, setIframeLoaded] = useState(false)

  // Load the iframe once on component mount
  useEffect(() => {
    if (!iframeLoaded) {
      setIframeLoaded(true)
    }
  }, [iframeLoaded])

  // Use CSS to hide content when tab is not visible
  return (
    <div className={`size-full ${isApiTabVisible ? '' : 'hidden'}`}>
      {iframeLoaded ? (
        <iframe
          title={t('apiSite.docsFrameTitle')}
          src={backendBaseUrl + '/docs'}
          className="size-full w-full h-full"
          style={{ width: '100%', height: '100%', border: 'none' }}
          key="api-docs-iframe"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-background">
          <div className="text-center">
            <div
              className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent"
              aria-hidden
            />
            <p className="text-muted-foreground text-sm">{t('apiSite.loading')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
