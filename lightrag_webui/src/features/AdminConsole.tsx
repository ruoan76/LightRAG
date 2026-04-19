import { useEffect, useMemo, useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/AlertDialog'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  adminCreateKb,
  adminDeleteKb,
  adminGrant,
  adminListAcl,
  adminListKbs,
  adminRevoke,
  type AdminKB
} from '@/api/lightrag'
import { useSettingsStore } from '@/stores/settings'
import { errorMessage } from '@/lib/utils'

export default function AdminConsole() {
  const { t } = useTranslation()
  const [kbs, setKbs] = useState<AdminKB[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('')
  const [aclUsers, setAclUsers] = useState<Array<{ username: string; granted_at: string; granted_by: string | null }>>(
    []
  )
  const [error, setError] = useState<string | null>(null)

  const [newWorkspace, setNewWorkspace] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')

  const [grantUsername, setGrantUsername] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refreshKbs = async () => {
    const data = await adminListKbs()
    setKbs(data)
    if (!selectedWorkspace && data.length > 0) {
      setSelectedWorkspace(data[0].workspace)
    }
  }

  const refreshAcl = async (workspace: string) => {
    if (!workspace) return
    const data = await adminListAcl(workspace)
    setAclUsers(data.users || [])
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setError(null)
        await refreshKbs()
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load admin data')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setError(null)
        await refreshAcl(selectedWorkspace)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load ACL')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedWorkspace])

  const kbOptions = useMemo(() => kbs.map((k) => k.workspace), [kbs])

  const onCreateKb = async () => {
    if (!newWorkspace.trim()) return
    try {
      setError(null)
      await adminCreateKb({
        workspace: newWorkspace.trim(),
        title: newTitle.trim() || undefined,
        description: newDescription.trim() || undefined
      })
      setNewWorkspace('')
      setNewTitle('')
      setNewDescription('')
      await refreshKbs()
    } catch (e: any) {
      setError(e?.message || 'Failed to create KB')
    }
  }

  const confirmDeleteKb = async () => {
    if (!deleteTarget) return
    const workspace = deleteTarget
    try {
      setError(null)
      setDeleting(true)
      const prevGlobal = useSettingsStore.getState().currentWorkspace
      await adminDeleteKb(workspace)
      if (selectedWorkspace === workspace) setSelectedWorkspace('')
      const data = await adminListKbs()
      setKbs(data)
      if (
        prevGlobal === workspace ||
        (prevGlobal != null && prevGlobal !== '' && !data.some((k) => k.workspace === prevGlobal))
      ) {
        useSettingsStore.getState().setCurrentWorkspace(data[0]?.workspace ?? null)
      }
      toast.success(t('admin.deleteSuccess', { workspace }))
      setDeleteTarget(null)
    } catch (e: any) {
      const msg = errorMessage(e) || e?.message || 'Failed to delete KB'
      setError(msg)
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  const onGrant = async () => {
    if (!selectedWorkspace || !grantUsername.trim()) return
    try {
      setError(null)
      await adminGrant({ username: grantUsername.trim(), workspace: selectedWorkspace })
      setGrantUsername('')
      await refreshAcl(selectedWorkspace)
    } catch (e: any) {
      setError(e?.message || 'Failed to grant')
    }
  }

  const onRevoke = async (username: string) => {
    if (!selectedWorkspace) return
    try {
      setError(null)
      await adminRevoke({ username, workspace: selectedWorkspace })
      await refreshAcl(selectedWorkspace)
    } catch (e: any) {
      setError(e?.message || 'Failed to revoke')
    }
  }

  return (
    <div className="p-4 space-y-6">
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent
          onPointerDownOutside={(e) => deleting && e.preventDefault()}
          onEscapeKeyDown={(e) => deleting && e.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.deleteConfirmTitle', 'Delete knowledge base')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? t('admin.deleteConfirmDescription', { workspace: deleteTarget }) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                void confirmDeleteKb()
              }}
            >
              {deleting ? t('common.loading', 'Loading…') : t('admin.delete', 'Delete')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">{t('admin.title', 'Admin Console')}</div>
          <div className="text-sm text-muted-foreground">
            {t('admin.subtitle', 'Manage knowledge bases and workspace access (deny-by-default).')}
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={() => refreshKbs()}>
          {t('admin.refresh', 'Refresh')}
        </Button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <section className="rounded-md border p-4 space-y-3">
        <div className="font-medium">{t('admin.kbs', 'Knowledge Bases')}</div>
        <p className="text-sm text-muted-foreground leading-snug">{t('admin.kbsHint')}</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Input
            placeholder={t('admin.workspace', 'workspace (e.g. tech_kb)')}
            value={newWorkspace}
            onChange={(e) => setNewWorkspace(e.target.value)}
          />
          <Input
            placeholder={t('admin.titleField', 'title (optional)')}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Input
            placeholder={t('admin.description', 'description (optional)')}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <Button type="button" onClick={onCreateKb}>
            {t('admin.create', 'Create')}
          </Button>
        </div>

        <div className="space-y-2">
          {kbs.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('admin.noKbs', 'No KBs found.')}</div>
          ) : (
            <div className="divide-y rounded-md border">
              {kbs.map((kb) => (
                <div key={kb.workspace} className="flex items-center justify-between gap-2 p-2">
                  <button
                    type="button"
                    className={`text-left flex-1 min-w-0 ${selectedWorkspace === kb.workspace ? 'font-semibold' : ''}`}
                    onClick={() => setSelectedWorkspace(kb.workspace)}
                  >
                    <div>{kb.workspace}</div>
                    {(kb.title || kb.description) && (
                      <div className="text-xs text-muted-foreground">
                        {kb.title ? kb.title : ''}
                        {kb.title && kb.description ? ' · ' : ''}
                        {kb.description ? kb.description : ''}
                      </div>
                    )}
                  </button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="shrink-0"
                    disabled={deleting}
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget(kb.workspace)
                    }}
                  >
                    {t('admin.delete', 'Delete')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-md border p-4 space-y-3">
        <div className="font-medium">{t('admin.acl', 'Workspace Access (ACL)')}</div>
        <p className="text-sm text-muted-foreground leading-snug">{t('admin.aclHint')}</p>
        <div className="text-sm text-muted-foreground">
          {t('admin.selectedWorkspace', 'Selected workspace')}: <span className="font-mono">{selectedWorkspace || '-'}</span>
        </div>
        {kbOptions.length === 0 ? null : (
          <div className="flex gap-2 items-center">
            <Input
              placeholder={t('admin.grantUser', 'username to grant')}
              value={grantUsername}
              onChange={(e) => setGrantUsername(e.target.value)}
            />
            <Button type="button" onClick={onGrant} disabled={!selectedWorkspace || !grantUsername.trim()}>
              {t('admin.grant', 'Grant')}
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {selectedWorkspace && aclUsers.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('admin.noUsers', 'No users granted yet.')}</div>
          ) : (
            <div className="divide-y rounded-md border">
              {aclUsers.map((u) => (
                <div key={u.username} className="flex items-center justify-between p-2">
                  <div>
                    <div className="font-mono">{u.username}</div>
                    <div className="text-xs text-muted-foreground">
                      {t('admin.grantedAt', 'granted_at')}: {u.granted_at}
                      {u.granted_by ? ` · ${t('admin.grantedBy', 'by')}: ${u.granted_by}` : ''}
                    </div>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => onRevoke(u.username)}>
                    {t('admin.revoke', 'Revoke')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

