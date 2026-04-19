import { useCallback, useEffect, useState, useRef } from 'react'
import { AsyncSelect } from '@/components/ui/AsyncSelect'
import { useSettingsStore } from '@/stores/settings'
import { useGraphStore } from '@/stores/graph'
import { useBackendState } from '@/stores/state'
import { useWorkspaceActionsBlocked } from '@/hooks/useWorkspaceActionsBlocked'
import { useWorkspaceBlockedHint } from '@/hooks/useWorkspaceKbUi'
import {
  dropdownDisplayLimit,
  controlButtonVariant,
  popularLabelsDefaultLimit,
  searchLabelsDefaultLimit
} from '@/lib/constants'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'
import { SearchHistoryManager } from '@/utils/SearchHistoryManager'
import { getPopularLabels, searchLabels } from '@/api/lightrag'

const GraphLabels = () => {
  const { t } = useTranslation()
  const workspaceActionsBlocked = useWorkspaceActionsBlocked()
  const workspaceBlockedHint = useWorkspaceBlockedHint()
  const label = useSettingsStore.use.queryLabel()
  const dropdownRefreshTrigger = useSettingsStore.use.searchLabelDropdownRefreshTrigger()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [selectKey, setSelectKey] = useState(0)

  // Pipeline state monitoring
  const pipelineBusy = useBackendState.use.pipelineBusy()
  const prevPipelineBusy = useRef<boolean | undefined>(undefined)
  const shouldRefreshPopularLabelsRef = useRef(false)
  const prevWorkspaceBlockedRef = useRef(workspaceActionsBlocked)

  // Dynamic tooltip based on current label state
  const getRefreshTooltip = useCallback(() => {
    if (workspaceBlockedHint) {
      return workspaceBlockedHint
    }
    if (isRefreshing) {
      return t('graphPanel.graphLabels.refreshingTooltip')
    }

    if (!label || label === '*') {
      return t('graphPanel.graphLabels.refreshGlobalTooltip')
    } else {
      return t('graphPanel.graphLabels.refreshCurrentLabelTooltip', { label })
    }
  }, [label, t, isRefreshing, workspaceBlockedHint])

  // Initialize search history on component mount (and when workspace becomes available)
  useEffect(() => {
    const initializeHistory = async () => {
      const history = SearchHistoryManager.getHistory()

      if (history.length === 0) {
        if (workspaceActionsBlocked) {
          await SearchHistoryManager.initializeWithDefaults([
            'entity',
            'relationship',
            'document',
            'concept'
          ])
          return
        }
        try {
          const popularLabels = await getPopularLabels(popularLabelsDefaultLimit)
          await SearchHistoryManager.initializeWithDefaults(popularLabels)
        } catch (error) {
          console.error('Failed to initialize search history:', error)
        }
      }
    }

    initializeHistory()
  }, [workspaceActionsBlocked])

  // When a signed-in user picks a KB after placeholder history, load real popular labels from the API
  useEffect(() => {
    const wasBlocked = prevWorkspaceBlockedRef.current
    prevWorkspaceBlockedRef.current = workspaceActionsBlocked

    if (!wasBlocked || workspaceActionsBlocked) return

    let cancelled = false
    ;(async () => {
      try {
        const popularLabels = await getPopularLabels(popularLabelsDefaultLimit)
        if (cancelled || popularLabels.length === 0) return
        SearchHistoryManager.clearHistory()
        await SearchHistoryManager.initializeWithDefaults(popularLabels)
        setRefreshTrigger((p) => p + 1)
        setSelectKey((p) => p + 1)
      } catch (e) {
        console.error('Failed to hydrate popular labels after workspace selection:', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [workspaceActionsBlocked])

  // Force AsyncSelect to re-render when label changes externally (e.g., from entity rename/merge)
  useEffect(() => {
    setSelectKey(prev => prev + 1)
  }, [label])

  // Force AsyncSelect to re-render when dropdown refresh is triggered (e.g., after entity rename)
  useEffect(() => {
    if (dropdownRefreshTrigger > 0) {
      setSelectKey(prev => prev + 1)
    }
  }, [dropdownRefreshTrigger])

  // Monitor pipeline state changes: busy -> idle
  useEffect(() => {
    if (prevPipelineBusy.current === true && pipelineBusy === false) {
      if (import.meta.env.DEV) {
        console.log('Pipeline changed from busy to idle, marking for popular labels refresh')
      }
      shouldRefreshPopularLabelsRef.current = true
    }
    prevPipelineBusy.current = pipelineBusy
  }, [pipelineBusy])

  // Helper: Reload popular labels from backend
  const reloadPopularLabels = useCallback(async () => {
    if (workspaceActionsBlocked) return
    if (!shouldRefreshPopularLabelsRef.current) return

    if (import.meta.env.DEV) {
      console.log('Reloading popular labels (triggered by pipeline idle)')
    }
    try {
      const popularLabels = await getPopularLabels(popularLabelsDefaultLimit)
      SearchHistoryManager.clearHistory()

      if (popularLabels.length === 0) {
        const fallbackLabels = ['entity', 'relationship', 'document', 'concept']
        await SearchHistoryManager.initializeWithDefaults(fallbackLabels)
      } else {
        await SearchHistoryManager.initializeWithDefaults(popularLabels)
      }
    } catch (error) {
      console.error('Failed to reload popular labels:', error)
      const fallbackLabels = ['entity', 'relationship', 'document']
      SearchHistoryManager.clearHistory()
      await SearchHistoryManager.initializeWithDefaults(fallbackLabels)
    } finally {
      // Always clear the flag
      shouldRefreshPopularLabelsRef.current = false
    }
  }, [workspaceActionsBlocked])

  // Helper: Bump dropdown data to trigger refresh
  const bumpDropdownData = useCallback(({ forceSelectKey = false } = {}) => {
    setRefreshTrigger(prev => prev + 1)
    if (forceSelectKey) {
      setSelectKey(prev => prev + 1)
    }
  }, [])

  const fetchData = useCallback(
    async (query?: string): Promise<string[]> => {
      let results: string[] = []
      if (!query || query.trim() === '' || query.trim() === '*') {
        results = SearchHistoryManager.getHistoryLabels(dropdownDisplayLimit)
      } else if (workspaceActionsBlocked) {
        const history = SearchHistoryManager.getHistory()
        const queryLower = query.toLowerCase().trim()
        results = history
          .filter(item => item.label.toLowerCase().includes(queryLower))
          .map(item => item.label)
          .slice(0, dropdownDisplayLimit)
      } else {
        try {
          const apiResults = await searchLabels(query.trim(), searchLabelsDefaultLimit)
          results = apiResults.length <= dropdownDisplayLimit
            ? apiResults
            : [...apiResults.slice(0, dropdownDisplayLimit), '...']
        } catch (error) {
          console.error('Search API failed, falling back to local history search:', error)

          const history = SearchHistoryManager.getHistory()
          const queryLower = query.toLowerCase().trim()
          results = history
            .filter(item => item.label.toLowerCase().includes(queryLower))
            .map(item => item.label)
            .slice(0, dropdownDisplayLimit)
        }
      }
      const finalResults = ['*', ...results.filter((l) => l !== '*')]
      return finalResults
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshTrigger, workspaceActionsBlocked]
  )

  const handleRefresh = useCallback(async () => {
    if (workspaceActionsBlocked) return

    setIsRefreshing(true)

    // Clear legend cache to ensure legend is re-generated on refresh
    useGraphStore.getState().setTypeColorMap(new Map<string, string>())

    try {
      let currentLabel = label

      // If queryLabel is empty, set it to '*'
      if (!currentLabel || currentLabel.trim() === '') {
        useSettingsStore.getState().setQueryLabel('*')
        currentLabel = '*'
      }

      // Scenario 1: Manual refresh - reload popular labels if flag is set (regardless of current label)
      if (shouldRefreshPopularLabelsRef.current) {
        await reloadPopularLabels()
        bumpDropdownData({ forceSelectKey: true })
      }

      if (currentLabel && currentLabel !== '*') {
        // Scenario 1: Has specific label, try to refresh current label
        if (import.meta.env.DEV) {
          console.log(`Refreshing current label: ${currentLabel}`)
        }

        // Reset graph data fetch status to trigger refresh
        useGraphStore.getState().setGraphDataFetchAttempted(false)
        useGraphStore.getState().setLastSuccessfulQueryLabel('')

        // Force data refresh for current label
        useGraphStore.getState().incrementGraphDataVersion()

        // Note: If the current label has no data after refresh,
        // the fallback logic would be handled by the graph component itself
        // For now, we keep the current label and let the user see the result

      } else {
        // Scenario 3: queryLabel is "*", refresh global data and popular labels
        if (import.meta.env.DEV) {
          console.log('Refreshing global data and popular labels')
        }

        try {
          // Re-fetch popular labels and update search history (if not already done)
          const popularLabels = await getPopularLabels(popularLabelsDefaultLimit)
          SearchHistoryManager.clearHistory()

          if (popularLabels.length === 0) {
            // If no popular labels, provide fallback defaults
            const fallbackLabels = ['entity', 'relationship', 'document', 'concept']
            await SearchHistoryManager.initializeWithDefaults(fallbackLabels)
          } else {
            await SearchHistoryManager.initializeWithDefaults(popularLabels)
          }
        } catch (error) {
          console.error('Failed to reload popular labels:', error)
          // Provide fallback even if API fails
          const fallbackLabels = ['entity', 'relationship', 'document']
          SearchHistoryManager.clearHistory()
          await SearchHistoryManager.initializeWithDefaults(fallbackLabels)
        }

        // Reset graph data fetch status
        useGraphStore.getState().setGraphDataFetchAttempted(false)
        useGraphStore.getState().setLastSuccessfulQueryLabel('')

        // Force global data refresh
        useGraphStore.getState().incrementGraphDataVersion()

        // Ensure data update completes before triggering UI refresh
        await new Promise(resolve => setTimeout(resolve, 0))

        // Trigger both refresh mechanisms to ensure dropdown updates
        setRefreshTrigger(prev => prev + 1)
        setSelectKey(prev => prev + 1)
      }
    } catch (error) {
      console.error('Error during refresh:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [label, reloadPopularLabels, bumpDropdownData, workspaceActionsBlocked])

  // Handle dropdown before open - reload popular labels if needed
  const handleDropdownBeforeOpen = useCallback(async () => {
    if (workspaceActionsBlocked) return
    const currentLabel = useSettingsStore.getState().queryLabel
    if (shouldRefreshPopularLabelsRef.current && (!currentLabel || currentLabel === '*')) {
      await reloadPopularLabels()
      bumpDropdownData()
    }
  }, [reloadPopularLabels, bumpDropdownData, workspaceActionsBlocked])

  return (
    <div className="flex items-center">
      {/* Always show refresh button */}
      <Button
        size="icon"
        variant={controlButtonVariant}
        onClick={handleRefresh}
        tooltip={getRefreshTooltip()}
        className="mr-2"
        disabled={workspaceActionsBlocked || isRefreshing}
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      </Button>
      <div className="w-full min-w-[280px] max-w-[500px]">
        <AsyncSelect<string>
          key={selectKey} // Force re-render when data changes
          className="min-w-[300px]"
          triggerClassName="max-h-8 w-full overflow-hidden"
          searchInputClassName="max-h-8"
          triggerTooltip={
            workspaceBlockedHint ?? t('graphPanel.graphLabels.selectTooltip')
          }
          disabled={workspaceActionsBlocked}
          fetcher={fetchData}
          onBeforeOpen={handleDropdownBeforeOpen}
          renderOption={(item) => (
            <div className="truncate" title={item}>
              {item}
            </div>
          )}
          getOptionValue={(item) => item}
          getDisplayValue={(item) => (
            <div className="min-w-0 flex-1 truncate text-left" title={item}>
              {item}
            </div>
          )}
          notFound={<div className="py-6 text-center text-sm">{t('graphPanel.graphLabels.noLabels')}</div>}
          ariaLabel={t('graphPanel.graphLabels.label')}
          placeholder={t('graphPanel.graphLabels.placeholder')}
          searchPlaceholder={t('graphPanel.graphLabels.placeholder')}
          noResultsMessage={t('graphPanel.graphLabels.noLabels')}
          value={label !== null ? label : '*'}
          onChange={(newLabel) => {
            const currentLabel = useSettingsStore.getState().queryLabel;

            // select the last item means query all
            if (newLabel === '...') {
              newLabel = '*';
            }

            // Handle reselecting the same label
            if (newLabel === currentLabel && newLabel !== '*') {
              newLabel = '*';
            }

            // Add selected label to search history (except for special cases)
            if (newLabel && newLabel !== '*' && newLabel !== '...' && newLabel.trim() !== '') {
              SearchHistoryManager.addToHistory(newLabel);
            }

            // Reset graphDataFetchAttempted flag to ensure data fetch is triggered
            useGraphStore.getState().setGraphDataFetchAttempted(false);

            // Update the label to trigger data loading
            useSettingsStore.getState().setQueryLabel(newLabel);

            // Force graph re-render and reset zoom/scale (must be AFTER setQueryLabel)
            useGraphStore.getState().incrementGraphDataVersion();
          }}
          clearable={false}  // Prevent clearing value on reselect
          debounceTime={500}
        />
      </div>
    </div>
  )
}

export default GraphLabels
