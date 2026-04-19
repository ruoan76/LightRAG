/**
 * Detect workspace-scoped 403 responses (ACL) from FastAPI.
 * Backend: `lightrag/api/routers/workspace_deps.py` (`WORKSPACE_ACCESS_DENIED_CODE`).
 */

export const WORKSPACE_ACCESS_DENIED_CODE = 'workspace_access_denied'

/** Normalize FastAPI error `detail` (string | object | array) to a single searchable string. */
export function responseDetailAsSearchText(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const detail = (data as { detail?: unknown }).detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg?: unknown }).msg ?? '')
        }
        return typeof item === 'string' ? item : JSON.stringify(item)
      })
      .join(' ')
  }
  if (detail && typeof detail === 'object') {
    try {
      return JSON.stringify(detail)
    } catch {
      return String(detail)
    }
  }
  return detail != null ? String(detail) : ''
}

/** True when API returns structured workspace ACL denial (`detail.code`). */
export function responseDetailHasWorkspaceAclCode(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const detail = (data as { detail?: unknown }).detail
  if (!detail || typeof detail !== 'object') return false
  const code = (detail as { code?: unknown }).code
  return code === WORKSPACE_ACCESS_DENIED_CODE
}

/** Backend ACL message for workspace-scoped 403 (see workspace_deps). */
export function responseDetailLooksLikeWorkspaceAcl(data: unknown): boolean {
  if (responseDetailHasWorkspaceAclCode(data)) return true
  const s = responseDetailAsSearchText(data)
  if (!s) return false
  const lower = s.toLowerCase()
  return (
    /knowledge base workspace|no access to this knowledge base/i.test(s) ||
    (lower.includes('knowledge base') && lower.includes('workspace')) ||
    (lower.includes('no access') && /workspace|knowledge base/i.test(s))
  )
}
